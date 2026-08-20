/**
 * PRISM Code Review Workload-Based Pricing Module
 *
 * Computes deterministic base prices per file based on workload complexity.
 * Uses input tokens as the primary complexity signal with line count as fallback.
 *
 * Configurable Tiers:
 *   TINY:       1–50 lines    OR  inputTokens <= 200    ->  $0.01
 *   SMALL:      51–150 lines  OR  inputTokens <= 600    ->  $0.03
 *   MEDIUM:     151–400 lines OR  inputTokens <= 1600   ->  $0.10
 *   LARGE:      401–800 lines OR  inputTokens <= 3200   ->  $0.25
 *   VERY_LARGE: 801–1500 lines OR inputTokens <= 6000   ->  $0.50
 *   HUGE:       1500+ lines   OR  inputTokens > 6000    ->  $0.90 (Max Capped)
 */

export type ComplexityTier = 'TINY' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE' | 'HUGE';

export interface CodeReviewTierConfig {
  tier: ComplexityTier;
  maxTokens: number;
  maxLines: number;
  basePrice: number;
}

export const CODE_REVIEW_WORKLOAD_TIERS: CodeReviewTierConfig[] = [
  { tier: 'TINY',       maxTokens: 200,   maxLines: 50,   basePrice: 0.01 },
  { tier: 'SMALL',      maxTokens: 600,   maxLines: 150,  basePrice: 0.03 },
  { tier: 'MEDIUM',     maxTokens: 1600,  maxLines: 400,  basePrice: 0.10 },
  { tier: 'LARGE',      maxTokens: 3200,  maxLines: 800,  basePrice: 0.25 },
  { tier: 'VERY_LARGE', maxTokens: 6000,  maxLines: 1500, basePrice: 0.50 },
  { tier: 'HUGE',       maxTokens: Infinity, maxLines: Infinity, basePrice: 0.90 },
];

export interface CodeReviewWorkloadInput {
  inputTokens?: number;
  lineCount?: number;
  fileSizeBytes?: number;
}

export interface CodeReviewWorkloadResult {
  complexityTier: ComplexityTier;
  inputTokens: number;
  lineCount: number;
  fileSizeBytes: number;
  basePrice: number;
}

/**
 * Calculates Code Review base price for a single file content based on actual workload.
 * Primary signal: inputTokens. Fallback signal: lineCount. Max price capped at $0.90.
 */
export function calculateCodeReviewBasePrice(input: CodeReviewWorkloadInput): CodeReviewWorkloadResult {
  const tokens = typeof input.inputTokens === 'number' && input.inputTokens >= 0 ? input.inputTokens : null;
  const lines = typeof input.lineCount === 'number' && input.lineCount >= 0 ? input.lineCount : 0;
  const bytes = typeof input.fileSizeBytes === 'number' && input.fileSizeBytes >= 0 ? input.fileSizeBytes : 0;

  let chosenTierConfig: CodeReviewTierConfig = CODE_REVIEW_WORKLOAD_TIERS[CODE_REVIEW_WORKLOAD_TIERS.length - 1];

  if (tokens !== null && tokens > 0) {
    // Primary complexity signal: token count
    for (const config of CODE_REVIEW_WORKLOAD_TIERS) {
      if (tokens <= config.maxTokens) {
        chosenTierConfig = config;
        break;
      }
    }
  } else {
    // Fallback complexity signal: line count
    for (const config of CODE_REVIEW_WORKLOAD_TIERS) {
      if (lines <= config.maxLines) {
        chosenTierConfig = config;
        break;
      }
    }
  }

  // Enforce maximum cap of $0.90 for HUGE files (1500+ lines / >6000 tokens)
  const basePrice = Math.min(0.90, chosenTierConfig.basePrice);

  return {
    complexityTier: chosenTierConfig.tier,
    inputTokens: tokens !== null ? tokens : Math.round(lines * 4),
    lineCount: lines,
    fileSizeBytes: bytes,
    basePrice,
  };
}
