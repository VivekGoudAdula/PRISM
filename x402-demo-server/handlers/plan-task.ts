import { config } from 'dotenv';
import type { Context } from 'hono';
import { handleClassifyTaskRequest } from './classify-task';
import { handleSelectEndpointRequest } from './select-endpoint';
import { fetchRepoFiles, extractGitHubUrl } from './lib/fetch-repo';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';

config();

/** Fixed platform fee added on top of execution cost, in USDC */
const PLATFORM_FEE = 0.05;

/** Human-readable provider display names keyed by endpoint path */
const PROVIDER_NAMES: Record<string, string> = {
  '/resume-screen-fast': 'ResumeAI Fast',
  '/resume-screen-accurate': 'ResumeAI Accurate',
  '/contract-analyze-fast': 'ContractAI Fast',
  '/contract-analyze-accurate': 'ContractAI Accurate',
  '/invoice-extract-fast': 'InvoiceAI Fast',
  '/invoice-extract-accurate': 'InvoiceAI Accurate',
  '/code-review-fast': 'CodeAI Fast',
  '/code-review-accurate': 'CodeAI Accurate',
};

/**
 * POST /plan-task (PUBLIC — no payment required)
 *
 * Phase 1 of the new execution pipeline.
 * Classifies the task, discovers providers, selects the winner, computes
 * dynamic pricing (quantity × unitPrice + platformFee), saves a 'planned'
 * Task record, and returns a full ExecutionPlan including a planId.
 *
 * The client must present this planId when calling POST /execute-task.
 */
export async function handlePlanTaskRequest(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    // files may include content_base64 for non-code-review categories (resume, contract, invoice)
    const { task_description, files = [], has_prior_task_result = false } = body;

    if (!task_description || typeof task_description !== 'string') {
      return c.json({ error: 'task_description is required' }, 400);
    }

    // Derive has_files from the actual files array
    const has_files: boolean = Array.isArray(files) && files.length > 0;

    // ── Step 1: Classify the task ────────────────────────────────────────────
    // Pass file + history context so the classifier can short-circuit without calling LLM
    const mockCtxClassify = {
      req: {
        json: async () => ({
          task_description,
          has_files,
          has_prior_task_result,
        }),
      },
      json: (data: any) => data,
    } as unknown as Context;

    const classifyResult: any = await handleClassifyTaskRequest(mockCtxClassify);
    const category: string = classifyResult?.category || 'unsupported';

    // ── Pre-Classification Branch 1: Conversational Chat ─────────────────────
    if (category === 'conversational') {
      const { generateChatReply } = await import('./chat-reply');
      const reply = await generateChatReply(task_description);
      return c.json({
        category: 'conversational',
        reply,
        message: reply,
        isChat: true,
      });
    }

    // ── Pre-Classification Branch 2: Unsupported Task ────────────────────────
    if (!classifyResult || classifyResult.error || category === 'unsupported') {
      console.log('🔍 [DIAGNOSTIC /plan-task 400]', {
        task_description,
        classifyResult,
        reason: 'Task type is unsupported or classification failed'
      });
      return c.json({
        category: 'unsupported',
        error: "I'm not sure what you'd like done — try something like 'screen this resume for a backend role' or 'extract data from this invoice.'",
        message: "I'm not sure what you'd like done — try something like 'screen this resume for a backend role' or 'extract data from this invoice.'",
        details: classifyResult,
      }, 400);
    }

    // ── Step 2: Discover and rank providers ──────────────────────────────────
    const mockCtxSelect = {
      req: { json: async () => ({ category }) },
      json: (data: any) => data,
    } as unknown as Context;

    const selectResult: any = await handleSelectEndpointRequest(mockCtxSelect);

    if (!selectResult || selectResult.error || !selectResult.winner) {
      return c.json({ error: 'Endpoint selection failed', details: selectResult }, 500);
    }

    const winner = selectResult.winner;
    const allCandidates = selectResult.candidates || [];

    // ── Step 3: Determine execution quantity & repo ingestion ───────────────
    let repoFilesData: { files: any[]; skipped: number; capped: boolean; total_files_found: number; owner?: string; repo?: string; branch?: string } | null = null;
    let executionQuantity: number = 1;

    if (category === 'code_review') {
      const repoUrl = extractGitHubUrl(task_description);
      if (!repoUrl) {
        return c.json({
          category: 'code_review',
          error: 'No valid GitHub repository URL found in task description.',
        }, 400);
      }
      try {
        repoFilesData = await fetchRepoFiles(repoUrl);
        executionQuantity = repoFilesData.files.length;
      } catch (err: any) {
        console.error('Failed to fetch GitHub repo files:', err);

        // Detect rate-limit error specifically and show a clear, actionable message
        const msg: string = err.message || '';
        const isRateLimit = msg.toLowerCase().includes('rate limit') || msg.includes('403') || msg.includes('429');
        const userMessage = isRateLimit
          ? `⚠️ GitHub API rate limit hit — you've submitted this repository too many times in a short period. Please wait a few minutes and try again. Tip: adding a GITHUB_TOKEN to the server increases the limit from 60 to 5,000 requests/hour.`
          : `Failed to access the GitHub repository: ${msg}`;

        return c.json({
          category: 'code_review',
          error: userMessage,
          message: userMessage,
        }, 400);
      }
    } else {
      // 1 execution unit = 1 file. If no files attached, treat as 1 unit.
      executionQuantity = files.length > 0 ? files.length : 1;
    }

    // For non-code-review categories: store uploaded file content in the plan so that
    // per-file x402 calls can use lightweight {file_index, plan_id} references.
    // This avoids sending large base64 payloads through the x402 middleware on every call.
    const uploadedFiles = (category !== 'code_review' && files.length > 0)
      ? files.map((f: any, idx: number) => ({
          index: idx,
          filename: f.filename || `file-${idx + 1}`,
          content_base64: f.content_base64 || '',
        }))
      : [];

    // ── Step 4: Compute dynamic pricing ─────────────────────────────────────
    const unitPrice: number = winner.price;
    const executionCost: number = parseFloat((unitPrice * executionQuantity).toFixed(2));
    const totalCost: number = parseFloat((executionCost + PLATFORM_FEE).toFixed(2));

    // ── Step 5: Derive metadata ──────────────────────────────────────────────
    // Latency per unit: accurate models ~2200 ms, fast models ~800 ms
    const latencyPerUnit = winner.endpoint_path.includes('accurate') ? 2200 : 800;
    const estimatedTimeSeconds = Math.ceil((executionQuantity * latencyPerUnit) / 1000);
    const estimatedAccuracy: number = winner.confidence ?? 0;
    const providerName: string = PROVIDER_NAMES[winner.endpoint_path] || winner.endpoint_path;

    const cap_message = repoFilesData?.capped
      ? `This repo has ${repoFilesData.total_files_found} reviewable files. Reviewing the ${repoFilesData.files.length} highest-priority source files first (${repoFilesData.skipped} skipped).`
      : undefined;

    // ── Step 6: Resolve the user (with guest fallback) ───────────────────────
    let userId: any = null;
    const tokenUser = c.get('user' as any);
    if (tokenUser?.userId) {
      const user = await User.findById(tokenUser.userId);
      if (user) userId = user._id;
    }
    if (!userId) {
      let guestUser = await User.findOne({ email: 'guest@prism.ai' });
      if (!guestUser) {
        guestUser = await User.create({
          fullName: 'Guest User',
          email: 'guest@prism.ai',
          passwordHash: 'guest-hashed-pwd',
          role: 'user',
        });
      }
      userId = guestUser._id;
    }

    // ── Step 7: Persist the plan as a 'planned' Task document ────────────────
    const taskRecord = await Task.create({
      userId,
      prompt: task_description,
      category,
      status: 'planned',
      selectedEndpoint: winner.endpoint_path,
      allCandidateEndpoints: allCandidates,
      endpointChosenReason: `Score-based routing: confidence=${winner.confidence}, unitPrice=$${unitPrice}`,
      plannerOutput: {
        ...classifyResult,
        ...(repoFilesData ? {
          files: repoFilesData.files,
          skipped: repoFilesData.skipped,
          capped: repoFilesData.capped,
          total_files_found: repoFilesData.total_files_found,
          cap_message,
        } : {}),
        // Store uploaded file content for resume/contract/invoice so per-file x402 calls
        // can use lightweight references instead of re-sending large base64 payloads.
        ...(uploadedFiles.length > 0 ? { files: uploadedFiles } : {}),
      },
      providerName,
      unitPrice,
      executionQuantity,
      executionCost,
      platformFee: PLATFORM_FEE,
      totalCost,
      endpointCost: unitPrice,
    });

    await AuditLog.create({
      userId,
      action: 'Task Planned',
      details: {
        taskId: taskRecord._id,
        category,
        providerName,
        unitPrice,
        executionQuantity,
        executionCost,
        platformFee: PLATFORM_FEE,
        totalCost,
      },
      ipAddress: c.req.header('x-forwarded-for') || '127.0.0.1',
    });

    // Return the full execution plan.
    // NOTE: for non-code-review categories, we include a lightweight files array
    // (index + filename only, NO base64) so the client can build the payment preview
    // and loop per-file x402 calls using file_index references.
    const uploadedFilesMetadata = uploadedFiles.map(({ index, filename }: { index: number; filename: string }) => ({ index, filename }));

    return c.json({
      planId: taskRecord._id.toString(),
      category,
      providerName,
      endpointPath: winner.endpoint_path,
      unitPrice,
      executionQuantity,
      executionCost,
      platformFee: PLATFORM_FEE,
      totalCost,
      estimatedTimeSeconds,
      estimatedAccuracy,
      candidates: allCandidates,
      ...(repoFilesData ? {
        files: repoFilesData.files,
        skipped: repoFilesData.skipped,
        capped: repoFilesData.capped,
        total_files_found: repoFilesData.total_files_found,
        cap_message,
      } : {}),
      // Include uploaded file metadata (no base64) so the client knows which files are stored
      ...(uploadedFilesMetadata.length > 0 ? { uploadedFiles: uploadedFilesMetadata } : {}),
    });
  } catch (err: any) {
    console.error('Error in plan-task handler:', err);
    return c.json({ error: 'Internal server error', message: err.message }, 500);
  }
}
