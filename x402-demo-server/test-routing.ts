import { selectEndpointForTask } from './handlers/select-endpoint';
import mongoose from 'mongoose';

async function runTests() {
  console.log('====================================================');
  console.log('       PRISM PROVIDER ROUTING VERIFICATION TESTS');
  console.log('====================================================\n');

  // Test 1: "quick resume screening" selects FAST provider
  const res1 = await selectEndpointForTask('resume_screening', 'quick resume screening for senior developer');
  console.log('[Test 1] "quick resume screening":');
  console.log('  Selected:', res1.winner.endpoint_path);
  console.log('  Reason:', res1.routingReason);
  console.log('  Exploration Used:', res1.explorationUsed);
  if (res1.winner.endpoint_path !== '/resume-screen-fast') {
    throw new Error('Test 1 Failed: Expected /resume-screen-fast');
  }
  console.log('  -> PASSED ✓\n');

  // Test 2: "detailed high-precision resume analysis" selects ACCURATE provider
  const res2 = await selectEndpointForTask('resume_screening', 'detailed high-precision resume analysis for engineering leadership');
  console.log('[Test 2] "detailed high-precision resume analysis":');
  console.log('  Selected:', res2.winner.endpoint_path);
  console.log('  Reason:', res2.routingReason);
  console.log('  Exploration Used:', res2.explorationUsed);
  if (res2.winner.endpoint_path !== '/resume-screen-accurate') {
    throw new Error('Test 2 Failed: Expected /resume-screen-accurate');
  }
  console.log('  -> PASSED ✓\n');

  // Test 3: Exploration NEVER overrides explicit accuracy requirement
  let explorationViolated = false;
  for (let i = 0; i < 50; i++) {
    const r = await selectEndpointForTask('resume_screening', `detailed high-precision analysis requirement sample ${i}`);
    if (r.winner.endpoint_path !== '/resume-screen-accurate' || r.explorationUsed) {
      explorationViolated = true;
      break;
    }
  }
  console.log('[Test 3] Exploration constraint check (50 runs with explicit accuracy):');
  console.log('  Exploration Violated:', explorationViolated);
  if (explorationViolated) {
    throw new Error('Test 3 Failed: Exploration improperly overrode explicit accuracy requirement!');
  }
  console.log('  -> PASSED ✓\n');

  // Test 4: Incompatible providers are never selected
  let incompatibleSelected = false;
  for (const cat of ['claim_extraction', 'resume_screening', 'contract_analysis', 'invoice_extraction', 'code_review', 'seo_audit']) {
    const r = await selectEndpointForTask(cat, 'analyze query');
    const validEndpoints = r.eligibleProviders;
    if (!validEndpoints.includes(r.winner.endpoint_path)) {
      incompatibleSelected = true;
      break;
    }
  }
  console.log('[Test 4] Category isolation (incompatible providers check):');
  console.log('  Incompatible Selected:', incompatibleSelected);
  if (incompatibleSelected) {
    throw new Error('Test 4 Failed: Endpoint from wrong category selected!');
  }
  console.log('  -> PASSED ✓\n');

  // Test 5: 10 Sample Routing Decisions
  console.log('----------------------------------------------------');
  console.log('          10 SAMPLE ROUTING DECISIONS');
  console.log('----------------------------------------------------');
  const samplePrompts = [
    { cat: 'resume_screening', prompt: 'Quick initial screening for backend candidates' },
    { cat: 'resume_screening', prompt: 'Detailed high-precision resume evaluation' },
    { cat: 'resume_screening', prompt: 'Screen these resumes for a software engineer role' },
    { cat: 'contract_analysis', prompt: 'Simple and cheap contract clause check' },
    { cat: 'contract_analysis', prompt: 'Deep comprehensive legal risk and liability audit' },
    { cat: 'code_review', prompt: 'Quick scan of PR files' },
    { cat: 'code_review', prompt: 'Thorough security and senior-engineer review of source files' },
    { cat: 'seo_audit', prompt: 'Audit our website https://example.com for SEO issues' },
    { cat: 'seo_audit', prompt: 'Deep comprehensive SEO quality and readability audit' },
    { cat: 'invoice_extraction', prompt: 'Extract vendor total from invoice' },
  ];

  let sampleIdx = 1;
  for (const item of samplePrompts) {
    const r = await selectEndpointForTask(item.cat, item.prompt);
    console.log(`[Request ${sampleIdx++}] Category: ${item.cat}`);
    console.log(`  Prompt: "${item.prompt}"`);
    console.log(`  Selected: ${r.winner.endpoint_path} ($${r.winner.price})`);
    console.log(`  Reason: ${r.routingReason}`);
    console.log(`  Exploration: ${r.explorationUsed ? 'YES' : 'NO'}`);
    console.log(`  Eligible: ${r.eligibleProviders.join(', ')}\n`);
  }

  console.log('====================================================');
  console.log('           ALL ROUTING TESTS PASSED ✓');
  console.log('====================================================');
  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
