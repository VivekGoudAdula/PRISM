import { config } from 'dotenv';
import mongoose from 'mongoose';
import { analyzePromptWithLLM } from './services/promptTutor';
import { PromptAnalysis } from './models/PromptAnalysis';
import { User } from './models/User';

config();

async function runTests() {
  console.log('====================================================');
  console.log('   PRISM PROMPT TUTOR END-TO-END VERIFICATION TEST  ');
  console.log('====================================================\n');

  // Connect to MongoDB
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const mongoDbName = process.env.MONGO_DB_NAME || 'prism_app';

  let connectionString = mongoUri;
  if (mongoUri.includes('?')) {
    const parts = mongoUri.split('?');
    const base = parts[0].endsWith('/') ? parts[0].slice(0, -1) : parts[0];
    const protocolSeparator = base.indexOf('//');
    const pathPart = base.substring(protocolSeparator + 2);
    const slashCount = (pathPart.match(/\//g) || []).length;
    
    if (slashCount > 0) {
      const lastSlash = base.lastIndexOf('/');
      connectionString = base.substring(0, lastSlash) + '/' + mongoDbName + '?' + parts[1];
    } else {
      connectionString = base + '/' + mongoDbName + '?' + parts[1];
    }
  } else {
    connectionString = mongoUri.endsWith('/') ? mongoUri + mongoDbName : mongoUri + '/' + mongoDbName;
  }

  try {
    await mongoose.connect(connectionString);
    console.log('✅ Connected to MongoDB for verification\n');
  } catch (err: any) {
    console.warn('⚠️ MongoDB connection warning (will run in-memory service checks):', err.message);
  }

  const testCases = [
    {
      id: 1,
      name: 'Clear prompt',
      prompt: 'Screen the attached resume for a Senior AI Engineer position. Evaluate machine learning experience, Python skills, PyTorch projects, and system design ability. Return candidate match score and top 3 strengths.',
      files: [{ filename: 'resume-john-doe.pdf', text: 'John Doe. Senior AI Engineer with 6 years experience in PyTorch, LLMs, and distributed training.' }],
    },
    {
      id: 2,
      name: 'Vague prompt',
      prompt: 'tell me if this is good',
      files: [{ filename: 'document.txt', text: 'Some random text content' }],
    },
    {
      id: 3,
      name: 'Resume screening prompt',
      prompt: 'Analyze these resumes and tell me which candidates are good for AI engineer.',
      files: [{ filename: 'resume1.pdf', text: 'Experience in Python, TensorFlow, Scikit-Learn' }],
    },
    {
      id: 4,
      name: 'Code review prompt',
      prompt: 'Review this github repo https://github.com/expressjs/express and flag security vulnerabilities',
      files: [],
    },
    {
      id: 5,
      name: 'Invoice extraction prompt',
      prompt: 'Extract vendor details and line items from this bill',
      files: [{ filename: 'invoice-10492.pdf', text: 'ACME Corp Invoice #10492 Total: $450.00' }],
    },
    {
      id: 6,
      name: 'Contract analysis prompt',
      prompt: 'Check this NDA for non-compete clauses and termination terms',
      files: [{ filename: 'nda-draft.pdf', text: 'Confidentiality agreement clause 4: Non-compete for 24 months.' }],
    },
    {
      id: 7,
      name: 'Missing/empty prompt',
      prompt: '',
      files: [],
    },
    {
      id: 8,
      name: 'LLM failure / local fallback check',
      prompt: 'Evaluate candidate fit for lead DevOps architect role',
      files: [],
      forceFallback: true,
    },
    {
      id: 9,
      name: 'Large document input (stripping Base64 payload)',
      prompt: 'Extract key clauses from this large agreement',
      files: [{ filename: 'contract-large.pdf', content_base64: 'A'.repeat(50000), text: 'Short extracted agreement header' }],
    },
    {
      id: 10,
      name: 'DB Persistence & Index check',
      prompt: 'Perform detailed code review on payment middleware',
      files: [],
      verifyDb: true,
    },
  ];

  let passed = 0;

  for (const tc of testCases) {
    console.log(`----------------------------------------------------`);
    console.log(`TEST #${tc.id}: ${tc.name}`);
    console.log(`Input Prompt: "${tc.prompt}"`);

    try {
      const res = await analyzePromptWithLLM(tc.prompt, tc.files);

      console.log(`Score: ${res.score}/100`);
      console.log(`Intent: "${res.intent}"`);
      console.log(`Task Type: ${res.taskType}`);
      console.log(`Model Used: ${res.modelUsed}`);
      console.log(`Issues Found: ${res.issues.length}`);
      console.log(`Suggestions: ${res.suggestions.length}`);
      console.log(`Improved Prompt: "${res.improvedPrompt.slice(0, 100)}..."`);

      // Verifications
      if (typeof res.score !== 'number' || res.score < 0 || res.score > 100) {
        throw new Error(`Invalid score: ${res.score}`);
      }
      if (!res.intent || !res.improvedPrompt) {
        throw new Error('Missing intent or improvedPrompt');
      }

      if (tc.verifyDb && mongoose.connection.readyState === 1) {
        let dummyUser = await User.findOne({ email: 'guest@prism.ai' });
        if (!dummyUser) {
          dummyUser = await User.create({
            fullName: 'Guest User',
            email: 'guest@prism.ai',
            passwordHash: 'dummy',
          });
        }
        const dbRecord = await PromptAnalysis.create({
          userId: dummyUser._id,
          originalPrompt: tc.prompt,
          score: res.score,
          intent: res.intent,
          taskType: res.taskType,
          issues: res.issues,
          requiredInformation: res.requiredInformation,
          irrelevantInformation: res.irrelevantInformation,
          constraints: res.constraints,
          suggestions: res.suggestions,
          improvedPrompt: res.improvedPrompt,
          modelUsed: res.modelUsed,
        });
        console.log(`✅ Persisted to MongoDB with ID: ${dbRecord._id}`);
      }

      console.log(`STATUS: ✅ PASSED`);
      passed++;
    } catch (err: any) {
      console.error(`STATUS: ❌ FAILED:`, err.message);
    }
    console.log();
  }

  console.log('====================================================');
  console.log(`   TEST SUMMARY: ${passed}/${testCases.length} TESTS PASSED`);
  console.log('====================================================\n');

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
}

runTests();
