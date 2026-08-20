/**
 * PRISM Dynamic Optimization Pricing Module
 *
 * Pricing Model V1:
 *  - Base endpoint price remains fixed (set by provider).
 *  - Measured context token savings: tokensSaved = originalTokens - finalTokens
 *  - Savings rate: savingsRate = tokensSaved / originalTokens
 *  - Configurable discount factor: OPTIMIZATION_DISCOUNT_FACTOR (default 0.50)
 *  - Discount amount: discountAmount = baseEndpointPrice * savingsRate * OPTIMIZATION_DISCOUNT_FACTOR
 *  - Final price: max(baseEndpointPrice - discountAmount, MIN_PRICE)
 *
 * Guardrails & Constraints:
 *  - Provider base prices remain untouched.
 *  - If token savings <= 0 or originalTokens <= 0: finalPrice = basePrice, discount = 0.
 *  - No negative savings.
 *  - finalPrice never exceeds basePrice.
 *  - MIN_PRICE (default $0.01) prevents endpoints from becoming free.
 *  - Monetary rounding to 4 decimal places for exact USDC x402 precision.
 */

export const DEFAULT_OPTIMIZATION_DISCOUNT_FACTOR = 0.50;
export const DEFAULT_MIN_PRICE = 0.01;

export interface DynamicPriceInput {
  basePrice: number;
  originalTokens: number;
  finalTokens: number;
  discountFactor?: number;
  minPrice?: number;
}

export interface DynamicPriceResult {
  basePrice: number;
  originalTokens: number;
  finalTokens: number;
  tokensSaved: number;
  savingsRate: number; // e.g. 0.70 for 70%
  optimizationDiscount: number; // e.g. 0.0875
  finalPrice: number; // e.g. 0.1625
  discountFactor: number; // e.g. 0.50
  minPrice: number;
}

/**
 * Rounds a number to a fixed decimal precision safely.
 */
export function roundCurrency(value: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Calculates PRISM dynamic optimization price derived from measured context savings.
 */
export function calculateDynamicPrice(input: DynamicPriceInput): DynamicPriceResult {
  const basePrice = Math.max(0, input.basePrice || 0);
  const originalTokens = Math.max(0, Math.round(input.originalTokens || 0));
  const finalTokens = Math.max(0, Math.round(input.finalTokens || 0));
  const discountFactor = typeof input.discountFactor === 'number' && input.discountFactor >= 0
    ? input.discountFactor
    : DEFAULT_OPTIMIZATION_DISCOUNT_FACTOR;
  const minPrice = typeof input.minPrice === 'number' && input.minPrice >= 0
    ? input.minPrice
    : DEFAULT_MIN_PRICE;

  // Guardrail 1: Check for zero or negative savings or invalid original tokens
  if (originalTokens <= 0 || finalTokens >= originalTokens || basePrice === 0) {
    return {
      basePrice: roundCurrency(basePrice),
      originalTokens,
      finalTokens,
      tokensSaved: 0,
      savingsRate: 0,
      optimizationDiscount: 0,
      finalPrice: roundCurrency(basePrice),
      discountFactor,
      minPrice,
    };
  }

  // Guardrail 2: Calculate token savings (strictly non-negative)
  const tokensSaved = Math.max(0, originalTokens - finalTokens);
  const rawSavingsRate = tokensSaved / originalTokens;
  // Clamp savings rate between 0 and 1
  const savingsRate = Math.min(1.0, Math.max(0.0, rawSavingsRate));

  // Guardrail 3: Calculate discount amount
  const rawDiscount = basePrice * savingsRate * discountFactor;
  const optimizationDiscount = roundCurrency(rawDiscount, 4);

  // Guardrail 4: Calculate final price bounded by MIN_PRICE and basePrice
  const rawFinalPrice = Math.max(minPrice, basePrice - optimizationDiscount);
  // Ensure final price does not exceed base price
  const boundedFinalPrice = Math.min(basePrice, rawFinalPrice);
  const finalPrice = roundCurrency(boundedFinalPrice, 4);

  // Re-verify discount matching rounded final price for consistency
  const effectiveDiscount = roundCurrency(basePrice - finalPrice, 4);

  return {
    basePrice: roundCurrency(basePrice),
    originalTokens,
    finalTokens,
    tokensSaved,
    savingsRate: parseFloat(savingsRate.toFixed(4)),
    optimizationDiscount: effectiveDiscount,
    finalPrice,
    discountFactor,
    minPrice,
  };
}
