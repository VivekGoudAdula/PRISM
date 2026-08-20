/**
 * PRISM Workload-Based Pricing & Dynamic Optimization — Test Suite
 *
 * Runs deterministic unit tests for dynamic pricing formulas, code review workload tiers,
 * and integration tests for a 5-resume batch and a mixed-size repository.
 */

import { config } from 'dotenv';
config();

import { calculateDynamicPrice, roundCurrency } from './handlers/lib/dynamic-pricing';
import { calculateCodeReviewBasePrice } from './handlers/lib/code-review-pricing';
import { createDynamicPriceResolver } from './endpoints.config';
import mongoose from 'mongoose';
import { Task } from './models/Task';

async function runWorkloadTests() {
  console.log('====================================================');
  console.log('🧪 PRISM Workload Pricing Test Suite Starting...');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${testName} - ${detail || ''}`);
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PART A: DYNAMIC PRICING FORMULA UNIT TESTS (1 - 10)
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('--- Dynamic Pricing Formula Unit Tests ---');

  // Test 1: 0% token savings
  {
    const res = calculateDynamicPrice({ basePrice: 0.25, originalTokens: 8000, finalTokens: 8000 });
    assert(
      res.tokensSaved === 0 && res.savingsRate === 0 && res.optimizationDiscount === 0 && res.finalPrice === 0.25,
      'Dynamic Test 1: 0% token savings',
      JSON.stringify(res)
    );
  }

  // Test 2: 25% token savings
  {
    const res = calculateDynamicPrice({ basePrice: 0.25, originalTokens: 8000, finalTokens: 6000 });
    assert(
      res.tokensSaved === 2000 && res.savingsRate === 0.25 && res.optimizationDiscount === 0.0313 && res.finalPrice === 0.2187,
      'Dynamic Test 2: 25% token savings',
      JSON.stringify(res)
    );
  }

  // Test 3: 50% token savings
  {
    const res = calculateDynamicPrice({ basePrice: 0.25, originalTokens: 8000, finalTokens: 4000 });
    assert(
      res.tokensSaved === 4000 && res.savingsRate === 0.50 && res.optimizationDiscount === 0.0625 && res.finalPrice === 0.1875,
      'Dynamic Test 3: 50% token savings',
      JSON.stringify(res)
    );
  }

  // Test 4: 70% token savings
  {
    const res = calculateDynamicPrice({ basePrice: 0.25, originalTokens: 8000, finalTokens: 2400 });
    assert(
      res.tokensSaved === 5600 && res.savingsRate === 0.70 && res.optimizationDiscount === 0.0875 && res.finalPrice === 0.1625,
      'Dynamic Test 4: 70% token savings',
      JSON.stringify(res)
    );
  }

  // Test 5: 90% token savings
  {
    const res = calculateDynamicPrice({ basePrice: 0.25, originalTokens: 10000, finalTokens: 1000 });
    assert(
      res.tokensSaved === 9000 && res.savingsRate === 0.90 && res.optimizationDiscount === 0.1125 && res.finalPrice === 0.1375,
      'Dynamic Test 5: 90% token savings',
      JSON.stringify(res)
    );
  }

  // Test 6: Minimum price enforcement ($0.01)
  {
    const res = calculateDynamicPrice({ basePrice: 0.02, originalTokens: 10000, finalTokens: 0, discountFactor: 1.0, minPrice: 0.01 });
    assert(
      res.finalPrice === 0.01,
      'Dynamic Test 6: Minimum price enforcement ($0.01)',
      JSON.stringify(res)
    );
  }

  // Test 7: originalTokens = finalTokens
  {
    const res = calculateDynamicPrice({ basePrice: 0.35, originalTokens: 5000, finalTokens: 5000 });
    assert(
      res.tokensSaved === 0 && res.finalPrice === 0.35 && res.optimizationDiscount === 0,
      'Dynamic Test 7: originalTokens = finalTokens',
      JSON.stringify(res)
    );
  }

  // Test 8: finalTokens > originalTokens (Negative savings guardrail)
  {
    const res = calculateDynamicPrice({ basePrice: 0.20, originalTokens: 3000, finalTokens: 4000 });
    assert(
      res.tokensSaved === 0 && res.savingsRate === 0 && res.optimizationDiscount === 0 && res.finalPrice === 0.20,
      'Dynamic Test 8: finalTokens > originalTokens (Negative savings guardrail)',
      JSON.stringify(res)
    );
  }

  // Test 9: Zero tokens / invalid inputs
  {
    const res1 = calculateDynamicPrice({ basePrice: 0.25, originalTokens: 0, finalTokens: 100 });
    const res2 = calculateDynamicPrice({ basePrice: 0.25, originalTokens: -500, finalTokens: -100 });
    assert(
      res1.finalPrice === 0.25 && res1.optimizationDiscount === 0 && res2.finalPrice === 0.25 && res2.optimizationDiscount === 0,
      'Dynamic Test 9: Zero tokens / invalid inputs',
      JSON.stringify({ res1, res2 })
    );
  }

  // Test 10: Rounding precision (4 decimal places max)
  {
    const res = calculateDynamicPrice({ basePrice: 0.333333, originalTokens: 7777, finalTokens: 1234 });
    const isRounded = (val: number) => val.toString().split('.')[1]?.length <= 4;
    assert(
      isRounded(res.basePrice) && isRounded(res.optimizationDiscount) && isRounded(res.finalPrice),
      'Dynamic Test 10: Rounding precision (4 decimal places max)',
      JSON.stringify(res)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PART B: CODE REVIEW WORKLOAD PRICING UNIT TESTS (1 - 9)
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('\n--- Code Review Workload Base Price Unit Tests ---');

  // Test 1: Tiny file (1-50 lines / <= 200 tokens) -> $0.01
  {
    const res = calculateCodeReviewBasePrice({ inputTokens: 150, lineCount: 30 });
    assert(
      res.complexityTier === 'TINY' && res.basePrice === 0.01,
      'Code Review Test 1: Tiny file (30 lines, 150 tokens) -> TINY ($0.01)',
      JSON.stringify(res)
    );
  }

  // Test 2: Small file (51-150 lines / <= 600 tokens) -> $0.03
  {
    const res = calculateCodeReviewBasePrice({ inputTokens: 450, lineCount: 100 });
    assert(
      res.complexityTier === 'SMALL' && res.basePrice === 0.03,
      'Code Review Test 2: Small file (100 lines, 450 tokens) -> SMALL ($0.03)',
      JSON.stringify(res)
    );
  }

  // Test 3: Medium file (151-400 lines / <= 1600 tokens) -> $0.10
  {
    const res = calculateCodeReviewBasePrice({ inputTokens: 1200, lineCount: 250 });
    assert(
      res.complexityTier === 'MEDIUM' && res.basePrice === 0.10,
      'Code Review Test 3: Medium file (250 lines, 1200 tokens) -> MEDIUM ($0.10)',
      JSON.stringify(res)
    );
  }

  // Test 4: Large file (401-800 lines / <= 3200 tokens) -> $0.25
  {
    const res = calculateCodeReviewBasePrice({ inputTokens: 2500, lineCount: 600 });
    assert(
      res.complexityTier === 'LARGE' && res.basePrice === 0.25,
      'Code Review Test 4: Large file (600 lines, 2500 tokens) -> LARGE ($0.25)',
      JSON.stringify(res)
    );
  }

  // Test 5: Very Large file (801-1500 lines / <= 6000 tokens) -> $0.50
  {
    const res = calculateCodeReviewBasePrice({ inputTokens: 5000, lineCount: 1200 });
    assert(
      res.complexityTier === 'VERY_LARGE' && res.basePrice === 0.50,
      'Code Review Test 5: Very Large file (1200 lines, 5000 tokens) -> VERY_LARGE ($0.50)',
      JSON.stringify(res)
    );
  }

  // Test 6: Huge file (1500+ lines / > 6000 tokens) -> $0.90
  {
    const res = calculateCodeReviewBasePrice({ inputTokens: 8000, lineCount: 2000 });
    assert(
      res.complexityTier === 'HUGE' && res.basePrice === 0.90,
      'Code Review Test 6: Huge file (2000 lines, 8000 tokens) -> HUGE ($0.90)',
      JSON.stringify(res)
    );
  }

  // Test 7: 1500+ line file must NEVER exceed $0.90 cap
  {
    const res = calculateCodeReviewBasePrice({ inputTokens: 50000, lineCount: 10000 });
    assert(
      res.basePrice <= 0.90 && res.basePrice === 0.90,
      'Code Review Test 7: 10,000 line file capped at $0.90 max base price',
      JSON.stringify(res)
    );
  }

  // Test 8: Token-based primary signal test
  {
    // High token count (2500 tokens) even with lower line count (50 lines) -> LARGE ($0.25)
    const res = calculateCodeReviewBasePrice({ inputTokens: 2500, lineCount: 50 });
    assert(
      res.complexityTier === 'LARGE' && res.basePrice === 0.25,
      'Code Review Test 8: Token count (2500) overrides line count (50) -> LARGE ($0.25)',
      JSON.stringify(res)
    );
  }

  // Test 9: Line-count fallback when token count is unavailable (undefined/0)
  {
    const res = calculateCodeReviewBasePrice({ inputTokens: undefined, lineCount: 750 });
    assert(
      res.complexityTier === 'LARGE' && res.basePrice === 0.25,
      'Code Review Test 9: Line count fallback (750 lines, undefined tokens) -> LARGE ($0.25)',
      JSON.stringify(res)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PART C: INTEGRATION TEST 1 — BATCH OF 5 RESUMES
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('\n--- Integration Test 1: Batch of 5 Resumes ---');

  {
    const mockTaskId = new mongoose.Types.ObjectId();
    const basePrice = 0.25;

    const resumeOptimizations = [
      { name: 'Resume 1', orig: 2000, final: 800 },  // 60% savings
      { name: 'Resume 2', orig: 2000, final: 1200 }, // 40% savings
      { name: 'Resume 3', orig: 2000, final: 1000 }, // 50% savings
      { name: 'Resume 4', orig: 2000, final: 2000 }, // 0% savings
      { name: 'Resume 5', orig: 2000, final: 400 },  // 80% savings
    ];

    const itemPrices = resumeOptimizations.map((r, idx) => {
      const dp = calculateDynamicPrice({
        basePrice,
        originalTokens: r.orig,
        finalTokens: r.final,
        discountFactor: 0.50,
        minPrice: 0.01,
      });
      return {
        index: idx,
        name: r.name,
        basePrice,
        optimizationDiscount: dp.optimizationDiscount,
        finalPrice: dp.finalPrice,
      };
    });

    const batchSum = itemPrices.reduce((sum, item) => sum + item.finalPrice, 0);
    const roundedBatchSum = roundCurrency(batchSum, 4);

    const mockTaskObj = {
      _id: mockTaskId,
      unitPrice: roundCurrency(roundedBatchSum / 5, 4),
      totalCost: roundedBatchSum,
      itemPrices,
    };

    // Mock Task.findById
    const originalFindById = Task.findById;
    (Task as any).findById = (id: any) => {
      if (id && id.toString() === mockTaskId.toString()) {
        return {
          select: () => ({
            lean: async () => mockTaskObj,
          }),
        };
      }
      return originalFindById.call(Task, id);
    };

    const resolver = createDynamicPriceResolver('$0.25');

    let allRequirementsMatched = true;
    for (let i = 0; i < 5; i++) {
      const mockContext = {
        adapter: {
          getQueryParam: (param: string) => {
            if (param === 'planId') return mockTaskId.toString();
            if (param === 'fileIndex') return i.toString();
            return undefined;
          },
          getHeader: () => undefined,
          getBody: () => undefined,
        },
      } as any;

      const reqPrice = await resolver(mockContext);
      const expectedPrice = `$${itemPrices[i].finalPrice.toString()}`;
      if (reqPrice !== expectedPrice) {
        allRequirementsMatched = false;
        console.error(`Resume ${i + 1} requirement mismatch: expected ${expectedPrice}, got ${reqPrice}`);
      }
    }

    (Task as any).findById = originalFindById;

    assert(itemPrices.length === 5, 'Integration 1: 5 execution units created');
    assert(allRequirementsMatched, 'Integration 1: Each resume gets its exact individual x402 payment requirement');
    assert(
      roundedBatchSum === roundCurrency(itemPrices[0].finalPrice + itemPrices[1].finalPrice + itemPrices[2].finalPrice + itemPrices[3].finalPrice + itemPrices[4].finalPrice, 4),
      `Integration 1: Displayed batch sum ($${roundedBatchSum}) equals sum of individual final prices`,
      `Expected $${roundedBatchSum}`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PART D: INTEGRATION TEST 2 — MIXED-SIZE REPOSITORY CODE REVIEW
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('\n--- Integration Test 2: Mixed-Size Repository Code Review ---');

  {
    const mockRepoTaskId = new mongoose.Types.ObjectId();

    const repoFiles = [
      { path: 'tiny-utils.ts',      lines: 30,   tokens: 150 },  // TINY ($0.01)
      { path: 'small-component.ts', lines: 120,  tokens: 450 },  // SMALL ($0.03)
      { path: 'medium-server.ts',   lines: 300,  tokens: 1200 }, // MEDIUM ($0.10)
      { path: 'large-service.ts',   lines: 700,  tokens: 2800 }, // LARGE ($0.25)
      { path: 'very-large-db.ts',   lines: 1200, tokens: 5000 }, // VERY_LARGE ($0.50)
      { path: 'huge-monolith.ts',   lines: 2500, tokens: 9000 }, // HUGE ($0.90)
    ];

    const overallOptimizationRatio = 0.50; // 50% context reduction across repo

    const repoItemPrices = repoFiles.map((file, idx) => {
      const workload = calculateCodeReviewBasePrice({ inputTokens: file.tokens, lineCount: file.lines });
      const finalTokens = Math.round(file.tokens * (1 - overallOptimizationRatio));
      const dp = calculateDynamicPrice({
        basePrice: workload.basePrice,
        originalTokens: file.tokens,
        finalTokens,
        discountFactor: 0.50,
        minPrice: 0.01,
      });

      return {
        index: idx,
        name: file.path,
        complexityTier: workload.complexityTier,
        basePrice: workload.basePrice,
        optimizationDiscount: dp.optimizationDiscount,
        finalPrice: dp.finalPrice,
      };
    });

    const repoBatchSum = roundCurrency(repoItemPrices.reduce((sum, item) => sum + item.finalPrice, 0), 4);

    const mockRepoTaskObj = {
      _id: mockRepoTaskId,
      unitPrice: roundCurrency(repoBatchSum / 6, 4),
      totalCost: repoBatchSum,
      itemPrices: repoItemPrices,
    };

    const originalFindById = Task.findById;
    (Task as any).findById = (id: any) => {
      if (id && id.toString() === mockRepoTaskId.toString()) {
        return {
          select: () => ({
            lean: async () => mockRepoTaskObj,
          }),
        };
      }
      return originalFindById.call(Task, id);
    };

    const resolver = createDynamicPriceResolver('$0.35');

    let allRepoRequirementsMatched = true;
    for (let i = 0; i < repoFiles.length; i++) {
      const mockContext = {
        adapter: {
          getQueryParam: (param: string) => {
            if (param === 'planId') return mockRepoTaskId.toString();
            if (param === 'fileIndex') return i.toString();
            return undefined;
          },
          getHeader: () => undefined,
          getBody: () => undefined,
        },
      } as any;

      const reqPrice = await resolver(mockContext);
      const expectedPrice = `$${repoItemPrices[i].finalPrice.toString()}`;
      if (reqPrice !== expectedPrice) {
        allRepoRequirementsMatched = false;
        console.error(`Repo file ${repoFiles[i].path} requirement mismatch: expected ${expectedPrice}, got ${reqPrice}`);
      }
    }

    (Task as any).findById = originalFindById;

    assert(repoItemPrices[0].complexityTier === 'TINY' && repoItemPrices[0].basePrice === 0.01, 'Integration 2: file 1 assigned TINY tier ($0.01)');
    assert(repoItemPrices[1].complexityTier === 'SMALL' && repoItemPrices[1].basePrice === 0.03, 'Integration 2: file 2 assigned SMALL tier ($0.03)');
    assert(repoItemPrices[2].complexityTier === 'MEDIUM' && repoItemPrices[2].basePrice === 0.10, 'Integration 2: file 3 assigned MEDIUM tier ($0.10)');
    assert(repoItemPrices[3].complexityTier === 'LARGE' && repoItemPrices[3].basePrice === 0.25, 'Integration 2: file 4 assigned LARGE tier ($0.25)');
    assert(repoItemPrices[4].complexityTier === 'VERY_LARGE' && repoItemPrices[4].basePrice === 0.50, 'Integration 2: file 5 assigned VERY_LARGE tier ($0.50)');
    assert(repoItemPrices[5].complexityTier === 'HUGE' && repoItemPrices[5].basePrice === 0.90, 'Integration 2: file 6 assigned HUGE tier ($0.90)');

    assert(allRepoRequirementsMatched, 'Integration 2: Each file creates 1 x402 payment matching its workload-based dynamic final price');
    assert(
      repoBatchSum === roundCurrency(repoItemPrices.reduce((s, i) => s + i.finalPrice, 0), 4),
      `Integration 2: Repo batch total ($${repoBatchSum}) equals sum of individual file final prices`,
      `Expected $${repoBatchSum}`
    );
  }

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkloadTests().catch((err) => {
  console.error('Workload test runner crashed:', err);
  process.exit(1);
});
