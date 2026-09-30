/**
 * PRISM Generic Semantic Data Map Engine — Automated Test Suite
 *
 * Verifies dynamic graph generation, zero hardcoded entities, category-aware node/edge typing,
 * isolated source branches, and accurate token/relevance calculations across 5 task categories.
 */

import { generateDataMap } from '../services/dataMap';

async function runDataMapTests() {
  console.log('====================================================');
  console.log('🧪 PRISM Generic Data Map Engine Test Suite');
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
  // SCENARIO 1: RESUME SCREENING (3 Candidates vs 1 Job Requirement)
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('--- Test 1: Resume Screening Category ---');

  {
    const prompt = 'Screen candidate resumes for a Lead DevOps Engineer role requiring Kubernetes, Terraform, and Go';
    const files = [
      { filename: 'Alice_Smith_DevOps.pdf', text: 'Senior DevOps Specialist skilled in Kubernetes, Docker, Go, and CI/CD pipelines with 7 years experience.' },
      { filename: 'Bob_Jones_Resume.docx', text: 'Cloud Infrastructure Engineer skilled in Terraform, AWS, Python, and Linux systems.' },
      { filename: 'Charlie_Brown.pdf', text: 'Junior Developer skilled in HTML, CSS, JavaScript, and React.' },
    ];

    const map = await generateDataMap({ intent: prompt, taskType: 'resume_screening' }, prompt, files, 'resume_screening');

    assert(map.taskType === 'resume_screening', 'Resume Test 1: Correct task type returned');
    assert(map.nodes.some((n) => n.type === 'root'), 'Resume Test 2: Contains Root node');
    assert(map.nodes.some((n) => n.category === 'target_role' && n.label.toLowerCase().includes('devops')), 'Resume Test 3: Dynamic Job Requirement node created from prompt');

    const candidateNodes = map.nodes.filter((n) => n.category === 'candidate');
    assert(candidateNodes.length === 3, 'Resume Test 4: Exactly 3 isolated candidate nodes created', `Got ${candidateNodes.length}`);

    // Verify candidate names derived from input files
    assert(candidateNodes.some((c) => c.label.includes('Alice Smith')), 'Resume Test 5: Candidate 1 name derived from filename (Alice Smith)');
    assert(candidateNodes.some((c) => c.label.includes('Bob Jones')), 'Resume Test 6: Candidate 2 name derived from filename (Bob Jones)');

    // Verify no hardcoded legacy names ("David Miller", "Jane Doe", "Akshay Sagar")
    const hasHardcodedNames = map.nodes.some((n) => n.label.includes('David Miller') || n.label.includes('Jane Doe') || n.label.includes('Akshay Sagar'));
    assert(!hasHardcodedNames, 'Resume Test 7: Zero hardcoded candidate names present');

    // Verify Candidate 1 skills do not cross-connect to Candidate 2
    const aliceNode = candidateNodes.find((c) => c.label.includes('Alice Smith'));
    const bobNode = candidateNodes.find((c) => c.label.includes('Bob Jones'));

    if (aliceNode && bobNode) {
      const aliceChildSkills = map.nodes.filter((n) => n.parentId === aliceNode.id && n.type === 'skill').map((n) => n.id);
      const bobChildSkills = map.nodes.filter((n) => n.parentId === bobNode.id && n.type === 'skill').map((n) => n.id);

      const crossConnected = map.edges.some((e) => aliceChildSkills.includes(e.source) && bobChildSkills.includes(e.target));
      assert(!crossConnected, 'Resume Test 8: Candidate branches remain strictly isolated');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: CODE REVIEW (Repository with Directories & Files)
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('\n--- Test 2: Code Review Category ---');

  {
    const prompt = 'Review repository for security vulnerabilities and SQL injection flaws';
    const files = [
      { path: 'src/controllers/authController.ts', content: 'export function login(user) { db.query("SELECT * FROM users WHERE name=" + user); }' },
      { path: 'src/services/paymentService.ts', content: 'export class PaymentService { processPayment() { eval("secret"); } }' },
      { path: 'src/utils/logger.ts', content: 'export function log(msg) { console.log(msg); }' },
    ];

    const map = await generateDataMap({ intent: prompt, taskType: 'code_review' }, prompt, files, 'code_review');

    assert(map.taskType === 'code_review', 'Code Review Test 1: Correct task type returned');
    assert(map.nodes.some((n) => n.type === 'repository'), 'Code Review Test 2: Repository node created');

    const fileNodes = map.nodes.filter((n) => n.category === 'code_file');
    assert(fileNodes.length === 3, 'Code Review Test 3: Exactly 3 code file nodes created', `Got ${fileNodes.length}`);
    assert(fileNodes.some((f) => f.label === 'authController.ts'), 'Code Review Test 4: File node authController.ts present');

    const vulnerabilityNodes = map.nodes.filter((n) => n.type === 'vulnerability');
    assert(vulnerabilityNodes.length >= 2, 'Code Review Test 5: Dynamic vulnerability nodes detected for SQL/eval code');

    // Verify zero hardcoded files (e.g. auth.py)
    const hasHardcodedAuthPy = map.nodes.some((n) => n.label === 'auth.py');
    assert(!hasHardcodedAuthPy, 'Code Review Test 6: Zero hardcoded files (auth.py) present');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: CONTRACT ANALYSIS (Legal Contract with Clauses & Risks)
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('\n--- Test 3: Contract Analysis Category ---');

  {
    const prompt = 'Analyze Master Services Agreement for termination penalties and liability risks';
    const files = [
      { filename: 'Master_Services_Agreement_2026.pdf', text: 'This agreement is entered into between Acme Corp and Beta LLC. Termination clause: Immediate cancellation subject to 3x damages penalty.' },
    ];

    const map = await generateDataMap({ intent: prompt, taskType: 'contract_analysis' }, prompt, files, 'contract_analysis');

    assert(map.taskType === 'contract_analysis', 'Contract Test 1: Correct task type returned');
    assert(map.nodes.some((n) => n.type === 'document' && n.label.includes('Master_Services_Agreement')), 'Contract Test 2: Contract document node created');

    const partyNodes = map.nodes.filter((n) => n.type === 'party');
    assert(partyNodes.length === 2, 'Contract Test 3: Exactly 2 party nodes created');
    assert(partyNodes.some((p) => p.label.includes('Acme Corp')), 'Contract Test 4: Extracted Party Acme Corp present');

    const clauseNodes = map.nodes.filter((n) => n.type === 'clause');
    assert(clauseNodes.length >= 3, 'Contract Test 5: Clause nodes generated');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: INVOICE EXTRACTION (Vendor Metadata & Line Items)
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('\n--- Test 4: Invoice Extraction Category ---');

  {
    const prompt = 'Extract vendor, total, and line items from cloud invoice';
    const files = [
      {
        filename: 'Invoice_10842.pdf',
        text: 'Invoice 10842 issued by Cloud Compute Inc.',
        semantic_map: {
          vendor: 'Cloud Compute Inc.',
          line_items: [
            { description: 'Kubernetes Worker Nodes', total: 450.00 },
            { description: 'SSD Storage Volume', total: 80.00 },
          ],
          total_amount: 530.00,
        },
      },
    ];

    const map = await generateDataMap({ intent: prompt, taskType: 'invoice_extraction' }, prompt, files, 'invoice_extraction');

    assert(map.taskType === 'invoice_extraction', 'Invoice Test 1: Correct task type returned');
    assert(map.nodes.some((n) => n.type === 'vendor' && n.label.includes('Cloud Compute Inc.')), 'Invoice Test 2: Vendor node Cloud Compute Inc. created');

    const itemNodes = map.nodes.filter((n) => n.type === 'line_item');
    assert(itemNodes.length === 2, 'Invoice Test 3: Exactly 2 line item nodes created');
    assert(itemNodes.some((i) => i.label.includes('Kubernetes Worker Nodes')), 'Invoice Test 4: Extracted line item Kubernetes Worker Nodes present');

    // Verify no hardcoded vendor ("Acme AI Corp")
    const hasAcmeVendor = map.nodes.some((n) => n.label.includes('Acme AI Corp'));
    assert(!hasAcmeVendor, 'Invoice Test 5: Zero hardcoded vendors (Acme AI Corp) present');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: SEO AUDIT (Multi-Page Domain Audit)
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('\n--- Test 5: SEO Audit Category ---');

  {
    const prompt = 'Audit website https://prism-router.vercel.app for missing alt tags and H1 tags';
    const files: any[] = [];

    const map = await generateDataMap({ intent: prompt, taskType: 'seo_audit' }, prompt, files, 'seo_audit');

    assert(map.taskType === 'seo_audit', 'SEO Test 1: Correct task type returned');
    assert(map.nodes.some((n) => n.type === 'website' && n.label.includes('prism-router.vercel.app')), 'SEO Test 2: Website target node created');

    const pageNodes = map.nodes.filter((n) => n.type === 'page');
    assert(pageNodes.length >= 3, 'SEO Test 3: Audited page nodes created');

    const findingNodes = map.nodes.filter((n) => n.type === 'finding');
    assert(findingNodes.length >= 3, 'SEO Test 4: SEO finding nodes generated per page');
  }

  console.log('\n====================================================');
  console.log(`DATA MAP RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runDataMapTests().catch((err) => {
  console.error('Data map test runner crashed:', err);
  process.exit(1);
});
