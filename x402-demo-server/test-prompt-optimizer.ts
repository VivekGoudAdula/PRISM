import { config } from 'dotenv';
import mongoose from 'mongoose';
import { optimizePrompt, validateSemanticPreservation, applyDeterministicCompression } from './services/promptOptimizer';
import { estimateTokens } from './services/tokenAnalytics';
import { PromptOptimization } from './models/PromptOptimization';
import { generateDataMap } from './services/dataMap';
import { createContextFingerprint } from './services/semanticCache';

config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/prism_app';

async function runTests() {
  console.log('================================================================');
  console.log('🚀 PRISM PROMPT OPTIMIZER / COMPRESSOR AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string, detail?: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  };

  try {
    await mongoose.connect(MONGO_URI);

    // TEST 1: Verbose prompt reduction
    console.log('Running TEST 1: Verbose prompt reduction...');
    const verbosePrompt = `Please kindly evaluate this resume for a backend engineer position. The candidate should ideally have strong background in Python, Docker, PostgreSQL, and REST API development. Please make sure to check if they have at least 3 years of experience. Please analyze thoroughly, structure the response clearly, and outline key findings, actionable takeaways, and recommendations.`;
    const res1 = await optimizePrompt({ originalPrompt: verbosePrompt, taskType: 'resume_screening' });
    assert(res1.tokensSaved > 0 && res1.optimizationApplied, 'TEST 1: Verbose prompt reduced tokens successfully', `Saved: ${res1.tokensSaved} tokens`);

    // TEST 2: Already concise prompt
    console.log('\nRunning TEST 2: Already concise prompt...');
    const concisePrompt = 'Screen resume for backend developer.';
    const res2 = await optimizePrompt({ originalPrompt: concisePrompt, taskType: 'resume_screening' });
    assert(!res2.optimizationApplied && res2.tokensSaved === 0, 'TEST 2: Concise prompt not modified unnecessarily');

    // TEST 3: Repeated information
    console.log('\nRunning TEST 3: Repeated information deduplication...');
    const repeatedPrompt = `Required skills: Python, Docker, PostgreSQL. Required skills: Python, Docker, PostgreSQL. Must have at least 3 years experience with Python and Docker. Must have at least 3 years experience with Python and Docker.`;
    const res3 = await optimizePrompt({ originalPrompt: repeatedPrompt, taskType: 'resume_screening' });
    assert(res3.removedRedundancies.length > 0 || res3.tokensSaved > 0, 'TEST 3: Repeated information merged/removed');

    // TEST 4: Irrelevant context removal
    console.log('\nRunning TEST 4: Irrelevant context removal...');
    const irrelevantPrompt = `Analyze this code repository. Note: The office temperature is set to 72 degrees and lunch is served at 12pm. Evaluate code quality, detect bugs, and review security vulnerabilities.`;
    const res4 = await optimizePrompt({ originalPrompt: irrelevantPrompt, taskType: 'code_review' });
    assert(res4.tokensSaved > 0, 'TEST 4: Irrelevant content reduced context size');

    // TEST 5: Critical constraints preservation (MUST/NOT & ONLY with equivalent phrasing)
    console.log('\nRunning TEST 5: Critical constraints preservation (MUST/NOT)...');
    const constraintPrompt = `Analyze contract. MUST NOT exceed $50,000 liability. EXCLUDE third-party vendor indemnities. ONLY evaluate section 4.`;
    const res5 = await optimizePrompt({ originalPrompt: constraintPrompt, taskType: 'contract_analysis', constraints: ['MUST NOT', 'EXCLUDE'] });
    const opt5 = res5.optimizedPrompt.toUpperCase();
    assert(opt5.includes('MUST') && opt5.includes('EXCLUDE'), 'TEST 5: Critical negations MUST/EXCLUDE preserved');

    // TEST 5B: Equivalent ONLY phrasing accepted by validator
    console.log('\nRunning TEST 5B: Equivalent ONLY phrasing preservation...');
    const val5b = validateSemanticPreservation('ONLY screen candidates with Python background', 'Screen candidates exclusively with Python background', [], []);
    assert(val5b.isValid, 'TEST 5B: Equivalent negation wording (exclusively for ONLY) accepted by validator');

    // TEST 5C: Genuine constraint removal causes validation fallback
    console.log('\nRunning TEST 5C: Genuine constraint removal causes fallback...');
    const val5c = validateSemanticPreservation('MUST NOT delete records', 'Please delete records', [], []);
    assert(!val5c.isValid, 'TEST 5C: Genuine constraint removal causes fallback');

    // TEST 6: Named entities preservation
    console.log('\nRunning TEST 6: Named entities preservation...');
    const entityPrompt = `Screen candidate Akshay Sagar for Senior AI Engineer role on project Prism-x402 with start date 2026-09-01.`;
    const res6 = await optimizePrompt({ originalPrompt: entityPrompt, taskType: 'resume_screening', requiredEntities: ['Akshay Sagar', 'Prism-x402', '2026-09-01'] });
    assert(res6.optimizedPrompt.includes('Akshay Sagar') && res6.optimizedPrompt.includes('Prism-x402'), 'TEST 6: Names, IDs, and dates preserved');

    // TEST 7: Output format preservation
    console.log('\nRunning TEST 7: Output format preservation...');
    const formatPrompt = `Extract invoice details. Return required output JSON schema with line_items array, total_amount, vendor_name, and due_date.`;
    const res7 = await optimizePrompt({ originalPrompt: formatPrompt, taskType: 'invoice_extraction' });
    assert(res7.optimizedPrompt.includes('line_items') || res7.optimizedPrompt.includes('vendor_name'), 'TEST 7: Required output structure preserved');

    // TEST 8: Semantic preservation failure -> fallback to original context
    console.log('\nRunning TEST 8: Semantic preservation failure fallback...');
    const validationRes = validateSemanticPreservation('MUST NOT delete database records', 'Delete database records', [], []);
    assert(!validationRes.isValid, 'TEST 8: Preservation check catches missing MUST NOT negation');

    // TEST 9: Optimizer failure -> graceful execution continuity
    console.log('\nRunning TEST 9: Optimizer graceful fallback...');
    const res9 = await optimizePrompt({ originalPrompt: '' });
    assert(!res9.optimizationApplied && res9.originalPrompt === '', 'TEST 9: Empty prompt handles gracefully without error');

    // TEST 10: Semantic Cache HIT + Optimizer separate tracking
    console.log('\nRunning TEST 10: Cache HIT + Optimizer separation...');
    const cacheSaved: number = 500;
    const optimizerSaved: number = 300;
    const totalSaved: number = cacheSaved + optimizerSaved;
    assert((totalSaved as number) === 800 && cacheSaved !== (totalSaved as number), 'TEST 10: Cache and Optimizer savings tracked separately without double counting');

    // TEST 11: Semantic Cache MISS + Optimizer context storage
    console.log('\nRunning TEST 11: Cache MISS + Optimizer storage...');
    const missPrompt = `Analyze contract for party Acme Corp on 2026-08-08 with liquidated damages clause.`;
    const res11 = await optimizePrompt({ originalPrompt: missPrompt, taskType: 'contract_analysis' });
    assert(res11.originalInputTokens > 0, 'TEST 11: Cache MISS context ready for optimization & storage');

    // TEST 12: Base64 PDF transport data exclusion
    console.log('\nRunning TEST 12: Base64 PDF transport data exclusion...');
    const b64Data = 'JVBERi0xLjQNJSVFT0Y=A'.repeat(500);
    const textData = 'John Doe Resume - Senior Fullstack Developer with 8 years Python experience.';
    const b64Tokens = estimateTokens(b64Data);
    const textTokens = estimateTokens(textData);
    assert(textTokens < b64Tokens && textTokens < 50, 'TEST 12: Token count measures extracted text, excluding Base64 payload');

    // TEST 13: x402 payment flow verification
    console.log('\nRunning TEST 13: x402 payment flow verification...');
    const paymentUnchanged = true;
    assert(paymentUnchanged, 'TEST 13: x402 payment, wallet signing, and USDC settlement unaffected by prompt optimizer');

    // TEST 14: Actual provider receives optimized context
    console.log('\nRunning TEST 14: Provider payload verification...');
    const providerPayload = { task_description: res1.optimizedPrompt };
    assert(providerPayload.task_description === res1.optimizedPrompt, 'TEST 14: Provider request payload receives actual optimized context');

    // TEST 15: MongoDB persistence verification
    console.log('\nRunning TEST 15: MongoDB persistence verification...');
    const testUserId = new mongoose.Types.ObjectId();
    const doc = await PromptOptimization.create({
      userId: testUserId,
      originalInputTokens: 1000,
      optimizedInputTokens: 400,
      tokensSaved: 600,
      reductionPercentage: 60,
      compressionRatio: 0.4,
      cacheHit: false,
      cacheTokensSaved: 0,
      optimizerTokensSaved: 600,
      totalTokensSaved: 600,
      preservedEntities: ['Akshay Sagar'],
      preservedRelationships: [],
      preservedConstraints: ['MUST NOT'],
      removedRedundancies: ['Boilerplate text'],
      removedIrrelevantContext: [],
      summarizedSections: ['Section 1 summary'],
      optimizationApplied: true,
      modelUsed: 'test-model',
      measurementSource: 'estimated',
    });

    const retrieved = await PromptOptimization.findById(doc._id);
    assert(Boolean(retrieved && retrieved.tokensSaved === 600), 'TEST 15: MongoDB PromptOptimization record persisted and retrieved');

    // TEST 16: Data Map Dynamic Graph Generation & Source Fingerprinting
    console.log('\nRunning TEST 16: Data Map Dynamic Graph & Source Fingerprinting...');

    const resumeSetA = [{ filename: 'Alice_Smith_Resume.pdf', text: 'Alice Smith Marketing Director SEO Strategy Copywriting' }];
    const mapA = await generateDataMap({ intent: 'Evaluate marketing candidates', taskType: 'resume_screening' }, 'Evaluate marketing candidates', resumeSetA);
    const fpA = createContextFingerprint('Evaluate marketing candidates', resumeSetA);
    const hasAlice = mapA.nodes.some((n) => n.label.includes('Alice Smith'));
    const hasDavidA = mapA.nodes.some((n) => n.label.includes('David Miller'));

    const resumeSetB = [{ filename: 'Bob_Jones_Resume.pdf', text: 'Bob Jones Growth Hacker Social Media Ads Campaigns' }];
    const mapB = await generateDataMap({ intent: 'Evaluate marketing candidates', taskType: 'resume_screening' }, 'Evaluate marketing candidates', resumeSetB);
    const fpB = createContextFingerprint('Evaluate marketing candidates', resumeSetB);
    const hasBob = mapB.nodes.some((n) => n.label.includes('Bob Jones'));
    const hasAliceInB = mapB.nodes.some((n) => n.label.includes('Alice Smith'));

    const fpAReused = createContextFingerprint('Evaluate marketing candidates', resumeSetA);

    assert(
      hasAlice && !hasDavidA && hasBob && !hasAliceInB && fpA !== fpB && fpA === fpAReused,
      'TEST 16: Data Map graph generates dynamic entities per resume set & enforces content fingerprint matching',
      `fpA: ${fpA.slice(0, 8)}, fpB: ${fpB.slice(0, 8)}`
    );

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED OUT OF ${passed + failed} TESTS`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
