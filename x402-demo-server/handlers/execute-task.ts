import type { Context } from 'hono';
import { handleResumeScreenFastRequest } from './resume-screen-fast';
import { handleResumeScreenAccurateRequest } from './resume-screen-accurate';
import { handleContractAnalyzeFastRequest } from './contract-analyze-fast';
import { handleContractAnalyzeAccurateRequest } from './contract-analyze-accurate';
import { handleInvoiceExtractFastRequest } from './invoice-extract-fast';
import { handleInvoiceExtractAccurateRequest } from './invoice-extract-accurate';
import { verifyOutput } from './lib/verify-output';
import { updateReputation } from './lib/reputation-store';
import { extractText } from './lib/extract-document';
import { Task } from '../models/Task';
import { Payments } from '../models/Payments';
import { EndpointUsage } from '../models/EndpointUsage';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import mongoose from 'mongoose';

/** Fixed platform fee in USDC (must match plan-task.ts) */
const PLATFORM_FEE = 0.75;

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single entry in the per-file execution progress log. */
interface ProgressEntry {
  step: number;
  filename?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a mock Hono Context that injects a pre-set body into the handler.
 * This allows internal handler reuse without an HTTP round-trip.
 */
function buildMockContext(bodyData: Record<string, any>): Context {
  return {
    req: { json: async () => bodyData },
    json: (data: any) => data,
  } as unknown as Context;
}

/**
 * Aggregates per-file handler results into a unified response object.
 * Each task category has its own merge strategy.
 */
function aggregateResults(category: string, results: any[]): any {
  if (results.length === 0) return {};

  if (category === 'resume_screening') {
    const allCandidates = results.flatMap((r) => r.candidates ?? []);
    const totalConfidence = results.reduce((sum, r) => sum + (r.confidence ?? 0), 0);
    return {
      candidates: allCandidates,
      averageConfidence: parseFloat((totalConfidence / results.length).toFixed(3)),
      totalFiles: results.length,
    };
  }

  if (category === 'contract_analysis') {
    const allDocuments = results.map((r, i) => ({
      document: i + 1,
      clauses: r.clauses ?? [],
      confidence: r.confidence ?? 0,
    }));
    const totalClauses = allDocuments.reduce((sum, d) => sum + d.clauses.length, 0);
    const avgConfidence = results.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / results.length;
    return {
      documents: allDocuments,
      totalClauses,
      averageConfidence: parseFloat(avgConfidence.toFixed(3)),
      totalFiles: results.length,
    };
  }

  if (category === 'invoice_extraction') {
    const allDocuments = results.map((r, i) => ({
      document: i + 1,
      line_items: r.line_items ?? [],
      confidence: r.confidence ?? 0,
    }));
    const totalLineItems = allDocuments.reduce((sum, d) => sum + d.line_items.length, 0);
    const avgConfidence = results.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / results.length;
    return {
      documents: allDocuments,
      totalLineItems,
      averageConfidence: parseFloat(avgConfidence.toFixed(3)),
      totalFiles: results.length,
    };
  }

  return { results };
}

/**
 * Invokes the correct provider handler for a given endpoint and file payload.
 *
 * @param endpoint - The selected provider endpoint path
 * @param bodyData - The body data to pass to the handler (task_description + files)
 * @returns The raw handler result, or throws on unknown endpoint
 */
async function invokeProviderHandler(endpoint: string, bodyData: Record<string, any>): Promise<any> {
  const ctx = buildMockContext(bodyData);
  switch (endpoint) {
    case '/resume-screen-fast':    return handleResumeScreenFastRequest(ctx);
    case '/resume-screen-accurate': return handleResumeScreenAccurateRequest(ctx);
    case '/contract-analyze-fast': return handleContractAnalyzeFastRequest(ctx);
    case '/contract-analyze-accurate': return handleContractAnalyzeAccurateRequest(ctx);
    case '/invoice-extract-fast':  return handleInvoiceExtractFastRequest(ctx);
    case '/invoice-extract-accurate': return handleInvoiceExtractAccurateRequest(ctx);
    default:
      throw new Error(`Unknown endpoint: ${endpoint}`);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * POST /execute-task?planId=<id>
 *
 * Phase 2 of the execution pipeline — called ONLY after dynamic x402 payment.
 *
 * Payment Architecture Note:
 * ─────────────────────────
 * The current x402 + Algorand stack does NOT support true atomic grouped transactions
 * (multiple USDC transfers grouped into one Algorand atomic group). The x402 wire
 * protocol sends one x-payment header per HTTP request carrying a single PaymentPayload.
 *
 * What we DO implement is the equivalent user experience:
 *   - The plan computes total = (N × unitPrice) + platformFee
 *   - A single USDC transfer for that total is signed in ONE wallet popup
 *   - After settlement, the server executes the provider N times internally
 *   - We record this as 'consolidated' payment mode and store the tx signature
 *     as groupTransactionId to represent the batch of work
 *
 * Workflow:
 *  1. Read planId from query parameter
 *  2. Look up the 'planned' Task document in DB
 *  3. Extract and process uploaded files (text extraction)
 *  4. Build execution progress log, execute provider once per file
 *  5. Aggregate all results into a combined report
 *  6. Persist full billing breakdown, groupTransactionId, and progress log
 *  7. Return combined result with execution metadata
 */

export async function handleExecuteTaskRequest(c: Context) {
  const startTime = Date.now();
  let taskRecord: any = null;
  let user: any = null;

  try {
    console.log('✓ POST /execute-task executing (recording completed task)');

    // ── Step 1: Resolve plan ─────────────────────────────────────────────────
    const planId = c.req.query('planId');
    if (!planId) {
      return c.json({ error: 'planId query parameter is required' }, 400);
    }

    taskRecord = await Task.findById(planId);
    if (!taskRecord) {
      return c.json({ error: `Plan not found: ${planId}` }, 404);
    }
    if (taskRecord.status !== 'planned' && taskRecord.status !== 'in_progress') {
      return c.json({
        error: `Plan is not in 'planned' state (current: ${taskRecord.status}).`,
      }, 409);
    }

    // ── Step 2: Resolve user ────────────────────────────────────────────────
    const tokenUser = c.get('user' as any);
    if (tokenUser?.userId) {
      user = await User.findById(tokenUser.userId);
    }
    if (!user && taskRecord.userId) {
      user = await User.findById(taskRecord.userId);
    }
    if (!user) {
      user = await User.findOne({ email: 'guest@prism.ai' });
      if (!user) {
        user = await User.create({
          fullName: 'Guest User',
          email: 'guest@prism.ai',
          passwordHash: 'guest-hashed-pwd',
          role: 'user',
        });
      }
    }

    // ── Step 3: Extract results and transaction IDs ──────────────────────────
    const body = await c.req.json().catch(() => ({}));
    const { results = [], transactionIds = [], status, error } = body;

    if (status === 'failed' || error) {
      taskRecord.status = 'failed';
      await taskRecord.save();

      await AuditLog.create({
        userId: user._id,
        action: 'Task Failed',
        details: { planId, error: error || 'Execution failed' },
        ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
      }).catch(() => {});

      return c.json({ error: error || 'Execution failed' }, 400);
    }

    const actualQuantity = results.length > 0 ? results.length : 1;
    const winnerEndpoint: string = taskRecord.selectedEndpoint;
    const category: string = taskRecord.category;

    // ── Step 4: Aggregate results ────────────────────────────────────────────
    const combinedResult = aggregateResults(category, results);
    const executionTime = Date.now() - startTime;

    // ── Step 5: Output verification ──────────────────────────────────────────
    const verification = verifyOutput(category, combinedResult);
    updateReputation(winnerEndpoint, verification.passed);
    const verificationScore = verification.passed ? 1 : 0;

    // ── Step 6: Compute final pricing (strictly for DB logging, no payment check)
    const unitPrice: number = taskRecord.unitPrice ?? 0;
    const finalExecutionCost: number = parseFloat((unitPrice * actualQuantity).toFixed(2));
    const finalTotalCost: number = finalExecutionCost; // No platform fee on independent calls

    // ── Step 7: Update Task record ───────────────────────────────────────────
    taskRecord.status = 'completed';
    taskRecord.output = combinedResult;
    taskRecord.executionTime = executionTime;
    taskRecord.executionCount = actualQuantity;
    taskRecord.executionQuantity = actualQuantity;
    taskRecord.executionCost = finalExecutionCost;
    taskRecord.totalCost = finalTotalCost;
    taskRecord.verificationScore = verificationScore;
    taskRecord.verificationStatus = verification.passed ? 'passed' : 'failed';
    taskRecord.paymentMode = 'grouped';
    taskRecord.groupTransactionId = transactionIds[0] || `grouped-${new mongoose.Types.ObjectId()}`;

    // Create progress log
    const progressLog: ProgressEntry[] = results.map((r, i) => ({
      step: i + 1,
      filename: r.candidates?.[0]?.name || `Execution #${i + 1}`,
      status: 'completed',
      timestamp: new Date(),
    }));
    taskRecord.executionProgressLog = progressLog;
    await taskRecord.save();

    // ── Step 8: Create Payment record ────────────────────────────────────────
    await Payments.create({
      taskId: taskRecord._id,
      userId: user._id,
      x402TransactionId: transactionIds[0] || `grouped-independent-${new mongoose.Types.ObjectId()}`,
      amount: finalTotalCost,
      unitPrice,
      executionQuantity: actualQuantity,
      executionCost: finalExecutionCost,
      platformFee: 0,
      totalAmount: finalTotalCost,
      blockchain: 'Algorand',
      currency: 'USDC',
      status: 'completed',
      groupTransactionId: transactionIds[0] || `grouped-independent-${new mongoose.Types.ObjectId()}`,
      paymentMode: 'grouped',
    });

    // ── Step 9: Record endpoint usage ────────────────────────────────────────
    await EndpointUsage.create({
      endpointName: winnerEndpoint,
      endpointId: winnerEndpoint,
      provider: winnerEndpoint.includes('accurate') ? 'Groq-70B' : 'Groq-Llama3',
      responseTime: executionTime,
      cost: unitPrice,
      qualityScore: verificationScore,
      userId: user._id,
      taskId: taskRecord._id,
    });

    // ── Step 10: Update user aggregate stats ─────────────────────────────────
    user.totalTasks = (user.totalTasks ?? 0) + 1;
    user.totalSpent = (user.totalSpent ?? 0) + finalTotalCost;
    user.totalSaved = (user.totalSaved ?? 0) + Math.max(0, (actualQuantity * 1.50) - finalTotalCost);
    const userEndpoints = await EndpointUsage.distinct('endpointName', { userId: user._id });
    user.totalEndpointsUsed = userEndpoints.length;
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'Task Completed',
      details: {
        taskId: taskRecord._id,
        executionTime,
        executionCount: actualQuantity,
        unitPrice,
        executionCost: finalExecutionCost,
        platformFee: 0,
        totalCost: finalTotalCost,
        groupTransactionId: transactionIds[0],
        paymentMode: 'grouped',
        verificationPassed: verification.passed,
        verificationReason: verification.reason,
      },
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
    });

    return c.json({
      planId,
      category,
      winner_endpoint: winnerEndpoint,
      providerName: taskRecord.providerName,
      unitPrice,
      executionQuantity: actualQuantity,
      executionCost: finalExecutionCost,
      platformFee: 0,
      totalCost: finalTotalCost,
      executionCount: actualQuantity,
      executionTime,
      verification,
      groupTransactionId: transactionIds[0] || 'grouped-independent',
      paymentMode: 'grouped',
      executionProgressLog: progressLog,
      result: combinedResult,
    });
  } catch (error: any) {
    console.error('Error in execute-task handler:', error);
    if (taskRecord) {
      taskRecord.status = 'failed';
      await taskRecord.save();
    }
    if (user) {
      await AuditLog.create({
        userId: user._id,
        action: 'Task Failed',
        details: { planId: c.req.query('planId'), error: error.message },
        ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
      }).catch(() => {});
    }
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
}
