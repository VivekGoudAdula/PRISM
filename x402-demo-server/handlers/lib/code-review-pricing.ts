import { CODE_REVIEW_WORKLOAD_TIERS, CodeReviewWorkloadTier } from '../../pricing.config';

export type ComplexityTier = 'TINY' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE' | 'HUGE';
export type { CodeReviewWorkloadTier as CodeReviewTierConfig };
export { CODE_REVIEW_WORKLOAD_TIERS };

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
 * Primary factor: Lines of Code (LOC).
 * Secondary factor: Token count / file size validation (prevents token-heavy files from falling into cheap tiers).
 */
export function calculateCodeReviewBasePrice(input: CodeReviewWorkloadInput): CodeReviewWorkloadResult {
  const tokens = typeof input.inputTokens === 'number' && input.inputTokens >= 0 ? input.inputTokens : null;
  const lines = typeof input.lineCount === 'number' && input.lineCount >= 0 ? input.lineCount : 0;
  const bytes = typeof input.fileSizeBytes === 'number' && input.fileSizeBytes >= 0 ? input.fileSizeBytes : 0;

  let locTierIdx = 0;
  if (lines > 0) {
    for (let i = 0; i < CODE_REVIEW_WORKLOAD_TIERS.length; i++) {
      if (lines <= CODE_REVIEW_WORKLOAD_TIERS[i].maxLines) {
        locTierIdx = i;
        break;
      }
    }
  } else {
    locTierIdx = 0;
  }

  let tokenTierIdx = 0;
  if (tokens !== null && tokens > 0) {
    for (let i = 0; i < CODE_REVIEW_WORKLOAD_TIERS.length; i++) {
      if (tokens <= CODE_REVIEW_WORKLOAD_TIERS[i].maxTokens) {
        tokenTierIdx = i;
        break;
      }
    }
  }

  // Primary signal is LOC if provided. If token count signals higher complexity, promote tier.
  let finalTierIdx = locTierIdx;
  if (lines === 0 && tokens !== null) {
    finalTierIdx = tokenTierIdx;
  } else if (tokens !== null && tokens > 0) {
    finalTierIdx = Math.max(locTierIdx, tokenTierIdx);
  }

  const chosenTierConfig = CODE_REVIEW_WORKLOAD_TIERS[finalTierIdx];
  const basePrice = chosenTierConfig.basePrice;

  return {
    complexityTier: chosenTierConfig.tier,
    inputTokens: tokens !== null ? tokens : Math.round(lines * 4),
    lineCount: lines,
    fileSizeBytes: bytes,
    basePrice,
  };
}

