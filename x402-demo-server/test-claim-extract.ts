import assert from 'assert';
import { processClaimExtraction } from './handlers/claim-extract-fast';
import { verifyOutput } from './handlers/lib/verify-output';
import { selectEndpointForTask } from './handlers/select-endpoint';

async function runTests() {
  console.log('====================================================');
  console.log('PRISM — CLAIM-EXTRACT ENDPOINT TEST SUITE');
  console.log('====================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function runTest(name: string, fn: () => Promise<void> | void) {
    totalCount++;
    return (async () => {
      try {
        await fn();
        console.log(`✓ PASS: ${name}`);
        passedCount++;
      } catch (err: any) {
        console.error(`❌ FAIL: ${name}`);
        console.error('  Error:', err.message || err);
      }
    })();
  }

  // ── TEST 1: News Article ──────────────────────────────────────────────────
  await runTest('TEST 1 — News Article Claim Extraction & Precision', async () => {
    const text = 'Acme Technologies announced on Monday that it raised $25 million in Series B funding. The round was led by Northstar Ventures. The company said its customer base grew by 42% during 2025. Acme currently employs more than 600 people across offices in Bengaluru and Hyderabad.';
    
    const res = await processClaimExtraction(text, 'ARTICLE');
    
    assert.strictEqual(res.success, true, 'Extraction should succeed');
    assert.strictEqual(res.documentType, 'ARTICLE', 'Document type should be ARTICLE');
    assert(res.claimCount >= 4, `Expected at least 4 claims, got ${res.claimCount}`);

    const claimTexts = res.claims.map((c: any) => c.claim.toLowerCase());
    
    assert(claimTexts.some((c: any) => c.includes('$25 million') && c.includes('series b')), 'Must include $25M Series B funding claim');
    assert(claimTexts.some((c: any) => c.includes('northstar ventures')), 'Must include Northstar Ventures claim');
    assert(claimTexts.some((c: any) => c.includes('42%') && c.includes('2025')), 'Must include 42% growth in 2025 claim');
    assert(claimTexts.some((c: any) => c.includes('600') && c.includes('more than')), 'Must preserve "more than 600" qualifier');

    const v = verifyOutput('claim_extraction', res);
    assert.strictEqual(v.passed, true, 'verifyOutput must pass for valid extraction');
  });

  // ── TEST 2: Press Release (Marketing vs Fact Filtering) ─────────────────────
  await runTest('TEST 2 — Press Release Marketing Filtering', async () => {
    const text = `PRESS RELEASE — FOR IMMEDIATE RELEASE
    Acme Systems announced today that it launched version 3.0 of its cloud security platform on June 15, 2026.
    Our solution is the most revolutionary and amazing product in the world.
    The company generated $14 million in ARR during Q1 2026 according to financial reports.
    We are thrilled to transform the future of software!`;

    const res = await processClaimExtraction(text, 'PRESS_RELEASE');

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.documentType, 'PRESS_RELEASE');
    
    const claimTexts = res.claims.map((c: any) => c.claim.toLowerCase());
    
    // Check factual extraction
    assert(claimTexts.some((c: any) => c.includes('version 3.0') && c.includes('june 15, 2026')), 'Must extract product launch date');
    assert(claimTexts.some((c: any) => c.includes('$14 million') && c.includes('q1 2026')), 'Must extract $14M ARR Q1 2026 figure');

    // Verify marketing fluff is filtered out
    assert(!claimTexts.some((c: any) => c.includes('most revolutionary and amazing')), 'Must NOT treat pure marketing hype as a claim');
    assert(!claimTexts.some((c: any) => c.includes('thrilled to transform')), 'Must NOT extract subjective emotional fluff');
  });

  // ── TEST 3: Interview Transcript & Attribution Preservation ───────────────
  await runTest('TEST 3 — Interview Transcript & Speaker Attribution', async () => {
    const text = `INTERVIEWER: What is your current customer count and expansion rate?
    CEO: We currently serve more than 12,000 customers as of Q2 2026.
    INTERVIEWER: Have you expanded international operations?
    CTO: Our engineering team opened our Berlin office in January 2026.`;

    const res = await processClaimExtraction(text, 'INTERVIEW_TRANSCRIPT');

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.documentType, 'INTERVIEW_TRANSCRIPT');

    const c1 = res.claims.find((c: any) => c.claim.includes('12,000'));
    assert(c1, 'Must extract 12,000 customers claim');
    assert.strictEqual(c1?.attribution, 'CEO', 'Attribution must be CEO');

    const c2 = res.claims.find((c: any) => c.claim.toLowerCase().includes('berlin'));
    assert(c2, 'Must extract Berlin office claim');
    assert.strictEqual(c2?.attribution, 'CTO', 'Attribution must be CTO');
  });

  // ── TEST 4: Conflicting Claims Preservation ────────────────────────────────
  await runTest('TEST 4 — Conflicting Claims Preservation', async () => {
    const text = `In its initial press statement, Acme Corp reported revenue of $20 million for fiscal year 2025. Later in the audited annual filing, the company stated that annual revenue was $18 million for fiscal year 2025.`;

    const res = await processClaimExtraction(text, 'ARTICLE');

    assert.strictEqual(res.success, true);
    assert(res.claims.length >= 2, 'Must preserve both conflicting claims as separate entries');

    const claimTexts = res.claims.map((c: any) => c.claim);
    assert(claimTexts.some((c: any) => c.includes('$20 million')), 'Must preserve $20M claim');
    assert(claimTexts.some((c: any) => c.includes('$18 million')), 'Must preserve $18M claim');
  });

  // ── TEST 5: Qualifiers, Temporal Context & Numerical Precision ────────────
  await runTest('TEST 5 — Qualifiers, Temporal Context & Numerical Precision', async () => {
    const text = `According to preliminary company data, revenue is estimated to have increased by approximately 18.5% in the first quarter of 2026.`;

    const res = await processClaimExtraction(text, 'STATEMENT');

    assert.strictEqual(res.success, true);
    assert(res.claims.length >= 1, 'Must extract claim');

    const c = res.claims[0].claim;
    assert(c.includes('18.5%'), 'Numerical precision 18.5% must be exact without rounding');
    assert(c.toLowerCase().includes('approximately') || c.toLowerCase().includes('estimated') || c.toLowerCase().includes('preliminary'), 'Qualifiers must be preserved');
    assert(c.toLowerCase().includes('first quarter of 2026') || c.toLowerCase().includes('q1'), 'Temporal context must be preserved');
  });

  // ── TEST 6: Category Routing & Provider Bidding ───────────────────────────
  await runTest('TEST 6 — Router Endpoint Selection for claim_extraction', async () => {
    const fastRouting = await selectEndpointForTask('claim_extraction', 'Fast claim extraction from press release');
    assert.strictEqual(fastRouting.winner.endpoint_path, '/claim-extract-fast');

    const accurateRouting = await selectEndpointForTask('claim_extraction', 'Deep comprehensive high precision claim extraction and attribution audit');
    assert.strictEqual(accurateRouting.winner.endpoint_path, '/claim-extract-accurate');
  });

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedCount} / ${totalCount} PASSED`);
  console.log('====================================================\n');

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
