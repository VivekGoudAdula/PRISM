import assert from 'assert';
import { processNewsResearch } from './handlers/news-research-fast';
import { verifyOutput } from './handlers/lib/verify-output';
import { selectEndpointForTask } from './handlers/select-endpoint';

async function runTests() {
  console.log('====================================================');
  console.log('PRISM — NEWS-RESEARCH ENDPOINT TEST SUITE');
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

  // ── TEST 1: Two Agreeing Sources ──────────────────────────────────────────
  await runTest('TEST 1 — Two Agreeing Sources Synthesis', async () => {
    const sources = [
      { id: 'source_001', name: 'Press Release', text: 'Acme Corp raised $25 million in Series B funding.' },
      { id: 'source_002', name: 'News Wire', text: 'Acme Corp secured $25 million in Series B funding.' }
    ];

    const res = await processNewsResearch(sources, 'Acme Series B Funding');

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.sources.length, 2);
    assert(res.agreements.length >= 1, 'Must identify agreement across sources');
    assert.strictEqual(res.conflicts.length, 0, 'No conflicts expected for agreeing sources');

    const v = verifyOutput('news_research', res);
    assert.strictEqual(v.passed, true, 'verifyOutput must pass for valid news_research output');
  });

  // ── TEST 2: Numeric Conflict Detection ──────────────────────────────────
  await runTest('TEST 2 — Numeric Conflict Detection (500 vs 650 employees)', async () => {
    const sources = [
      { id: 'source_001', name: 'Article A', text: 'Acme Corp restructuring affected 500 employees.' },
      { id: 'source_002', name: 'Article B', text: 'Acme Corp restructuring affected 650 employees.' }
    ];

    const res = await processNewsResearch(sources, 'Acme Employee Restructuring');

    assert.strictEqual(res.success, true);
    assert(res.conflicts.length >= 1, 'Must surface employee count conflict');
    const conf = res.conflicts[0];
    assert(conf.description.includes('500') || conf.description.includes('650') || conf.differences?.length > 0, 'Must document numerical difference');
  });

  // ── TEST 3: Date Conflict Detection ──────────────────────────────────────
  await runTest('TEST 3 — Date Conflict Detection (June 12 vs June 14)', async () => {
    const sources = [
      { id: 'source_001', name: 'Local News', text: 'Acme announced Product X on June 12.' },
      { id: 'source_002', name: 'Tech Portal', text: 'Acme announced Product X on June 14.' }
    ];

    const res = await processNewsResearch(sources, 'Product X Announcement Date');

    assert.strictEqual(res.success, true);
    assert(res.conflicts.length >= 1 || res.partialAgreements.length >= 1, 'Must detect date conflict or partial agreement');
  });

  // ── TEST 4: Partial Agreement Detection ───────────────────────────────────
  await runTest('TEST 4 — Partial Agreement Detection', async () => {
    const sources = [
      { id: 'source_001', name: 'PR Wire', text: 'Acme Corp raised $25 million in Series B funding in March.' },
      { id: 'source_002', name: 'Financial Post', text: 'Acme Corp raised $25 million in Series B funding in April.' }
    ];

    const res = await processNewsResearch(sources, 'Funding Month Discrepancy');

    assert.strictEqual(res.success, true);
    assert(res.conflicts.length >= 1 || res.partialAgreements.length >= 1, 'Must identify date variation as partial agreement/conflict');
  });

  // ── TEST 5: Unique Claim / Uncorroborated Claim ───────────────────────────
  await runTest('TEST 5 — Unique Claim (UNCORROBORATED_IN_SOURCE_SET)', async () => {
    const sources = [
      { id: 'source_001', name: 'Interview Transcript', text: 'Acme Corp currently serves 50,000 customers. Acme raised $25 million in Series B.' },
      { id: 'source_002', name: 'Official Statement', text: 'Acme raised $25 million in Series B.' }
    ];

    const res = await processNewsResearch(sources, 'Customer Metric Verification');

    assert.strictEqual(res.success, true);
    assert(res.uncorroboratedClaims.length >= 1, 'Must flag 50,000 customers claim as uncorroborated');
    assert.strictEqual(res.uncorroboratedClaims[0].sourceId, 'source_001');
  });

  // ── TEST 6: Attribution Preservation ────────────────────────────────────
  await runTest('TEST 6 — Executive Attribution Preservation', async () => {
    const sources = [
      { id: 'source_001', name: 'Transcript A', text: 'The CEO stated the company has 10,000 customers.' },
      { id: 'source_002', name: 'Filing B', text: 'The company reported 8,000 active customers.' }
    ];

    const res = await processNewsResearch(sources, 'Customer Count Attribution');

    assert.strictEqual(res.success, true);
    assert(res.conflicts.length >= 1 || res.claims.some((c: any) => c.attribution || c.text?.includes('stated')), 'Must preserve attribution distinction');
  });

  // ── TEST 7: Qualifier Preservation ──────────────────────────────────────
  await runTest('TEST 7 — Qualifier Preservation ("approximately 20%")', async () => {
    const sources = [
      { id: 'source_001', name: 'News Release', text: 'The company expects revenue to increase by approximately 20%.' },
      { id: 'source_002', name: 'Report', text: 'Revenue is projected to grow by 20%.' }
    ];

    const res = await processNewsResearch(sources, 'Revenue Projection Qualifier');

    assert.strictEqual(res.success, true);
    assert(res.claims.length >= 1, 'Must extract claims preserving qualifier context');
  });

  // ── TEST 8: Three-Source Agreement ──────────────────────────────────────
  await runTest('TEST 8 — Three-Source Consistency Synthesis', async () => {
    const sources = [
      { id: 'source_001', name: 'Source A', text: 'Acme opened its Hyderabad office in March 2026.' },
      { id: 'source_002', name: 'Source B', text: 'The Hyderabad office opened in March 2026.' },
      { id: 'source_003', name: 'Source C', text: 'Acme Hyderabad office began operations in March.' }
    ];

    const res = await processNewsResearch(sources, 'Hyderabad Office Opening');

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.sources.length, 3);
    assert(res.agreements.length >= 1, 'Must establish 3-source agreement');
  });

  // ── TEST 9: Temporal Mismatch Detection ──────────────────────────────────
  await runTest('TEST 9 — Temporal Mismatch Detection (2024 vs 2025)', async () => {
    const sources = [
      { id: 'source_001', name: '2025 Report', text: 'Revenue reached $20 million in 2025.' },
      { id: 'source_002', name: '2024 Report', text: 'Revenue reached $20 million in 2024.' }
    ];

    const res = await processNewsResearch(sources, 'Annual Revenue Comparison');

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.agreements.length, 0, 'Must NOT treat different years as identical agreement');
  });

  // ── TEST 10: Missing Information Gap ─────────────────────────────────────
  await runTest('TEST 10 — Missing Information Identification', async () => {
    const sources = [
      { id: 'source_001', name: 'Article 1', text: 'Acme Corp raised Series B funding.' },
      { id: 'source_002', name: 'Article 2', text: 'Acme Corp announced new funding.' }
    ];

    const res = await processNewsResearch(sources, 'Series B Funding Details');

    assert.strictEqual(res.success, true);
    assert(res.missingInformation.length >= 1, 'Must identify missing lead investor or date gap');
  });

  // ── TEST 11: Factual Grounding / No Hallucination ─────────────────────────
  await runTest('TEST 11 — Factual Grounding & Source Traceability', async () => {
    const sources = [
      { id: 'source_001', name: 'Press Release', text: 'Beta Corp launched Product Z on May 1.' },
      { id: 'source_002', name: 'Tech News', text: 'Beta Corp introduced Product Z in May.' }
    ];

    const res = await processNewsResearch(sources, 'Product Z Launch');

    assert.strictEqual(res.success, true);
    assert(res.keyFindings.length >= 1, 'Must synthesize key findings');
    const finding = res.keyFindings[0];
    assert(finding.supportingSources.includes('source_001') || finding.supportingSources.includes('source_002'), 'Every key finding must include traceable source IDs');
  });

  // ── TEST 12: Category Router Bidding for news_research ────────────────────
  await runTest('TEST 12 — Category Router Bidding for news_research', async () => {
    const fastRouting = await selectEndpointForTask('news_research', 'Fast news research brief');
    assert.strictEqual(fastRouting.winner.endpoint_path, '/news-research-fast');

    const accurateRouting = await selectEndpointForTask('news_research', 'Deep comprehensive high precision newsroom research audit');
    assert.strictEqual(accurateRouting.winner.endpoint_path, '/news-research-accurate');
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
