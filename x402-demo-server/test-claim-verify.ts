import assert from 'assert';
import { processClaimVerification } from './handlers/claim-verify-fast';
import { verifyOutput } from './handlers/lib/verify-output';
import { selectEndpointForTask } from './handlers/select-endpoint';

async function runTests() {
  console.log('====================================================');
  console.log('PRISM — CLAIM-VERIFY ENDPOINT TEST SUITE');
  console.log('====================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  async function runTest(name: string, fn: () => Promise<void> | void) {
    totalCount++;
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passedCount++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error('  Error:', err.message || err);
    }
  }

  // ── TEST 1: Direct Support ────────────────────────────────────────────────
  await runTest('TEST 1 — Direct Supporting Evidence', async () => {
    const claim = 'Acme raised $25 million in Series B funding.';
    const evidence = [
      { id: 'source_001', title: 'Press Release', text: 'Acme announced a $25 million Series B round led by Northstar Ventures.' }
    ];

    const res = await processClaimVerification(claim, evidence);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verification.status, 'SUPPORTED_BY_PROVIDED_EVIDENCE');
    assert(res.supportingEvidence.length >= 1, 'Must contain supporting evidence card');
    assert.strictEqual(res.supportingEvidence[0].sourceId, 'source_001');

    const v = verifyOutput('claim_verification', res);
    assert.strictEqual(v.passed, true, 'verifyOutput must pass for valid verification');
  });

  // ── TEST 2: Direct Contradiction ──────────────────────────────────────────
  await runTest('TEST 2 — Direct Contradictory Evidence', async () => {
    const claim = 'Acme raised $25 million in Series B funding.';
    const evidence = [
      { id: 'source_001', title: 'SEC Filing', text: 'Acme raised $10 million in Series B funding according to regulatory filings.' }
    ];

    const res = await processClaimVerification(claim, evidence);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verification.status, 'CONTRADICTED_BY_PROVIDED_EVIDENCE');
    assert(res.contradictingEvidence.length >= 1, 'Must contain contradicting evidence card');
  });

  // ── TEST 3: Insufficient Evidence ─────────────────────────────────────────
  await runTest('TEST 3 — Insufficient Evidence', async () => {
    const claim = 'Acme has 10,000 customers.';
    const evidence = [
      { id: 'source_001', title: 'Company Overview', text: 'Acme is a fast-growing technology company headquartered in Delaware.' }
    ];

    const res = await processClaimVerification(claim, evidence);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verification.status, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(res.supportingEvidence.length, 0);
  });

  // ── TEST 4: Partial Support (Missing Qualifier) ───────────────────────────
  await runTest('TEST 4 — Partial Support for Missing Qualifier', async () => {
    const claim = 'Acme opened its first Hyderabad office in March 2026.';
    const evidence = [
      { id: 'source_001', title: 'News Article', text: 'Acme opened a Hyderabad office in March 2026.' }
    ];

    const res = await processClaimVerification(claim, evidence);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verification.status, 'PARTIALLY_SUPPORTED');
    assert(res.requiresVerification.length >= 1, 'Must flag missing "first" qualifier for verification');
  });

  // ── TEST 5: Conflicting Sources ───────────────────────────────────────────
  await runTest('TEST 5 — Conflicting Sources Detection', async () => {
    const claim = 'Acme generated $25 million in revenue in 2025.';
    const evidence = [
      { id: 'source_001', title: 'Press Release', text: 'Acme generated $25 million in revenue in 2025.' },
      { id: 'source_002', title: 'Audited Report', text: 'Acme generated $18.4 million in revenue in 2025.' }
    ];

    const res = await processClaimVerification(claim, evidence);

    assert.strictEqual(res.success, true);
    assert(res.conflicts.length >= 1, 'Must surface conflict between Source A and Source B');
    assert.strictEqual(res.verification.status, 'CONTRADICTED_BY_PROVIDED_EVIDENCE');
  });

  // ── TEST 6: Qualifiers & Numerical Precision ─────────────────────────────
  await runTest('TEST 6 — Qualifiers & Exact Numerical Precision', async () => {
    const claim = 'According to preliminary data, revenue increased by approximately 18.5% in Q1.';
    const evidence = [
      { id: 'source_001', title: 'Quarterly Update', text: 'Preliminary company data indicates revenue increased by 18.5% in Q1.' }
    ];

    const res = await processClaimVerification(claim, evidence);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verification.status, 'SUPPORTED_BY_PROVIDED_EVIDENCE');
  });

  // ── TEST 7: Temporal Mismatch ─────────────────────────────────────────────
  await runTest('TEST 7 — Temporal Mismatch Detection', async () => {
    const claim = 'Acme revenue was $25 million in 2026.';
    const evidence = [
      { id: 'source_001', title: '2024 Report', text: 'Acme revenue was $25 million in 2024.' }
    ];

    const res = await processClaimVerification(claim, evidence);

    assert.strictEqual(res.success, true);
    assert(
      res.verification.status === 'CONTRADICTED_BY_PROVIDED_EVIDENCE' || res.verification.status === 'INSUFFICIENT_EVIDENCE',
      `Expected CONTRADICTED or INSUFFICIENT due to temporal mismatch, got ${res.verification.status}`
    );
  });

  // ── TEST 8: Entity Mismatch ───────────────────────────────────────────────
  await runTest('TEST 8 — Entity Mismatch Prevention', async () => {
    const claim = 'Acme Corp generated $25 million.';
    const evidence = [
      { id: 'source_001', title: 'Competitor News', text: 'Beta Corp generated $25 million.' }
    ];

    const res = await processClaimVerification(claim, evidence);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verification.status, 'INSUFFICIENT_EVIDENCE');
  });

  // ── TEST 9: Percentage Number Mismatch ────────────────────────────────────
  await runTest('TEST 9 — Percentage Mismatch Detection', async () => {
    const claim = 'The company customer base grew 42%.';
    const evidence = [
      { id: 'source_001', title: 'Annual Update', text: 'The company customer base grew 24% during the period.' }
    ];

    const res = await processClaimVerification(claim, evidence);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verification.status, 'CONTRADICTED_BY_PROVIDED_EVIDENCE');
  });

  // ── TEST 10: Multiple Supporting Sources ─────────────────────────────────
  await runTest('TEST 10 — Multiple Supporting Sources', async () => {
    const claim = 'Acme opened its Hyderabad office in March 2026.';
    const evidence = [
      { id: 'source_001', title: 'Press Release', text: 'Acme opened a Hyderabad office in March 2026.' },
      { id: 'source_002', title: 'Local News', text: 'The Hyderabad office opened in March 2026.' }
    ];

    const res = await processClaimVerification(claim, evidence);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verification.status, 'SUPPORTED_BY_PROVIDED_EVIDENCE');
    assert(res.supportingEvidence.length >= 2, 'Should aggregate multiple supporting sources');
  });

  // ── TEST 11: Attribution Statement vs Fact Distinction ────────────────────
  await runTest('TEST 11 — Attribution Statement vs Objective Fact', async () => {
    const claim = 'The CEO stated the company serves 10,000 customers.';
    const evidence = [
      { id: 'source_001', title: 'Transcript', text: 'CEO stated: We currently serve 10,000 customers.' }
    ];

    const res = await processClaimVerification(claim, evidence);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verification.status, 'SUPPORTED_BY_PROVIDED_EVIDENCE');
    assert(res.verification.summary.toLowerCase().includes('statement') || res.verification.summary.toLowerCase().includes('quote') || res.verification.summary.toLowerCase().includes('utter'), 'Summary must clarify statement verification');
  });

  // ── TEST 12: Router Category Bidding ──────────────────────────────────────
  await runTest('TEST 12 — Category Router Bidding for claim_verification', async () => {
    const fastRouting = await selectEndpointForTask('claim_verification', 'Quick evidence check for claim');
    assert.strictEqual(fastRouting.winner.endpoint_path, '/claim-verify-fast');

    const accurateRouting = await selectEndpointForTask('claim_verification', 'Detailed comprehensive deep reasoning evidence verification audit');
    assert.strictEqual(accurateRouting.winner.endpoint_path, '/claim-verify-accurate');
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
