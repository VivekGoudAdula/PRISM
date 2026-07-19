import { config } from 'dotenv';
import type { Context } from 'hono';
import { handleClassifyTaskRequest } from './classify-task';
import { handleSelectEndpointRequest } from './select-endpoint';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';

config();

/** Fixed platform fee added on top of execution cost, in USDC */
const PLATFORM_FEE = 0.75;

/** Human-readable provider display names keyed by endpoint path */
const PROVIDER_NAMES: Record<string, string> = {
  '/resume-screen-fast': 'ResumeAI Fast (Groq Llama-3)',
  '/resume-screen-accurate': 'ResumeAI Accurate (Groq 70B)',
  '/contract-analyze-fast': 'ContractAI Fast (Groq Llama-3)',
  '/contract-analyze-accurate': 'ContractAI Accurate (Groq 70B)',
  '/invoice-extract-fast': 'InvoiceAI Fast (Groq Llama-3)',
  '/invoice-extract-accurate': 'InvoiceAI Accurate (Groq 70B)',
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
    const { task_description, files = [] } = body;

    if (!task_description || typeof task_description !== 'string') {
      return c.json({ error: 'task_description is required' }, 400);
    }

    // ── Step 1: Classify the task ────────────────────────────────────────────
    const mockCtxClassify = {
      req: { json: async () => ({ task_description }) },
      json: (data: any) => data,
    } as unknown as Context;

    const classifyResult: any = await handleClassifyTaskRequest(mockCtxClassify);

    if (!classifyResult || classifyResult.error || classifyResult.category === 'unsupported') {
      return c.json({
        error: 'Task type is unsupported or classification failed',
        details: classifyResult,
      }, 400);
    }

    const category: string = classifyResult.category;

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

    // ── Step 3: Determine execution quantity ─────────────────────────────────
    // 1 execution unit = 1 file. If no files attached, treat as 1 unit.
    const executionQuantity: number = files.length > 0 ? files.length : 1;

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

    // ── Step 6: Resolve the authenticated user ───────────────────────────────
    let userId: any = null;
    const tokenUser = c.get('user' as any);
    if (tokenUser?.userId) {
      const user = await User.findById(tokenUser.userId);
      if (user) userId = user._id;
    }

    // ── Step 7: Persist the plan as a 'planned' Task document ────────────────
    let taskRecord: any = null;
    if (userId) {
      taskRecord = await Task.create({
        userId,
        prompt: task_description,
        category,
        status: 'planned',
        selectedEndpoint: winner.endpoint_path,
        allCandidateEndpoints: allCandidates,
        endpointChosenReason: `Score-based routing: confidence=${winner.confidence}, unitPrice=$${unitPrice}`,
        plannerOutput: classifyResult,
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
    }

    // Return the full execution plan
    return c.json({
      planId: taskRecord?._id?.toString() ?? `plan-${Date.now()}`,
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
    });
  } catch (err: any) {
    console.error('Error in plan-task handler:', err);
    return c.json({ error: 'Internal server error', message: err.message }, 500);
  }
}
