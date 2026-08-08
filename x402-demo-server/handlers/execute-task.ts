import type { Context } from 'hono';
import { handleResumeScreenFastRequest } from './resume-screen-fast';
import { handleResumeScreenAccurateRequest } from './resume-screen-accurate';
import { handleContractAnalyzeFastRequest } from './contract-analyze-fast';
import { handleContractAnalyzeAccurateRequest } from './contract-analyze-accurate';
import { handleInvoiceExtractFastRequest } from './invoice-extract-fast';
import { handleInvoiceExtractAccurateRequest } from './invoice-extract-accurate';
import { handleCodeReviewFastRequest } from './code-review-fast';
import { handleCodeReviewAccurateRequest } from './code-review-accurate';
import { verifyOutput } from './lib/verify-output';
import { updateReputation } from './lib/reputation-store';
import { extractText } from './lib/extract-document';
import { Task } from '../models/Task';
import { Payments } from '../models/Payments';
import { EndpointUsage } from '../models/EndpointUsage';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import { recordExecutionMetrics, estimateTokens } from '../services/tokenAnalytics';
import mongoose from 'mongoose';

/** Fixed platform fee added on top of execution cost, in USDC */
const PLATFORM_FEE = 0.05;

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

  if (category === 'code_review') {
    const allFiles = results.map((r) => ({
      file_path: r.file_path,
      issues: r.issues ?? [],
      overall_quality_score: r.overall_quality_score ?? 0,
      confidence: r.confidence ?? 0,
      latency_ms: r.latency_ms ?? 0,
    }));
    const totalFilesReviewed = allFiles.length;
    const allIssues = results.flatMap((r) => r.issues ?? []);
    const issuesBySeverity = {
      low: allIssues.filter((i) => i.severity === 'low').length,
      medium: allIssues.filter((i) => i.severity === 'medium').length,
      high: allIssues.filter((i) => i.severity === 'high').length,
    };
    const avgQualityScore = results.reduce((sum, r) => sum + (r.overall_quality_score ?? 0), 0) / (results.length || 1);
    const avgConfidence = results.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / (results.length || 1);

    return {
      totalFilesReviewed,
      totalIssues: allIssues.length,
      issuesBySeverity,
      averageQualityScore: parseFloat(avgQualityScore.toFixed(3)),
      averageConfidence: parseFloat(avgConfidence.toFixed(3)),
      files: allFiles,
    };
  }

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
      vendor_name: r.vendor_name,
      invoice_number: r.invoice_number,
      date: r.date,
      line_items: r.line_items ?? [],
      total_amount: r.total_amount,
      confidence: r.confidence ?? 0,
    }));
    const totalLineItems = allDocuments.reduce((sum, d) => sum + d.line_items.length, 0);
    const avgConfidence = results.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / results.length;
    const line_items = results.flatMap((r) => r.line_items ?? []);
    const vendor_name = results.find((r) => r.vendor_name && r.vendor_name !== 'Unknown')?.vendor_name || results[0]?.vendor_name || 'Unknown';
    const invoice_number = results.find((r) => r.invoice_number && r.invoice_number !== 'Unknown')?.invoice_number || results[0]?.invoice_number || 'Unknown';
    const date = results.find((r) => r.date && r.date !== 'Unknown')?.date || results[0]?.date || 'Unknown';
    const total_amount = results.reduce((sum, r) => sum + (r.total_amount ?? 0), 0);

    return {
      vendor_name,
      invoice_number,
      date,
      line_items,
      total_amount,
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
    case '/code-review-fast':      return handleCodeReviewFastRequest(ctx);
    case '/code-review-accurate':  return handleCodeReviewAccurateRequest(ctx);
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
    if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
      return c.json({ error: `Invalid or missing planId parameter: ${planId}` }, 400);
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
    let { results = [], transactionIds = [], status, error } = body;

    if (status === 'failed' || error) {
      console.log('🔍 [DIAGNOSTIC /execute-task 400]', {
        planId,
        status,
        error,
        body
      });
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

    const winnerEndpoint: string = taskRecord.selectedEndpoint;
    const category: string = taskRecord.category;

    /**
     * Server-side fallback execution path.
     *
     * Triggered when the client sent no results but the plan has stored files.
     * Covers two patterns:
     *  - code_review: files stored as {path, raw_url} (GitHub refs)
     *  - resume / contract / invoice: files stored as {filename, content_base64} (uploads)
     *
     * In both cases we invoke the provider handler directly (no x402) so results
     * can still be aggregated and saved — the x402 payments already happened per
     * individual file call on the client side.
     */
    if (results.length === 0 && Array.isArray(taskRecord.plannerOutput?.files)) {
      const storedFiles: any[] = taskRecord.plannerOutput.files;
      const isCodeReview = category === 'code_review';
      console.log(`Fallback: running ${storedFiles.length} stored files for '${category}' via ${winnerEndpoint}...`);

      const executedResults: any[] = [];
      const BATCH_SIZE = 5;

      for (let i = 0; i < storedFiles.length; i += BATCH_SIZE) {
        const chunk = storedFiles.slice(i, i + BATCH_SIZE);
        const chunkResults = await Promise.all(
          chunk.map((file) => {
            // Build the correct payload for each category type
            const handlerBody = isCodeReview
              ? { file_path: file.path, raw_url: file.raw_url }
              : {
                  task_description: taskRecord.prompt,
                  files: [{ filename: file.filename, content_base64: file.content_base64 }],
                };

            return invokeProviderHandler(winnerEndpoint, handlerBody).catch((err) => {
              const label = isCodeReview ? file.path : file.filename;
              console.warn(`Fallback: file processing failed for ${label}:`, err?.message || err);
              // Safe fallback so one failure does not abort the entire batch
              return isCodeReview
                ? { file_path: file.path, issues: [], overall_quality_score: 0.8, confidence: 0.7 }
                : { candidates: [], confidence: 0 };
            });
          })
        );
        executedResults.push(...chunkResults);
      }
      results = executedResults;
    }

    const actualQuantity = results.length > 0 ? results.length : 1;

    // ── Step 4: Aggregate results ────────────────────────────────────────────
    const combinedResult = aggregateResults(category, results);
    const executionTime = Date.now() - startTime;

    // ── Step 5: Compute final pricing (must be declared before verification/refund block)
    const unitPrice: number = taskRecord.unitPrice ?? 0;
    const finalExecutionCost: number = parseFloat((unitPrice * actualQuantity).toFixed(2));
    const finalTotalCost: number = finalExecutionCost; // No platform fee on independent calls

    // ── Step 6: Output verification ──────────────────────────────────────────
    const verification = verifyOutput(category, combinedResult);
    // await so the MongoDB reputation write completes before we continue
    await updateReputation(winnerEndpoint, verification.passed);
    const verificationScore = verification.passed ? 1 : 0;

    let refund: { issued: boolean; amount: number; tx_id: string } | undefined = undefined;

    if (!verification.passed) {
      const { issueRefund } = await import('./lib/refund');
      const refundRecipient = user.walletAddress || c.req.header('x-payer-address') || c.req.header('payment-sender') || '';
      // finalTotalCost is now in scope (declared above)
      refund = await issueRefund(refundRecipient, finalTotalCost, taskRecord._id.toString(), verification.reason);

      taskRecord.refundIssued = true;
      taskRecord.refundTxId = refund.tx_id;
      taskRecord.refundAmount = refund.amount;
    }

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
    const progressLog: ProgressEntry[] = results.map((r: any, i: number) => ({
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

    // ── Step 10: Check Semantic Cache & Record Central Token Analytics ──────
    const { findSimilarContext, saveContext } = await import('../services/semanticCache');
    const cacheCheck = await findSimilarContext({
      userId: user._id,
      taskType: category,
      prompt: taskRecord.prompt,
      files: taskRecord.plannerOutput?.files || [],
    });

    if (!cacheCheck.hit) {
      // Asynchronously store semantic context representation on MISS
      saveContext({
        userId: user._id,
        taskType: category,
        prompt: taskRecord.prompt,
        files: taskRecord.plannerOutput?.files || [],
        semanticContext: combinedResult,
      }).catch(() => {});
    }

    let origInputTokens = taskRecord.plannerOutput?.originalInputTokens;
    if (!origInputTokens || origInputTokens <= 0) {
      origInputTokens = estimateTokens(taskRecord.prompt) + (actualQuantity * 250);
    }
    
    // Check if provider usage metrics exist in results
    let sumPromptTokens = 0;
    let sumCompletionTokens = 0;
    let hasProviderUsage = false;

    for (const res of results) {
      if (res?.usage?.prompt_tokens !== undefined || res?.usage?.completion_tokens !== undefined) {
        hasProviderUsage = true;
        sumPromptTokens += res.usage?.prompt_tokens || 0;
        sumCompletionTokens += res.usage?.completion_tokens || 0;
      }
    }

    const optInputTokens = hasProviderUsage && sumPromptTokens > 0 
      ? sumPromptTokens 
      : (cacheCheck.hit ? cacheCheck.cachedContextTokens : origInputTokens);
      
    const outputTokens = hasProviderUsage && sumCompletionTokens > 0 
      ? sumCompletionTokens 
      : estimateTokens(JSON.stringify(combinedResult));

    const modelName = winnerEndpoint.includes('accurate') ? 'llama-3.3-70b-versatile' : 'llama3-8b-8192';
    const measurementSource = hasProviderUsage ? 'provider_usage' : 'estimated';

    const tokenAnalytics = await recordExecutionMetrics({
      userId: user._id,
      taskId: taskRecord._id,
      executionId: transactionIds[0] || `exec-${taskRecord._id}-${Date.now()}`,
      endpointId: winnerEndpoint,
      endpointPath: winnerEndpoint,
      providerName: taskRecord.providerName || (winnerEndpoint.includes('accurate') ? 'Groq-70B' : 'Groq-Llama3'),
      originalInputTokens: origInputTokens,
      optimizedInputTokens: optInputTokens,
      outputTokens,
      modelName,
      cacheHit: cacheCheck.hit,
      cacheStatus: cacheCheck.hit ? 'hit' : 'miss',
      cachedContextTokens: cacheCheck.cachedContextTokens,
      cacheTokensSaved: cacheCheck.hit ? Math.max(0, origInputTokens - cacheCheck.cachedContextTokens) : 0,
      cacheSimilarity: cacheCheck.similarity,
      cacheEntryId: cacheCheck.cacheEntryId,
      measurementSource,
    });

    // ── Step 11: Update user aggregate stats ─────────────────────────────────
    user.totalTasks = (user.totalTasks ?? 0) + 1;
    user.totalSpent = (user.totalSpent ?? 0) + finalTotalCost;
    user.totalSaved = (user.totalSaved ?? 0) + tokenAnalytics.costSaved;
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
        tokenAnalytics,
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
      refund,
      groupTransactionId: transactionIds[0] || 'grouped-independent',
      paymentMode: 'grouped',
      executionProgressLog: progressLog,
      result: combinedResult,
      tokenAnalytics,
      semanticCache: {
        cacheHit: cacheCheck.hit,
        cacheStatus: cacheCheck.hit ? 'hit' : 'miss',
        similarity: cacheCheck.similarity,
        cachedContextTokens: cacheCheck.cachedContextTokens,
        cacheTokensSaved: cacheCheck.hit ? Math.max(0, origInputTokens - cacheCheck.cachedContextTokens) : 0,
        cacheEntryId: cacheCheck.cacheEntryId || '',
      },
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
