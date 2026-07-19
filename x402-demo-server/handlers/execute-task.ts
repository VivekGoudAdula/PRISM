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
    console.log('✓ PAYMENT VERIFIED (DYNAMIC) — POST /execute-task executing');

    // ── Step 1: Resolve plan ─────────────────────────────────────────────────
    const planId = c.req.query('planId');
    if (!planId) {
      return c.json({ error: 'planId query parameter is required' }, 400);
    }

    taskRecord = await Task.findById(planId);
    if (!taskRecord) {
      return c.json({ error: `Plan not found: ${planId}` }, 404);
    }
    if (taskRecord.status !== 'planned') {
      return c.json({
        error: `Plan is not in 'planned' state (current: ${taskRecord.status}). Each plan can only be executed once.`,
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

    // ── Step 3: Extract the consolidated group transaction ID ────────────────
    // The x402 payment header carries a single transaction signature that covers
    // (executionQuantity × unitPrice + platformFee) — this is our "group" payment ID.
    const paymentHeader = c.req.header('x-payment') || c.req.header('payment-signature');
    const groupTransactionId = paymentHeader
      ? paymentHeader.substring(0, 500)
      : `consolidated-${new mongoose.Types.ObjectId()}`;

    // Mark as in-progress immediately to prevent duplicate executions
    taskRecord.status = 'in_progress';
    taskRecord.groupTransactionId = groupTransactionId;
    taskRecord.paymentMode = 'consolidated';
    await taskRecord.save();

    await AuditLog.create({
      userId: user._id,
      action: 'Task Execution Started',
      details: {
        taskId: taskRecord._id,
        planId,
        executionQuantity: taskRecord.executionQuantity,
        totalCost: taskRecord.totalCost,
        provider: taskRecord.providerName,
        groupTransactionId,
        paymentMode: 'consolidated',
      },
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
    });

    // ── Step 4: Extract text from all uploaded files ─────────────────────────
    const body = await c.req.json().catch(() => ({}));
    const { task_description = taskRecord.prompt, files = [] } = body;

    const extractedFiles: { filename: string; text: string; method: string }[] = [];
    for (const file of files) {
      if (file.filename && file.content_base64) {
        try {
          const extResult = await extractText(file.filename, file.content_base64);
          extractedFiles.push({
            filename: file.filename,
            text: extResult.text,
            method: extResult.method,
          });
        } catch (err: any) {
          console.error(`File extraction failed for ${file.filename}:`, err);
          taskRecord.status = 'failed';
          await taskRecord.save();
          return c.json({ error: `File extraction failed for ${file.filename}: ${err.message}` }, 400);
        }
      }
    }

    // ── Step 5: Execute provider N times — one per file ──────────────────────
    const winnerEndpoint: string = taskRecord.selectedEndpoint;
    const category: string = taskRecord.category;
    const actualQuantity = extractedFiles.length > 0 ? extractedFiles.length : 1;

    const handlerResults: any[] = [];
    const progressLog: ProgressEntry[] = [];

    if (extractedFiles.length > 0) {
      for (let i = 0; i < extractedFiles.length; i++) {
        const singleFile = extractedFiles[i];
        const stepNum = i + 1;

        // Record "executing" step
        progressLog.push({
          step: stepNum,
          filename: singleFile.filename,
          status: 'executing',
          timestamp: new Date(),
        });

        console.log(`Executing ${winnerEndpoint} for file ${stepNum}/${extractedFiles.length}: ${singleFile.filename}`);

        try {
          const result = await invokeProviderHandler(winnerEndpoint, {
            task_description,
            files: [singleFile],
          });

          handlerResults.push(result);

          // Record "completed" step
          progressLog.push({
            step: stepNum,
            filename: singleFile.filename,
            status: 'completed',
            timestamp: new Date(),
          });
        } catch (err: any) {
          progressLog.push({
            step: stepNum,
            filename: singleFile.filename,
            status: 'failed',
            timestamp: new Date(),
          });
          throw err;
        }
      }
    } else {
      // No files — single text-only execution
      progressLog.push({ step: 1, filename: undefined, status: 'executing', timestamp: new Date() });
      console.log(`Executing ${winnerEndpoint} for text-only task`);

      try {
        const result = await invokeProviderHandler(winnerEndpoint, {
          task_description,
          files: [],
        });
        handlerResults.push(result);
        progressLog.push({ step: 1, filename: undefined, status: 'completed', timestamp: new Date() });
      } catch (err: any) {
        progressLog.push({ step: 1, filename: undefined, status: 'failed', timestamp: new Date() });
        throw err;
      }
    }

    // ── Step 6: Aggregate all results ────────────────────────────────────────
    const combinedResult = aggregateResults(category, handlerResults);
    const executionTime = Date.now() - startTime;

    // ── Step 7: Output verification ──────────────────────────────────────────
    const verification = verifyOutput(category, combinedResult);
    updateReputation(winnerEndpoint, verification.passed);
    /** Convert boolean verification.passed to a numeric quality score (0 or 1). */
    const verificationScore = verification.passed ? 1 : 0;

    // ── Step 8: Compute final pricing (use plan values, cross-check) ─────────
    const unitPrice: number = taskRecord.unitPrice ?? 0;
    const finalExecutionCost: number = parseFloat((unitPrice * actualQuantity).toFixed(2));
    const finalTotalCost: number = parseFloat((finalExecutionCost + PLATFORM_FEE).toFixed(2));

    // ── Step 9: Update Task record with all grouped-payment metadata ──────────
    taskRecord.status = 'completed';
    taskRecord.output = combinedResult;
    taskRecord.executionTime = executionTime;
    taskRecord.executionCount = actualQuantity;
    taskRecord.executionQuantity = actualQuantity;
    taskRecord.executionCost = finalExecutionCost;
    taskRecord.totalCost = finalTotalCost;
    taskRecord.verificationScore = verificationScore;
    taskRecord.verificationStatus = verification.passed ? 'passed' : 'failed';
    taskRecord.executionProgressLog = progressLog;
    // groupTransactionId and paymentMode already set in Step 3
    // individualTransactionIds: not set — requires future x402 protocol extension
    await taskRecord.save();

    // ── Step 10: Create Payment record with grouped-payment tracking ──────────
    await Payments.create({
      taskId: taskRecord._id,
      userId: user._id,
      x402TransactionId: groupTransactionId,
      amount: finalTotalCost,
      unitPrice,
      executionQuantity: actualQuantity,
      executionCost: finalExecutionCost,
      platformFee: PLATFORM_FEE,
      totalAmount: finalTotalCost,
      blockchain: 'Algorand',
      currency: 'USDC',
      status: 'completed',
      groupTransactionId,
      paymentMode: 'consolidated',
      // transactionIds: not set — requires future x402 protocol extension
    });

    // ── Step 11: Record endpoint usage ───────────────────────────────────────
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

    // ── Step 12: Update user aggregate stats ─────────────────────────────────
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
        platformFee: PLATFORM_FEE,
        totalCost: finalTotalCost,
        groupTransactionId,
        paymentMode: 'consolidated',
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
      platformFee: PLATFORM_FEE,
      totalCost: finalTotalCost,
      executionCount: actualQuantity,
      executionTime,
      verification,
      // Grouped payment metadata
      groupTransactionId,
      paymentMode: 'consolidated',
      // individualTransactionIds omitted — requires future x402 protocol extension
      executionProgressLog: progressLog,
      extracted_files: extractedFiles.map((f) => ({ filename: f.filename, method: f.method })),
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
