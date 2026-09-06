/**
 * PRISM Centralized Pricing Configuration — Single Source of Truth
 *
 * All base prices across x402 payment requirement resolvers, candidate bidding,
 * dynamic pricing calculations, frontend displays, and analytics must reference
 * this single source of truth.
 */

export interface CodeReviewWorkloadTier {
  tier: 'TINY' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE' | 'HUGE';
  maxLines: number;
  maxTokens: number;
  basePrice: number;
}

export const CODE_REVIEW_WORKLOAD_TIERS: CodeReviewWorkloadTier[] = [
  { tier: 'TINY',       maxLines: 50,       maxTokens: 200,      basePrice: 0.012 },
  { tier: 'SMALL',      maxLines: 150,      maxTokens: 600,      basePrice: 0.036 },
  { tier: 'MEDIUM',     maxLines: 400,      maxTokens: 1600,     basePrice: 0.12 },
  { tier: 'LARGE',      maxLines: 800,      maxTokens: 3200,     basePrice: 0.30 },
  { tier: 'VERY_LARGE', maxLines: 1500,     maxTokens: 6000,     basePrice: 0.60 },
  { tier: 'HUGE',       maxLines: Infinity, maxTokens: Infinity, basePrice: 1.08 },
];

export const ENDPOINT_BASE_PRICES = {
  '/resume-screen-fast': 0.12,
  '/resume-screen-accurate': 0.30,
  '/contract-analyze-fast': 0.18,
  '/contract-analyze-accurate': 0.42,
  '/invoice-extract-fast': 0.096,
  '/invoice-extract-accurate': 0.24,
  '/code-review-fast': 0.012, // Baseline TINY price
  '/code-review-accurate': 0.012, // Baseline TINY price (workload dynamic)
  '/seo-audit-fast': 0.12,
  '/seo-audit-accurate': 0.30,
  '/execute-task': 0.25,
  '/run-task': 0.25,
} as const;

export const ENDPOINT_UNITS: Record<string, string> = {
  '/resume-screen-fast': 'file',
  '/resume-screen-accurate': 'file',
  '/contract-analyze-fast': 'file',
  '/contract-analyze-accurate': 'file',
  '/invoice-extract-fast': 'file',
  '/invoice-extract-accurate': 'file',
  '/code-review-fast': 'file',
  '/code-review-accurate': 'file',
  '/seo-audit-fast': 'page',
  '/seo-audit-accurate': 'page',
  '/execute-task': 'task',
  '/run-task': 'task',
};

/**
 * Normalizes currency to string with exact USDC decimal formatting.
 * $0.096 format preserved without silent unwanted rounding discrepancies.
 */
export function formatBasePriceString(price: number): string {
  // If price has 3 decimal places (like 0.096 or 0.012 or 0.036), present exact decimal representation
  const str = price.toString();
  return `$${str}`;
}
