/**
 * PRISM Workload-Based Pricing & Dynamic Optimization — Test Suite
 *
 * Runs deterministic unit tests for dynamic pricing formulas, code review workload tiers,
 * boundary values, multi-file repos, and integration tests for dynamic optimization.
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
    const res = calculateDynamicPrice({ basePrice: 0.30, originalTokens: 8000, finalTokens: 8000 });
    assert(
      res.tokensSaved === 0 && res.savingsRate === 0 && res.optimizationDiscount === 0 && res.finalPrice === 0.30,
      'Dynamic Test 1: 0% token savings ($0.30 base)',
      JSON.stringify(res)
    );
  }

  // Test 2: 25% token savings
  {
    const res = calculateDynamicPrice({ basePrice: 0.30, originalTokens: 8000, finalTokens: 6000 });
    assert(
      res.tokensSaved === 2000 && res.savingsRate === 0.25 && res.optimizationDiscount === 0.0375 && res.finalPrice === 0.2625,
      'Dynamic Test 2: 25% token savings',
      JSON.stringify(res)
    );
  }

  // Test 3: 50% token savings
  {
    const res = calculateDynamicPrice({ basePrice: 0.036, originalTokens: 8000, finalTokens: 4000 });
    // discount = 0.036 * 0.50 * 0.50 = 0.009; final = 0.036 - 0.009 = 0.027
    assert(
      res.tokensSaved === 4000 && res.savingsRate === 0.50 && res.optimizationDiscount === 0.009 && res.finalPrice === 0.027,
      'Dynamic Test 3: 50% token savings on SMALL tier ($0.036 base -> $0.027 final)',
      JSON.stringify(res)
    );
  }

  // Test 4: 70% token savings
  {
    const res = calculateDynamicPrice({ basePrice: 0.30, originalTokens: 8000, finalTokens: 2400 });
    assert(
      res.tokensSaved === 5600 && res.savingsRate === 0.70 && res.optimizationDiscount === 0.105 && res.finalPrice === 0.195,
      'Dynamic Test 4: 70% token savings ($0.30 base -> $0.195 final)',
      JSON.stringify(res)
    );
  }

  // Test 5: 90% token savings
  {
    const res = calculateDynamicPrice({ basePrice: 0.60, originalTokens: 10000, finalTokens: 1000 });
    assert(
      res.tokensSaved === 9000 && res.savingsRate === 0.90 && res.optimizationDiscount === 0.27 && res.finalPrice === 0.33,
      'Dynamic Test 5: 90% token savings ($0.60 base -> $0.33 final)',
      JSON.stringify(res)
    );
  }

  // Test 6: Minimum price enforcement ($0.01)
  {
    const res = calculateDynamicPrice({ basePrice: 0.012, originalTokens: 10000, finalTokens: 0, discountFactor: 1.0, minPrice: 0.01 });
    assert(
      res.finalPrice === 0.01,
      'Dynamic Test 6: Minimum price enforcement ($0.01)',
      JSON.stringify(res)
    );
  }

  // Test 7: originalTokens = finalTokens
  {
    const res = calculateDynamicPrice({ basePrice: 0.42, originalTokens: 5000, finalTokens: 5000 });
    assert(
      res.tokensSaved === 0 && res.finalPrice === 0.42 && res.optimizationDiscount === 0,
      'Dynamic Test 7: originalTokens = finalTokens',
      JSON.stringify(res)
    );
  }

  // Test 8: finalTokens > originalTokens (Negative savings guardrail)
  {
    const res = calculateDynamicPrice({ basePrice: 0.18, originalTokens: 3000, finalTokens: 4000 });
    assert(
      res.tokensSaved === 0 && res.savingsRate === 0 && res.optimizationDiscount === 0 && res.finalPrice === 0.18,
      'Dynamic Test 8: finalTokens > originalTokens (Negative savings guardrail)',
      JSON.stringify(res)
    );
  }

  // Test 9: Zero tokens / invalid inputs
  {
    const res1 = calculateDynamicPrice({ basePrice: 0.12, originalTokens: 0, finalTokens: 100 });
    const res2 = calculateDynamicPrice({ basePrice: 0.12, originalTokens: -500, finalTokens: -100 });
    assert(
      res1.finalPrice === 0.12 && res1.optimizationDiscount === 0 && res2.finalPrice === 0.12 && res2.optimizationDiscount === 0,
      'Dynamic Test 9: Zero tokens / invalid inputs',
      JSON.stringify({ res1, res2 })
    );
  }

  // Test 10: Rounding precision (4 decimal places max)
  {
    const res = calculateDynamicPrice({ basePrice: 0.096, originalTokens: 7777, finalTokens: 1234 });
    const isRounded = (val: number) => val.toString().split('.')[1]?.length <= 4;
    assert(
      isRounded(res.basePrice) && isRounded(res.optimizationDiscount) && isRounded(res.finalPrice),
      'Dynamic Test 10: Rounding precision for $0.096 base price',
      JSON.stringify(res)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PART B: CODE REVIEW WORKLOAD TIERS & BOUNDARY TESTING
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('\n--- Code Review Workload Base Price & Boundary Unit Tests ---');

  // Test 1: Tiny file (1-50 lines) -> $0.012
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 30, inputTokens: 150 });
    assert(
      res.complexityTier === 'TINY' && res.basePrice === 0.012,
      'Code Review Test 1: Tiny file (30 lines) -> TINY ($0.012)',
      JSON.stringify(res)
    );
  }

  // Test 2: Small file (51-150 lines) -> $0.036
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 100, inputTokens: 450 });
    assert(
      res.complexityTier === 'SMALL' && res.basePrice === 0.036,
      'Code Review Test 2: Small file (100 lines) -> SMALL ($0.036)',
      JSON.stringify(res)
    );
  }

  // Test 3: Medium file (151-400 lines) -> $0.12
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 250, inputTokens: 1200 });
    assert(
      res.complexityTier === 'MEDIUM' && res.basePrice === 0.12,
      'Code Review Test 3: Medium file (250 lines) -> MEDIUM ($0.12)',
      JSON.stringify(res)
    );
  }

  // Test 4: Large file (401-800 lines) -> $0.30
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 600, inputTokens: 2500 });
    assert(
      res.complexityTier === 'LARGE' && res.basePrice === 0.30,
      'Code Review Test 4: Large file (600 lines) -> LARGE ($0.30)',
      JSON.stringify(res)
    );
  }

  // Test 5: Very Large file (801-1500 lines) -> $0.60
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 1200, inputTokens: 5000 });
    assert(
      res.complexityTier === 'VERY_LARGE' && res.basePrice === 0.60,
      'Code Review Test 5: Very Large file (1200 lines) -> VERY_LARGE ($0.60)',
      JSON.stringify(res)
    );
  }

  // Test 6: Huge file (1500+ lines) -> $0.90
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 2000, inputTokens: 8000 });
    assert(
      res.complexityTier === 'HUGE' && res.basePrice === 0.90,
      'Code Review Test 6: Huge file (2000 lines) -> HUGE ($0.90)',
      JSON.stringify(res)
    );
  }

  // Boundary Tests
  console.log('\n--- LOC Boundary Tests ---');

  // Boundary 50 -> TINY ($0.012)
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 50 });
    assert(res.complexityTier === 'TINY' && res.basePrice === 0.012, 'Boundary 50 LOC -> TINY ($0.012)');
  }
  // Boundary 51 -> SMALL ($0.036)
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 51 });
    assert(res.complexityTier === 'SMALL' && res.basePrice === 0.036, 'Boundary 51 LOC -> SMALL ($0.036)');
  }
  // Boundary 150 -> SMALL ($0.036)
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 150 });
    assert(res.complexityTier === 'SMALL' && res.basePrice === 0.036, 'Boundary 150 LOC -> SMALL ($0.036)');
  }
  // Boundary 151 -> MEDIUM ($0.12)
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 151 });
    assert(res.complexityTier === 'MEDIUM' && res.basePrice === 0.12, 'Boundary 151 LOC -> MEDIUM ($0.12)');
  }
  // Boundary 400 -> MEDIUM ($0.12)
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 400 });
    assert(res.complexityTier === 'MEDIUM' && res.basePrice === 0.12, 'Boundary 400 LOC -> MEDIUM ($0.12)');
  }
  // Boundary 401 -> LARGE ($0.30)
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 401 });
    assert(res.complexityTier === 'LARGE' && res.basePrice === 0.30, 'Boundary 401 LOC -> LARGE ($0.30)');
  }
  // Boundary 800 -> LARGE ($0.30)
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 800 });
    assert(res.complexityTier === 'LARGE' && res.basePrice === 0.30, 'Boundary 800 LOC -> LARGE ($0.30)');
  }
  // Boundary 801 -> VERY_LARGE ($0.60)
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 801 });
    assert(res.complexityTier === 'VERY_LARGE' && res.basePrice === 0.60, 'Boundary 801 LOC -> VERY_LARGE ($0.60)');
  }
  // Boundary 1500 -> VERY_LARGE ($0.60)
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 1500 });
    assert(res.complexityTier === 'VERY_LARGE' && res.basePrice === 0.60, 'Boundary 1500 LOC -> VERY_LARGE ($0.60)');
  }
  // Boundary 1501 -> HUGE ($0.90)
  {
    const res = calculateCodeReviewBasePrice({ lineCount: 1501 });
    assert(res.complexityTier === 'HUGE' && res.basePrice === 0.90, 'Boundary 1501 LOC -> HUGE ($0.90)');
  }

  // Multi-file Code Review sum test
  console.log('\n--- Multi-File Code Review Base Price Sum Test ---');
  {
    const fileA = calculateCodeReviewBasePrice({ lineCount: 100 }); // SMALL -> 0.036
    const fileB = calculateCodeReviewBasePrice({ lineCount: 500 }); // LARGE -> 0.30
    const fileC = calculateCodeReviewBasePrice({ lineCount: 20 });  // TINY  -> 0.012

    const totalBasePrice = roundCurrency(fileA.basePrice + fileB.basePrice + fileC.basePrice, 4);
    assert(
      fileA.basePrice === 0.036 && fileB.basePrice === 0.30 && fileC.basePrice === 0.012 && totalBasePrice === 0.348,
      'Multi-file sum: File A (100 LOC $0.036) + File B (500 LOC $0.30) + File C (20 LOC $0.012) = $0.348',
      `Total base price calculated: ${totalBasePrice}`
    );
  }

  // Secondary Token Validation Test
  {
    // 50 lines (normally TINY) but 5000 tokens (VERY_LARGE workload)
    const res = calculateCodeReviewBasePrice({ lineCount: 50, inputTokens: 5000 });
    assert(
      res.complexityTier === 'VERY_LARGE' && res.basePrice === 0.60,
      'Secondary token validation: 5000 tokens promotes 50-line file from TINY to VERY_LARGE ($0.60)',
      JSON.stringify(res)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PART C: INTEGRATION TEST 1 — BATCH OF 5 RESUMES ($0.30 BASE)
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('\n--- Integration Test 1: Batch of 5 Resumes ---');

  {
    const mockTaskId = new mongoose.Types.ObjectId();
    const basePrice = 0.30;

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

    const resolver = createDynamicPriceResolver('$0.30');

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
      { path: 'tiny-utils.ts',      lines: 30,   tokens: 150 },  // TINY ($0.012)
      { path: 'small-component.ts', lines: 120,  tokens: 450 },  // SMALL ($0.036)
      { path: 'medium-server.ts',   lines: 300,  tokens: 1200 }, // MEDIUM ($0.12)
      { path: 'large-service.ts',   lines: 700,  tokens: 2800 }, // LARGE ($0.30)
      { path: 'very-large-db.ts',   lines: 1200, tokens: 5000 }, // VERY_LARGE ($0.60)
      { path: 'huge-monolith.ts',   lines: 2500, tokens: 9000 }, // HUGE ($0.90)
    ];

    const overallOptimizationRatio = 0.50; // 50% context reduction across repo

    const repoItemPrices = repoFiles.map((file, idx) => {
      const workload = calculateCodeReviewBasePrice({ lineCount: file.lines, inputTokens: file.tokens });
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

    const resolver = createDynamicPriceResolver('$0.30');

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

    assert(repoItemPrices[0].complexityTier === 'TINY' && repoItemPrices[0].basePrice === 0.012, 'Integration 2: file 1 assigned TINY tier ($0.012)');
    assert(repoItemPrices[1].complexityTier === 'SMALL' && repoItemPrices[1].basePrice === 0.036, 'Integration 2: file 2 assigned SMALL tier ($0.036)');
    assert(repoItemPrices[2].complexityTier === 'MEDIUM' && repoItemPrices[2].basePrice === 0.12, 'Integration 2: file 3 assigned MEDIUM tier ($0.12)');
    assert(repoItemPrices[3].complexityTier === 'LARGE' && repoItemPrices[3].basePrice === 0.30, 'Integration 2: file 4 assigned LARGE tier ($0.30)');
    assert(repoItemPrices[4].complexityTier === 'VERY_LARGE' && repoItemPrices[4].basePrice === 0.60, 'Integration 2: file 5 assigned VERY_LARGE tier ($0.60)');
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
