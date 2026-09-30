import assert from 'assert';
import { processClaimExtraction } from '../handlers/claim-extract-fast';

async function runQualityTests() {
  console.log('====================================================');
  console.log('PRISM — CLAIM EXTRACTION QUALITY & ATOMICITY TEST');
  console.log('====================================================\n');

  // Test document mimicking PDF line wrapping, title headers, test metadata, attribution, etc.
  const pdfSampleText = `NEWS ARTICLE — NORTHSTAR ENERGY
ANNOUNCES RENEWABLE PROJECT

Synthetic PRISM Media Intelligence Test Document
Testing purpose: agreements, conflicts, attribution, qualifiers, temporal differences, and research gaps.

NorthStar Energy announced on Monday that it launched a major solar project in Texas.

Chief Executive Officer Maya Rao said the program is expected to create approximately 500
jobs over the next three years.

According to financial reports, the company invested $120 million in the Texas facility during 2025.

In a statement, Maya Rao declared that renewable energy capacity grew by 35% in Q1 2026.`;

  console.log('--- Input Raw PDF Text ---');
  console.log(pdfSampleText);
  console.log('---------------------------\n');

  const res = await processClaimExtraction(pdfSampleText, 'ARTICLE');
  
  console.log('--- Extraction Output ---');
  console.log(`Document Type: ${res.documentType}`);
  console.log(`Claim Count: ${res.claimCount}`);
  console.log(JSON.stringify(res.claims, null, 2));

  // Assertions:
  const claims = res.claims || [];

  // Check 1: No Title extracted as claim
  const titleAsClaim = claims.some((c: any) =>
    c.claim.toUpperCase().includes('NEWS ARTICLE') ||
    c.claim.toUpperCase().includes('NORTHSTAR ENERGY') && c.claim.length < 35
  );
  assert(!titleAsClaim, 'Document title MUST NOT be extracted as a claim');

  // Check 2: No test metadata extracted as claim
  const metadataAsClaim = claims.some((c: any) =>
    c.claim.toLowerCase().includes('synthetic prism') ||
    c.claim.toLowerCase().includes('testing purpose')
  );
  assert(!metadataAsClaim, 'Test metadata and instructions MUST NOT be extracted as claims');

  // Check 3: Line-wrapped sentence unified (not fragmented)
  const lineWrapFragment = claims.some((c: any) =>
    c.claim.toLowerCase().startsWith('jobs over the next') ||
    c.claim.toLowerCase().endsWith('create approximately 500')
  );
  assert(!lineWrapFragment, 'Line-wrapped sentences MUST NOT be fragmented into partial claims');

  // Check 4: Check unified line-wrap claim text contains full sentence
  const unifiedJobClaim = claims.find((c: any) => c.claim.includes('500') && c.claim.includes('jobs'));
  assert(unifiedJobClaim, 'Must contain complete unified claim about 500 jobs over three years');

  // Check 5: Attribution check
  assert(unifiedJobClaim.attribution.includes('Maya Rao'), `Attribution should be Maya Rao, got: ${unifiedJobClaim.attribution}`);

  // Check 6: Paragraph indices
  console.log('\n--- Paragraph Location Verification ---');
  claims.forEach((c: any) => {
    console.log(`[${c.id}] Para ${c.sourceLocation.paragraph}: "${c.claim.slice(0, 50)}..." (Attr: ${c.attribution})`);
    assert(c.sourceLocation.paragraph > 0, 'Paragraph index must be > 0');
  });

  console.log('\n✅ ALL CLAIM EXTRACTION QUALITY & ATOMICITY TESTS PASSED!');
}

runQualityTests().catch((err) => {
  console.error('❌ Quality test failed:', err.message || err);
  process.exit(1);
});
