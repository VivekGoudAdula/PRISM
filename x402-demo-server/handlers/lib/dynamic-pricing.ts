/**
 * PRISM Dynamic Optimization Pricing Module
 *
 * Calculates per-execution dynamic prices based on measured context token savings.
 *
 * Formula:
 *   tokensSaved = max(0, originalTokens - finalTokens)
 *   savingsRate = originalTokens > 0 ? (tokensSaved / originalTokens) : 0
 *   optimizationDiscount = basePrice * savingsRate * discountFactor
 *   finalPrice = max(minPrice, basePrice - optimizationDiscount)
 */

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
  savingsRate: number;
  optimizationDiscount: number;
  finalPrice: number;
  discountFactor: number;
  minPrice: number;
}

/**
 * Safely rounds a currency amount to a specified number of decimal places (default 4).
 */
export function roundCurrency(amount: number, decimals: number = 4): number {
  if (!isFinite(amount) || isNaN(amount)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

/**
 * Computes dynamic price based on base price and measured token savings.
 */
export function calculateDynamicPrice(input: DynamicPriceInput): DynamicPriceResult {
  const rawBasePrice = Math.max(0, input.basePrice || 0);
  const rawOriginalTokens = Math.max(0, input.originalTokens || 0);
  const rawFinalTokens = Math.max(0, input.finalTokens || 0);
  const discountFactor = input.discountFactor !== undefined ? input.discountFactor : 0.50;
  const minPrice = input.minPrice !== undefined ? input.minPrice : 0.01;

  // Guardrail: No savings if originalTokens is non-positive or finalTokens >= originalTokens
  let tokensSaved = 0;
  let savingsRate = 0;
  if (rawOriginalTokens > 0 && rawFinalTokens < rawOriginalTokens) {
    tokensSaved = rawOriginalTokens - rawFinalTokens;
    savingsRate = tokensSaved / rawOriginalTokens;
  }

  // Calculate raw discount and apply guardrails
  const rawDiscount = rawBasePrice * savingsRate * discountFactor;
  const optimizationDiscount = roundCurrency(rawDiscount, 4);

  // Calculate raw final price: basePrice - optimizationDiscount, capped at minPrice and basePrice
  const rawFinalPrice = Math.max(minPrice, Math.min(rawBasePrice, rawBasePrice - optimizationDiscount));
  const finalPrice = roundCurrency(rawFinalPrice, 4);

  return {
    basePrice: roundCurrency(rawBasePrice, 4),
    originalTokens: rawOriginalTokens,
    finalTokens: rawFinalTokens,
    tokensSaved,
    savingsRate: roundCurrency(savingsRate, 4),
    optimizationDiscount,
    finalPrice,
    discountFactor,
    minPrice: roundCurrency(minPrice, 4),
  };
}
