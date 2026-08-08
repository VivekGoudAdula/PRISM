import { TokenUsage, ITokenUsage, MeasurementSource } from '../models/TokenUsage';
import mongoose from 'mongoose';

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'llama-3.3-70b-versatile': { inputPer1M: 0.59, outputPer1M: 0.79 },
  'llama3-70b-8192': { inputPer1M: 0.59, outputPer1M: 0.79 },
  'llama3-8b-8192': { inputPer1M: 0.05, outputPer1M: 0.08 },
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
  'gpt-4.1-nano': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'default': { inputPer1M: 0.50, outputPer1M: 0.80 },
};

/**
 * Reusable token estimation utility.
 * Centralized token count estimation based on string length and word boundaries.
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;

  // Standard approximation: ~4 characters per token for typical English text/JSON payloads
  const charEstimate = Math.ceil(trimmed.length / 4);
  const words = trimmed.split(/\s+/).length;
  const wordEstimate = Math.ceil(words * 1.3);

  // Return weighted average bounded minimum 1
  return Math.max(1, Math.round((charEstimate + wordEstimate) / 2));
}

/**
 * Calculates token savings ensuring non-negative value.
 */
export function calculateTokenSavings(originalInputTokens: number, optimizedInputTokens: number): number {
  return Math.max(0, originalInputTokens - optimizedInputTokens);
}

/**
 * Calculates cost for a given input & output token count based on model pricing per 1M tokens.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelName: string = 'default'
): { inputCost: number; outputCost: number; totalCost: number; inputPricePer1M: number; outputPricePer1M: number } {
  const pricing = MODEL_PRICING[modelName] || MODEL_PRICING['default'];

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  const totalCost = parseFloat((inputCost + outputCost).toFixed(6));

  return {
    inputCost: parseFloat(inputCost.toFixed(6)),
    outputCost: parseFloat(outputCost.toFixed(6)),
    totalCost,
    inputPricePer1M: pricing.inputPer1M,
    outputPricePer1M: pricing.outputPer1M,
  };
}

/**
 * Calculates cost savings ensuring non-negative value.
 */
export function calculateCostSavings(estimatedOriginalCost: number, optimizedCost: number): number {
  return Math.max(0, parseFloat((estimatedOriginalCost - optimizedCost).toFixed(6)));
}

/**
 * Calculates percentage reduction (compression ratio).
 */
export function calculateCompressionRatio(originalInputTokens: number, optimizedInputTokens: number): number {
  if (!originalInputTokens || originalInputTokens <= 0) return 0;
  const saved = originalInputTokens - optimizedInputTokens;
  if (saved <= 0) return 0;
  return parseFloat(((saved / originalInputTokens) * 100).toFixed(1));
}

export interface RecordExecutionMetricsInput {
  userId: string | mongoose.Types.ObjectId;
  taskId: string | mongoose.Types.ObjectId;
  executionId: string;
  endpointId: string;
  endpointPath?: string;
  providerName?: string;
  originalInputTokens: number;
  optimizedInputTokens: number;
  outputTokens: number;
  modelName?: string;
  cacheHit?: boolean;
  cacheStatus?: 'hit' | 'miss' | 'bypass';
  cachedContextTokens?: number;
  cacheTokensSaved?: number;
  cacheSimilarity?: number;
  cacheEntryId?: string;
  measurementSource?: MeasurementSource;
}

export interface TokenAnalyticsResult {
  originalInputTokens: number;
  optimizedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokensSaved: number;
  compressionRatio: number;
  estimatedOriginalCost: number;
  optimizedCost: number;
  costSaved: number;
  cacheHit: boolean;
  cacheStatus: 'hit' | 'miss' | 'bypass';
  cachedContextTokens: number;
  cacheTokensSaved: number;
  cacheSimilarity: number;
  cacheEntryId?: string;
  measurementSource: MeasurementSource;
  currency: string;
}

/**
 * Central function to record execution-level token analytics into MongoDB.
 * Ensures non-blocking execution and idempotency via executionId.
 */
export async function recordExecutionMetrics(
  input: RecordExecutionMetricsInput
): Promise<TokenAnalyticsResult> {
  const originalInput = Math.max(0, Math.round(input.originalInputTokens || 0));
  const optimizedInput = Math.max(0, Math.round(input.optimizedInputTokens || 0));
  const output = Math.max(0, Math.round(input.outputTokens || 0));
  const totalTokens = optimizedInput + output;

  const tokensSaved = calculateTokenSavings(originalInput, optimizedInput);
  const compressionRatio = calculateCompressionRatio(originalInput, optimizedInput);

  const modelName = input.modelName || 'default';
  const pricing = MODEL_PRICING[modelName] || MODEL_PRICING['default'];

  // Cost calculation for original input + output vs optimized input + output
  const originalCostObj = calculateCost(originalInput, output, modelName);
  const optimizedCostObj = calculateCost(optimizedInput, output, modelName);

  const estimatedOriginalCost = originalCostObj.totalCost;
  const optimizedCost = optimizedCostObj.totalCost;
  const costSaved = calculateCostSavings(estimatedOriginalCost, optimizedCost);

  const cacheHit = Boolean(input.cacheHit);
  const cacheStatus = input.cacheStatus || (cacheHit ? 'hit' : 'miss');
  const cachedContextTokens = input.cachedContextTokens || 0;
  // Calculate: cacheTokensSaved = max(0, originalContextTokens - cachedContextTokens) ONLY on hit
  const cacheTokensSaved = cacheHit
    ? Math.max(0, originalInput - cachedContextTokens)
    : (input.cacheTokensSaved || 0);
  const cacheSimilarity = input.cacheSimilarity || (cacheHit ? 1.0 : 0);
  const cacheEntryId = input.cacheEntryId || '';
  const measurementSource: MeasurementSource = input.measurementSource || 'estimated';

  const analyticsResult: TokenAnalyticsResult = {
    originalInputTokens: originalInput,
    optimizedInputTokens: optimizedInput,
    outputTokens: output,
    totalTokens,
    tokensSaved,
    compressionRatio,
    estimatedOriginalCost,
    optimizedCost,
    costSaved,
    cacheHit,
    cacheStatus,
    cachedContextTokens,
    cacheTokensSaved,
    cacheSimilarity,
    cacheEntryId,
    measurementSource,
    currency: 'USD',
  };

  try {
    // Idempotent upsert by executionId
    await TokenUsage.findOneAndUpdate(
      { executionId: input.executionId },
      {
        $setOnInsert: {
          userId: new mongoose.Types.ObjectId(input.userId),
          taskId: new mongoose.Types.ObjectId(input.taskId),
          executionId: input.executionId,
          endpointId: input.endpointId,
          endpointPath: input.endpointPath || input.endpointId,
          providerName: input.providerName || 'Groq',
          originalInputTokens: originalInput,
          optimizedInputTokens: optimizedInput,
          outputTokens: output,
          totalTokens,
          estimatedOriginalCost,
          optimizedCost,
          tokensSaved,
          costSaved,
          compressionRatio,
          cacheHit,
          cacheStatus,
          cachedContextTokens,
          cacheTokensSaved,
          cacheSimilarity,
          cacheEntryId,
          measurementSource,
          costSource: `Pricing model: ${modelName}`,
          inputTokenPrice: pricing.inputPer1M,
          outputTokenPrice: pricing.outputPer1M,
          currency: 'USD',
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (err: any) {
    console.error('Error recording token analytics (non-blocking):', err?.message || err);
  }

  return analyticsResult;
}
