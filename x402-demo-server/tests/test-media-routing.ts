import { handleClassifyTaskRequest } from '../handlers/classify-task';
import { selectEndpointForTask } from '../handlers/select-endpoint';

async function runTests() {
  console.log('====================================================');
  console.log('PRISM ROUTING TEST VERIFICATION (Prompts A-E)');
  console.log('====================================================\n');

  const tests = [
    { name: 'Test A (Claim Extraction)', prompt: 'extract claims from this article', expectedCategory: 'claim_extraction', expectedEndpoint: '/claim-extract-fast' },
    { name: 'Test B (Claim Verification)', prompt: 'verify this claim using the evidence in the document', expectedCategory: 'claim_verification', expectedEndpoint: '/claim-verify-fast' },
    { name: 'Test C (Source Comparison)', prompt: 'compare these sources and identify agreements and conflicts', expectedCategory: 'source_comparison', expectedEndpoint: '/source-compare-fast' },
    { name: 'Test D (News Research)', prompt: 'research these sources, identify claims and conflicts, and produce a research brief', expectedCategory: 'news_research', expectedEndpoint: '/news-research-fast' },
    { name: 'Test E (Resume Screening)', prompt: 'screen this candidate for a senior software engineer role', expectedCategory: 'resume_screening', expectedEndpoint: '/resume-screen-fast' },
  ];

  let passed = 0;
  for (const t of tests) {
    console.log(`Testing [${t.name}]...`);
    console.log(`  Prompt: "${t.prompt}"`);

    const mockCtx = {
      req: { json: async () => ({ task_description: t.prompt, has_files: true }) },
      json: (data: any) => data,
    } as any;

    const classRes: any = await handleClassifyTaskRequest(mockCtx);
    const category = classRes.category;
    console.log(`  Category Detected: ${category}`);

    const selectRes = await selectEndpointForTask(category, t.prompt);
    const endpoint = selectRes.winner.endpoint_path;
    console.log(`  Endpoint Selected: ${endpoint}`);

    const catPass = category === t.expectedCategory;
    const epPass = endpoint.startsWith(t.expectedEndpoint.replace('-fast', '')) || endpoint === t.expectedEndpoint;

    if (catPass && epPass) {
      console.log(`  STATUS: ✅ PASS\n`);
      passed++;
    } else {
      console.log(`  STATUS: ❌ FAIL (Expected category ${t.expectedCategory}, endpoint ${t.expectedEndpoint})\n`);
    }
  }

  console.log('====================================================');
  console.log(`TOTAL RESULT: ${passed} / ${tests.length} PASSED`);
  console.log('====================================================\n');
}

runTests().catch(console.error);
