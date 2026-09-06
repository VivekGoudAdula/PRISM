import assert from 'assert';
import { processSourceComparison } from './handlers/source-compare-fast';
import { verifyOutput } from './handlers/lib/verify-output';
import { selectEndpointForTask } from './handlers/select-endpoint';

async function runTests() {
  console.log('====================================================');
  console.log('PRISM — SOURCE-COMPARE ENDPOINT TEST SUITE');
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

  // ── TEST 1: Full Agreement ────────────────────────────────────────────────
  await runTest('TEST 1 — Full Agreement Across Sources', async () => {
    const sources = [
      { id: 'source_001', title: 'News Article A', text: 'Acme Technologies raised $25 million in Series B funding.' },
      { id: 'source_002', title: 'Press Release', text: 'Acme secured $25 million in a Series B round.' }
    ];

    const res = await processSourceComparison(sources);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.sourceCount, 2);
    assert(res.agreements.length >= 1, 'Must contain agreement card');
    assert.strictEqual(res.conflicts.length, 0, 'No conflicts expected');

    const v = verifyOutput('source_comparison', res);
    assert.strictEqual(v.passed, true, 'verifyOutput must pass for valid comparison');
  });

  // ── TEST 2: Numeric Conflict ──────────────────────────────────────────────
  await runTest('TEST 2 — Numeric Conflict Detection', async () => {
    const sources = [
      { id: 'source_001', title: 'Source A', text: 'Acme Corp raised $25 million in Series B funding.' },
      { id: 'source_002', title: 'Source B', text: 'Acme Corp raised $20 million in Series B funding.' }
    ];

    const res = await processSourceComparison(sources);

    assert.strictEqual(res.success, true);
    assert(res.conflicts.length >= 1, 'Must surface conflict card');
    const conflict = res.conflicts[0];
    assert(conflict.description.includes('$25 million') && conflict.description.includes('$20 million'), 'Must document numerical difference');
  });

  // ── TEST 3: Date Conflict ─────────────────────────────────────────────────
  await runTest('TEST 3 — Date Conflict Detection', async () => {
    const sources = [
      { id: 'source_001', title: 'Local Paper', text: 'Acme opened its Hyderabad office in March 2026.' },
      { id: 'source_002', title: 'Tech Blog', text: 'Acme opened its Hyderabad office in June 2026.' }
    ];

    const res = await processSourceComparison(sources);

    assert.strictEqual(res.success, true);
    assert(res.conflicts.length >= 1, 'Must surface date conflict');
  });

  // ── TEST 4: Partial Agreement ──────────────────────────────────────────────
  await runTest('TEST 4 — Partial Agreement Detection', async () => {
    const sources = [
      { id: 'source_001', title: 'PR Wire', text: 'Acme raised $25 million in Series B funding in March.' },
      { id: 'source_002', title: 'Financial Post', text: 'Acme raised $25 million in Series B funding in April.' }
    ];

    const res = await processSourceComparison(sources);

    assert.strictEqual(res.success, true);
    assert(res.claims.some((c: any) => c.status === 'PARTIAL_AGREEMENT' || res.conflicts.length >= 1), 'Must identify partial agreement or date conflict');
  });

  // ── TEST 5: Unique Claim ──────────────────────────────────────────────────
  await runTest('TEST 5 — Unique / Uncorroborated Claim', async () => {
    const sources = [
      { id: 'source_001', title: 'Exclusive Interview', text: 'Acme Corp has 50,000 customers. Acme raised $25 million in Series B funding.' },
      { id: 'source_002', title: 'Industry Report', text: 'Acme Corp raised $25 million in Series B funding.' }
    ];

    const res = await processSourceComparison(sources);

    assert.strictEqual(res.success, true);
    assert(res.uncorroboratedClaims.length >= 1, 'Must flag 50,000 customers claim as uncorroborated in source set');
    assert.strictEqual(res.uncorroboratedClaims[0].sourceId, 'source_001');
  });

  // ── TEST 6: Missing Information Gap ─────────────────────────────────────
  await runTest('TEST 6 — Missing Information Identification', async () => {
    const sources = [
      { id: 'source_001', title: 'Article 1', text: 'Acme raised Series B funding.' },
      { id: 'source_002', title: 'Article 2', text: 'Acme announced new funding.' }
    ];

    const res = await processSourceComparison(sources);

    assert.strictEqual(res.success, true);
    assert(res.missingInformation.length >= 1, 'Must identify missing information gap');
  });

  // ── TEST 7: Qualifier Difference ─────────────────────────────────────────
  await runTest('TEST 7 — Qualifier Difference Preservation', async () => {
    const sources = [
      { id: 'source_001', title: 'News A', text: 'Acme opened its first Hyderabad office in March 2026.' },
      { id: 'source_002', title: 'News B', text: 'Acme opened a Hyderabad office in March 2026.' }
    ];

    const res = await processSourceComparison(sources);

    assert.strictEqual(res.success, true);
    assert(res.conflicts.length >= 1 || res.claims.some((c: any) => c.status === 'PARTIAL_AGREEMENT'), 'Must preserve qualifier distinction ("first" office)');
  });

  // ── TEST 8: Attribution Preservation ────────────────────────────────────
  await runTest('TEST 8 — Attribution Preservation across Sources', async () => {
    const sources = [
      { id: 'source_001', title: 'Transcript', text: 'The CEO stated the company has 10,000 customers.' },
      { id: 'source_002', title: 'Filing', text: 'The company reported 8,000 customers.' }
    ];

    const res = await processSourceComparison(sources);

    assert.strictEqual(res.success, true);
    assert(res.conflicts.length >= 1, 'Must detect conflict between attributed statement and reported metric');
  });

  // ── TEST 9: Entity Mismatch Prevention ───────────────────────────────────
  await runTest('TEST 9 — Entity Mismatch Prevention', async () => {
    const sources = [
      { id: 'source_001', title: 'Report A', text: 'Acme Corp raised $25 million.' },
      { id: 'source_002', title: 'Report B', text: 'Beta Corp raised $25 million.' }
    ];

    const res = await processSourceComparison(sources);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.agreements.length, 0, 'Must NOT group claims from different entities as agreements');
  });

  // ── TEST 10: Temporal Mismatch ────────────────────────────────────────────
  await runTest('TEST 10 — Temporal Mismatch Detection', async () => {
    const sources = [
      { id: 'source_001', title: '2025 Report', text: 'Revenue reached $20 million in 2025.' },
      { id: 'source_002', title: '2024 Report', text: 'Revenue reached $20 million in 2024.' }
    ];

    const res = await processSourceComparison(sources);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.agreements.length, 0, 'Must NOT treat different years as agreement');
  });

  // ── TEST 11: Three-Source Agreement ──────────────────────────────────────
  await runTest('TEST 11 — Three-Source Consistency', async () => {
    const sources = [
      { id: 'source_001', title: 'Source A', text: 'Acme opened its Hyderabad office in March 2026.' },
      { id: 'source_002', title: 'Source B', text: 'The Hyderabad office opened in March 2026.' },
      { id: 'source_003', title: 'Source C', text: 'Acme Hyderabad office began operations in March.' }
    ];

    const res = await processSourceComparison(sources);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.sourceCount, 3);
    assert(res.agreements.length >= 1, 'Must establish 3-source agreement');
  });

  // ── TEST 12: Category Router Bidding ──────────────────────────────────────
  await runTest('TEST 12 — Category Router Bidding for source_comparison', async () => {
    const fastRouting = await selectEndpointForTask('source_comparison', 'Fast source comparison');
    assert.strictEqual(fastRouting.winner.endpoint_path, '/source-compare-fast');

    const accurateRouting = await selectEndpointForTask('source_comparison', 'Deep comprehensive high precision source comparison audit');
    assert.strictEqual(accurateRouting.winner.endpoint_path, '/source-compare-accurate');
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
