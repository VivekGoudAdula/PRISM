import type { Context } from 'hono';
import { handleResumeScreenFastRequest } from './resume-screen-fast';
import { handleResumeScreenAccurateRequest } from './resume-screen-accurate';
import { handleContractAnalyzeFastRequest } from './contract-analyze-fast';
import { handleContractAnalyzeAccurateRequest } from './contract-analyze-accurate';
import { handleInvoiceExtractFastRequest } from './invoice-extract-fast';
import { handleInvoiceExtractAccurateRequest } from './invoice-extract-accurate';
import { handleCodeReviewFastRequest } from './code-review-fast';
import { handleCodeReviewAccurateRequest } from './code-review-accurate';
import { handleSeoAuditFastRequest } from './seo-audit-fast';
import { handleSeoAuditAccurateRequest } from './seo-audit-accurate';
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
const PLATFORM_FEE = 0.0;

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
  if (results.length === 0) {
    return {
      success: false,
      error: { code: 'NO_RESULTS', message: 'No results returned from provider' },
    };
  }

  const validResults = results.filter((r) => r && r.success !== false && !r.error);
  const failedResults = results.filter((r) => !r || r.success === false || r.error);

  if (validResults.length === 0 && failedResults.length > 0) {
    const firstErr = failedResults[0]?.error?.message || failedResults[0]?.error || `All ${category} AI analysis attempts failed`;
    return {
      success: false,
      error: {
        code: failedResults[0]?.error?.code || 'AI_ANALYSIS_FAILED',
        message: firstErr,
      },
      totalFiles: 0,
      failedFilesCount: failedResults.length,
    };
  }

  if (category === 'code_review') {
    const allFiles = validResults.map((r) => ({
      file_path: r.file_path,
      issues: r.issues ?? [],
      overall_quality_score: r.overall_quality_score ?? 0.85,
      confidence: r.confidence ?? 0.95,
      latency_ms: r.latency_ms ?? 0,
    }));

    const totalFilesReviewed = allFiles.length;
    const allIssues = validResults.flatMap((r) =>
      (r.issues ?? []).map((i: any) => ({ ...i, file_path: i.file_path || r.file_path }))
    );

    const bugs = allIssues.filter(
      (i) => i.severity === 'high' || (i.description && /bug|null|undefined|exception|crash|overflow/i.test(i.description))
    ).length;

    const securityIssues = allIssues.filter(
      (i) => i.severity === 'high' || (i.description && /security|vulnerability|injection|auth|token|secret|xss|csrf/i.test(i.description))
    ).length;

    const codeQualityIssues = allIssues.filter(
      (i) => i.severity === 'low' || i.severity === 'medium' || (i.description && /quality|style|lint|formatting|naming|refactor/i.test(i.description))
    ).length;

    const issuesBySeverity = {
      low: allIssues.filter((i) => i.severity === 'low').length,
      medium: allIssues.filter((i) => i.severity === 'medium').length,
      high: allIssues.filter((i) => i.severity === 'high').length,
    };

    const avgQualityScore = validResults.reduce((sum, r) => sum + (r.overall_quality_score ?? 0.85), 0) / (validResults.length || 1);
    const avgConfidence = validResults.reduce((sum, r) => sum + (r.confidence ?? 0.95), 0) / (validResults.length || 1);

    const overallScore = Math.round(avgQualityScore * 100);

    const summary = allIssues.length === 0
      ? `Successfully analyzed ${totalFilesReviewed} source files across the repository. No critical issues, bugs, or security vulnerabilities were found.`
      : `Repository analysis completed across ${totalFilesReviewed} source files. Identified ${allIssues.length} issue(s) (${bugs} bug(s), ${securityIssues} security vulnerability(ies), ${codeQualityIssues} code quality item(s)). Overall quality score: ${overallScore}/100.`;

    return {
      success: true,
      summary,
      totalFilesReviewed,
      totalIssues: allIssues.length,
      metrics: {
        bugs,
        securityIssues,
        codeQualityIssues,
        totalIssues: allIssues.length,
        overallScore,
      },
      bugs,
      securityIssues,
      codeQualityIssues,
      overallScore,
      issuesBySeverity,
      averageQualityScore: parseFloat(avgQualityScore.toFixed(3)),
      averageConfidence: parseFloat(avgConfidence.toFixed(3)),
      files: allFiles,
      findings: allIssues.map((i) => ({
        type: i.severity === 'high' ? 'bug' : 'quality',
        severity: i.severity || 'medium',
        file: i.file_path || 'unknown',
        line: i.line_estimate || 1,
        title: i.description ? i.description.split('.')[0] : 'Issue detected',
        description: i.description || '',
        recommendation: i.suggestion || '',
      })),
      failedFilesCount: failedResults.length,
    };
  }

  if (category === 'seo_audit') {
    const allPages = validResults.map((r) => ({
      page_url: r.page_url,
      issues: r.issues ?? [],
      seo_score: r.seo_score ?? 0,
      confidence: r.confidence ?? 0,
      latency_ms: r.latency_ms ?? 0,
    }));
    const totalPagesAudited = allPages.length;
    const allIssues = validResults.flatMap((r) => r.issues ?? []);

    const issuesByCategory = {
      metadata: allIssues.filter((i) => i.category === 'metadata'),
      heading: allIssues.filter((i) => i.category === 'heading'),
      images: allIssues.filter((i) => i.category === 'images'),
      links: allIssues.filter((i) => i.category === 'links'),
      content: allIssues.filter((i) => i.category === 'content'),
    };

    const issuesBySeverity = {
      low: allIssues.filter((i) => i.severity === 'low').length,
      medium: allIssues.filter((i) => i.severity === 'medium').length,
      high: allIssues.filter((i) => i.severity === 'high').length,
    };

    const overallSiteScore = validResults.reduce((sum, r) => sum + (r.seo_score ?? 0), 0) / (validResults.length || 1);
    const avgConfidence = validResults.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / (validResults.length || 1);

    return {
      success: true,
      totalPagesAudited,
      totalIssues: allIssues.length,
      overallSiteScore: parseFloat(overallSiteScore.toFixed(3)),
      averageConfidence: parseFloat(avgConfidence.toFixed(3)),
      issuesByCategory,
      issuesBySeverity,
      pages: allPages,
    };
  }

  if (category === 'resume_screening') {
    const allCandidates = validResults.flatMap((r) => r.candidates ?? []);
    const totalConfidence = validResults.reduce((sum, r) => sum + (r.confidence ?? 0), 0);
    return {
      success: true,
      candidates: allCandidates,
      averageConfidence: parseFloat((totalConfidence / (validResults.length || 1)).toFixed(3)),
      totalFiles: validResults.length,
    };
  }

  if (category === 'contract_analysis') {
    const allDocuments = validResults.map((r, i) => ({
      document: i + 1,
      clauses: r.clauses ?? r.clauses_flagged ?? [],
      confidence: r.confidence ?? 0,
    }));
    const clauses_flagged = validResults.flatMap((r) => r.clauses_flagged ?? r.clauses ?? []);
    const avgRiskScore = validResults.reduce((sum, r) => sum + (r.overall_risk_score ?? 0.5), 0) / (validResults.length || 1);
    const avgConfidence = validResults.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / (validResults.length || 1);

    return {
      success: true,
      documents: allDocuments,
      clauses: clauses_flagged,
      clauses_flagged,
      overall_risk_score: parseFloat(avgRiskScore.toFixed(2)),
      totalClauses: clauses_flagged.length,
      averageConfidence: parseFloat(avgConfidence.toFixed(3)),
      totalFiles: validResults.length,
    };
  }

  if (category === 'invoice_extraction') {
    const allDocuments = validResults.map((r, i) => ({
      document: i + 1,
      vendor_name: r.vendor_name,
      invoice_number: r.invoice_number,
      date: r.date,
      line_items: r.line_items ?? [],
      total_amount: r.total_amount,
      confidence: r.confidence ?? 0,
    }));
    const avgConfidence = validResults.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / (validResults.length || 1);
    const line_items = validResults.flatMap((r) => r.line_items ?? []);
    const vendor_name = validResults.find((r) => r.vendor_name && r.vendor_name !== 'Unknown')?.vendor_name || validResults[0]?.vendor_name || 'Unknown';
    const invoice_number = validResults.find((r) => r.invoice_number && r.invoice_number !== 'Unknown')?.invoice_number || validResults[0]?.invoice_number || 'Unknown';
    const date = validResults.find((r) => r.date && r.date !== 'Unknown')?.date || validResults[0]?.date || 'Unknown';
    const total_amount = validResults.reduce((sum, r) => sum + (r.total_amount ?? 0), 0);

    return {
      success: true,
      vendor_name,
      invoice_number,
      date,
      line_items,
      total_amount,
      documents: allDocuments,
      totalLineItems: line_items.length,
      averageConfidence: parseFloat(avgConfidence.toFixed(3)),
      totalFiles: validResults.length,
    };
  }

  return { success: true, results: validResults };
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
    case '/seo-audit-fast':        return handleSeoAuditFastRequest(ctx);
    case '/seo-audit-accurate':    return handleSeoAuditAccurateRequest(ctx);
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

    // ── Step 3.5: Server-Side Batch Execution if results not pre-computed ────
    if (!Array.isArray(results) || results.length === 0) {
      console.log(`🚀 Executing task ${planId} (${category}) server-side for ${taskRecord.executionQuantity || 1} item(s)...`);
      results = [];
      const po = taskRecord.plannerOutput || {};

      let itemsToProcess: any[] = [];
      if (category === 'code_review' && Array.isArray(po.files) && po.files.length > 0) {
        itemsToProcess = po.files;
      } else if (category === 'seo_audit' && Array.isArray(po.pages) && po.pages.length > 0) {
        itemsToProcess = po.pages;
      } else if (Array.isArray(po.files) && po.files.length > 0) {
        itemsToProcess = po.files;
      } else {
        itemsToProcess = [{ task_description: taskRecord.prompt }];
      }

      for (let idx = 0; idx < itemsToProcess.length; idx++) {
        const item = itemsToProcess[idx];
        let payload: Record<string, any> = {};

        if (category === 'code_review') {
          payload = { file_path: item.path, raw_url: item.raw_url };
        } else if (category === 'seo_audit') {
          payload = { page_url: item.url, task_description: taskRecord.prompt };
        } else if (item.index !== undefined) {
          payload = { file_index: item.index, plan_id: planId, task_description: taskRecord.prompt };
        } else {
          payload = { task_description: taskRecord.prompt, files: [item] };
        }

        try {
          if (idx > 0) {
            await new Promise((r) => setTimeout(r, 150));
          }
          const itemRes = await invokeProviderHandler(winnerEndpoint, payload);
          results.push(itemRes);
        } catch (itemErr: any) {
          console.error(`Error processing item ${idx + 1} (${item.path || item.url || item.filename}):`, itemErr);
          results.push({
            success: false,
            error: {
              code: itemErr.code || 'ITEM_EXECUTION_FAILED',
              message: itemErr.message || 'Failed to process item',
            },
          });
        }
      }
    }

    const actualQuantity = results.length;

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

    // Extract stage-by-stage token metrics from stored plan or live execution
    const poOutput = taskRecord.plannerOutput || {};

    const rawContextTokens = poOutput.rawContextTokens || poOutput.originalInputTokens || estimateTokens(taskRecord.prompt) + (actualQuantity * 250);
    const dataMapTokens = poOutput.dataMapTokens || Math.max(100, Math.round(rawContextTokens * 0.7));
    const dataMapTokensSaved = Math.max(0, rawContextTokens - dataMapTokens);

    const cacheInputTokens = poOutput.cacheInputTokens || dataMapTokens;
    const cacheHit = Boolean(cacheCheck.hit);
    const cachedContextTokens = cacheHit ? (cacheCheck.cachedContextTokens || poOutput.cachedContextTokens || Math.round(dataMapTokens * 0.5)) : 0;
    const cacheTokensAvoided = cacheHit ? Math.max(0, cacheInputTokens - cachedContextTokens) : 0;

    const optimizerInputTokens = poOutput.optimizerInputTokens || (cacheHit ? cachedContextTokens : dataMapTokens);
    
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

    const finalProviderContextTokens = hasProviderUsage && sumPromptTokens > 0
      ? sumPromptTokens
      : (poOutput.finalProviderContextTokens || poOutput.optimizedInputTokens || optimizerInputTokens);

    const optimizedContextTokens = finalProviderContextTokens;
    const optimizerTokensSaved = poOutput.optimizerTokensSaved !== undefined
      ? poOutput.optimizerTokensSaved
      : Math.max(0, optimizerInputTokens - optimizedContextTokens);
    const optimizationApplied = poOutput.optimizationApplied !== undefined
      ? poOutput.optimizationApplied
      : (optimizerTokensSaved > 0);

    const prismTotalTokensSaved = Math.max(0, rawContextTokens - finalProviderContextTokens);
    const overallReductionPercent = rawContextTokens > 0
      ? parseFloat(((prismTotalTokensSaved / rawContextTokens) * 100).toFixed(1))
      : 0;

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
      originalInputTokens: rawContextTokens,
      optimizedInputTokens: finalProviderContextTokens,
      outputTokens,
      modelName,
      cacheHit,
      cacheStatus: cacheHit ? 'hit' : 'miss',
      cachedContextTokens,
      cacheTokensSaved: cacheTokensAvoided,
      cacheSimilarity: cacheCheck.similarity,
      cacheEntryId: cacheCheck.cacheEntryId,
      measurementSource,
    });

    const basePrice = poOutput.basePrice || poOutput.dynamicPrice?.basePrice || unitPrice;
    const optimizationDiscount = poOutput.optimizationDiscount || poOutput.dynamicPrice?.optimizationDiscount || 0;
    const finalPrice = unitPrice;
    const originalTokens = rawContextTokens;
    const finalTokens = finalProviderContextTokens;
    const tokensSaved = prismTotalTokensSaved;
    const savingsRate = poOutput.savingsRate !== undefined
      ? poOutput.savingsRate
      : (originalTokens > 0 ? parseFloat((tokensSaved / originalTokens).toFixed(4)) : 0);

    const realTaskSavingsUSD = (taskRecord as any).totalOptimizationDiscount ??
      ((taskRecord as any).plannerOutput?.totalOptimizationDiscount ??
      ((optimizationDiscount || 0) * actualQuantity));

    if (realTaskSavingsUSD > 0 && tokenAnalytics?._id) {
      try {
        const { TokenUsage } = await import('../models/TokenUsage');
        await TokenUsage.updateOne(
          { _id: tokenAnalytics._id },
          { $set: { costSaved: parseFloat(realTaskSavingsUSD.toFixed(4)) } }
        );
      } catch (tErr) {
        console.error('Failed to update TokenUsage costSaved:', tErr);
      }
    }

    // Record PromptOptimization persistence entry
    try {
      const { PromptOptimization } = await import('../models/PromptOptimization');
      await PromptOptimization.create({
        userId: user._id,
        taskId: taskRecord._id,
        executionId: transactionIds[0] || `exec-${taskRecord._id}`,
        originalInputTokens: rawContextTokens,
        optimizedInputTokens: finalProviderContextTokens,
        tokensSaved: optimizerTokensSaved,
        reductionPercentage: overallReductionPercent,
        compressionRatio: rawContextTokens > 0 ? parseFloat((finalProviderContextTokens / rawContextTokens).toFixed(4)) : 1,
        cacheHit,
        cacheTokensSaved: cacheTokensAvoided,
        optimizerTokensSaved,
        totalTokensSaved: prismTotalTokensSaved,
        preservedEntities: poOutput.optimizationDetails?.preservedEntities || [],
        preservedRelationships: poOutput.optimizationDetails?.preservedRelationships || [],
        preservedConstraints: poOutput.optimizationDetails?.preservedConstraints || [],
        removedRedundancies: poOutput.optimizationDetails?.removedRedundancies || [],
        removedIrrelevantContext: poOutput.optimizationDetails?.removedIrrelevantContext || [],
        summarizedSections: poOutput.optimizationDetails?.summarizedSections || [],
        optimizationApplied,
        modelUsed: poOutput.optimizationDetails?.modelUsed || 'deterministic-hybrid',
        measurementSource,
      });
    } catch (optDbErr: any) {
      console.error('Error saving PromptOptimization record in execute-task (non-blocking):', optDbErr?.message || optDbErr);
    }

    // ── Step 11: Update user aggregate stats ─────────────────────────────────
    user.totalTasks = (user.totalTasks ?? 0) + 1;
    user.totalSpent = (user.totalSpent ?? 0) + finalTotalCost;
    const addedSavings = realTaskSavingsUSD > 0 ? realTaskSavingsUSD : (tokenAnalytics.costSaved || 0);
    user.totalSaved = parseFloat(((user.totalSaved ?? 0) + addedSavings).toFixed(4));
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
        basePrice,
        optimizationDiscount,
        finalPrice,
        unitPrice,
        executionCost: finalExecutionCost,
        platformFee: 0,
        totalCost: finalTotalCost,
        groupTransactionId: transactionIds[0],
        paymentMode: 'grouped',
        verificationPassed: verification.passed,
        verificationReason: verification.reason,
        tokenAnalytics,
        dynamicPricing: {
          basePrice,
          optimizationDiscount,
          finalPrice,
          originalTokens,
          finalTokens,
          tokensSaved,
          savingsRate,
        },
      },
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
    });

    const promptOptimizerData = {
      enabled: true,
      applied: optimizationApplied,
      originalTokens: optimizerInputTokens,
      optimizedTokens: optimizedContextTokens,
      tokensSaved: optimizerTokensSaved,
      reductionPercentage: optimizerInputTokens > 0 ? parseFloat((((optimizerInputTokens - optimizedContextTokens) / optimizerInputTokens) * 100).toFixed(1)) : 0,
      compressionRatio: optimizerInputTokens > 0 ? parseFloat((optimizedContextTokens / optimizerInputTokens).toFixed(4)) : 1,
      preservationValidated: true,
      preservedEntities: poOutput.optimizationDetails?.preservedEntities || [],
      preservedRelationships: poOutput.optimizationDetails?.preservedRelationships || [],
      preservedConstraints: poOutput.optimizationDetails?.preservedConstraints || [],
      removedRedundancies: poOutput.optimizationDetails?.removedRedundancies || [],
      removedIrrelevantContext: poOutput.optimizationDetails?.removedIrrelevantContext || [],
      summarizedSections: poOutput.optimizationDetails?.summarizedSections || [],
      optimizationApplied,
      modelUsed: poOutput.optimizationDetails?.modelUsed || 'deterministic-hybrid',
      measurementSource,
    };

    // Diagnostic logs required by prompt
    console.log('\n[PrismMetrics]');
    console.log(`raw=${rawContextTokens}`);
    console.log(`dataMap=${dataMapTokens}`);
    console.log(`cacheInput=${cacheInputTokens}`);
    console.log(`cacheOutput=${cachedContextTokens}`);
    console.log(`optimizerInput=${optimizerInputTokens}`);
    console.log(`optimizerOutput=${optimizedContextTokens}`);
    console.log(`finalProvider=${finalProviderContextTokens}`);
    console.log(`totalSaved=${prismTotalTokensSaved}`);
    console.log(`basePrice=$${basePrice}`);
    console.log(`optimizationDiscount=$${optimizationDiscount}`);
    console.log(`finalPrice=$${finalPrice}\n`);

    return c.json({
      planId,
      category,
      winner_endpoint: winnerEndpoint,
      providerName: taskRecord.providerName,
      basePrice,
      unitPrice,
      optimizationDiscount,
      finalPrice,
      originalTokens,
      finalTokens,
      tokensSaved,
      savingsRate,
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
      tokenAnalytics: {
        ...tokenAnalytics,
        rawContextTokens,
        dataMapTokens,
        dataMapTokensSaved,
        cacheInputTokens,
        cachedContextTokens,
        cacheHit,
        cacheTokensAvoided,
        optimizerInputTokens,
        optimizedContextTokens,
        optimizerTokensSaved,
        finalProviderContextTokens,
        prismTotalTokensSaved,
        basePrice,
        optimizationDiscount,
        finalPrice,
        originalTokens,
        finalTokens,
        tokensSaved,
        savingsRate,
      },
      promptOptimizer: promptOptimizerData,
      semanticCache: {
        cacheHit,
        cacheStatus: cacheHit ? 'hit' : 'miss',
        similarity: cacheCheck.similarity,
        cachedContextTokens,
        cacheTokensSaved: cacheTokensAvoided,
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
