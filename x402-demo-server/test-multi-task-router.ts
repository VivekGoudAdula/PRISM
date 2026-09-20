import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

import { Task } from './models/Task';
import { Conversation } from './models/Chat';
import { User } from './models/User';
import { processConversationalMessage } from './services/conversational-router';

async function runTestMatrix() {
  console.log('====================================================');
  console.log('🚀 PRISM PHASE 1 MULTI-TASK ROUTER TEST MATRIX');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/prism_app';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB for test suite execution.');

  // Create test user and conversation
  let testUser = await User.findOne({ email: 'test-router@prism.ai' });
  if (!testUser) {
    testUser = await User.create({
      fullName: 'Test Router User',
      email: 'test-router@prism.ai',
      passwordHash: 'test-password',
      role: 'user',
    });
  }

  const conversation = await Conversation.create({
    userId: testUser._id,
    title: 'Multi-Task Router Integration Test Workspace',
    thread: [],
  });

  const conversationId = conversation._id.toString();
  const userId = testUser._id.toString();

  console.log(`Created test conversation ID: ${conversationId}\n`);

  let passedCount = 0;
  let totalTests = 10;

  try {
    // ------------------------------------------------------------------
    // Setup Task 1: Repository Review
    // ------------------------------------------------------------------
    const repoTask = await Task.create({
      userId: testUser._id,
      conversationId: conversation._id,
      prompt: 'Review github.com/prism-ai/backend-api repo',
      category: 'code_review',
      status: 'completed',
      selectedEndpoint: '/code-review-fast',
      output: {
        totalFilesReviewed: 5,
        totalIssues: 3,
        averageQualityScore: 0.85,
        averageConfidence: 0.95,
        files: [
          {
            file_path: 'auth/jwt.js',
            issues: [
              { severity: 'high', title: 'Hardcoded JWT secret token', description: 'Hardcoded JWT secret found in auth/jwt.js' },
              { severity: 'medium', title: 'Weak password hashing algorithm', description: 'MD5 hashing algorithm used for user passwords' },
            ],
            overall_quality_score: 0.6,
          },
          {
            file_path: 'db/connection.js',
            issues: [
              { severity: 'low', title: 'Missing connection retry logic', description: 'No automatic reconnect handling' },
            ],
            overall_quality_score: 0.9,
          },
        ],
      },
    });

    // TEST 1 — Repository follow-up
    console.log('🔹 TEST 1: Repository follow-up ("What were the security issues?")');
    const res1 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'What were the security issues?',
    });
    console.log('Result 1:', { intent: res1.intent, referencedTaskIds: res1.referencedTaskIds, answer: res1.message });
    if (res1.intent === 'CONVERSATIONAL' && res1.referencedTaskIds.includes(repoTask._id.toString()) && res1.message.toLowerCase().includes('jwt')) {
      console.log('✅ TEST 1 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ TEST 1 FAILED!\n');
    }

    // TEST 2 — Switch to resumes
    console.log('🔹 TEST 2: Switch to resumes ("Screen these resumes for senior developer role")');
    const res2 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'Screen these resumes for senior developer role',
      hasFiles: true,
    });
    console.log('Result 2:', { intent: res2.intent, taskType: res2.taskType });
    if (res2.intent === 'TASK' && res2.taskType === 'resume_screening') {
      console.log('✅ TEST 2 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ TEST 2 FAILED!\n');
    }

    // Setup Task 2: Resume Screening
    const resumeTask = await Task.create({
      userId: testUser._id,
      conversationId: conversation._id,
      prompt: 'Screen candidate resumes for senior developer role',
      category: 'resume_screening',
      status: 'completed',
      selectedEndpoint: '/resume-screen-accurate',
      output: {
        totalFiles: 3,
        averageConfidence: 0.92,
        candidates: [
          { name: 'Alice Smith', score: 92, skills: ['Python', 'Django', 'FastAPI', 'PostgreSQL'], recommendation: 'Strong Hire' },
          { name: 'Bob Jones', score: 78, skills: ['Java', 'Spring Boot', 'MySQL'], recommendation: 'Consider' },
          { name: 'Charlie Brown', score: 85, skills: ['Python', 'Node.js', 'React', 'MongoDB'], recommendation: 'Hire' },
        ],
      },
    });

    // TEST 3 — Resume follow-up
    console.log('🔹 TEST 3: Resume follow-up ("Which candidate has the strongest Python experience?")');
    const res3 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'Which candidate has the strongest Python experience?',
    });
    console.log('Result 3:', { intent: res3.intent, referencedTaskIds: res3.referencedTaskIds, answer: res3.message });
    if (res3.intent === 'CONVERSATIONAL' && res3.referencedTaskIds.includes(resumeTask._id.toString()) && (res3.message.includes('Alice') || res3.message.includes('Python'))) {
      console.log('✅ TEST 3 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ TEST 3 FAILED!\n');
    }

    // TEST 4 — Return to repository
    console.log('🔹 TEST 4: Return to repository ("Go back to the repository. What did you find about authentication?")');
    const res4 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'Go back to the repository. What did you find about authentication?',
    });
    console.log('Result 4:', { intent: res4.intent, referencedTaskIds: res4.referencedTaskIds, answer: res4.message });
    if (res4.intent === 'CONVERSATIONAL' && res4.referencedTaskIds.includes(repoTask._id.toString()) && (res4.message.toLowerCase().includes('jwt') || res4.message.toLowerCase().includes('auth'))) {
      console.log('✅ TEST 4 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ TEST 4 FAILED!\n');
    }

    // TEST 5 — Cross-task reasoning
    console.log('🔹 TEST 5: Cross-task reasoning ("What candidate experience from the resumes is relevant to the repository\'s backend issues?")');
    const res5 = await processConversationalMessage({
      conversationId,
      userId,
      message: "What candidate experience from the resumes is relevant to the repository's backend issues?",
    });
    console.log('Result 5:', { intent: res5.intent, referencedTaskIds: res5.referencedTaskIds, answer: res5.message });
    if (res5.intent === 'CONVERSATIONAL' && res5.referencedTaskIds.length >= 2 && res5.referencedTaskIds.includes(repoTask._id.toString()) && res5.referencedTaskIds.includes(resumeTask._id.toString())) {
      console.log('✅ TEST 5 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ TEST 5 FAILED!\n');
    }

    // TEST 6 — New contract capability
    console.log('🔹 TEST 6: New contract capability ("What does this contract say about termination?")');
    const res6 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'What does this contract say about termination?',
      hasFiles: true,
    });
    console.log('Result 6:', { intent: res6.intent, taskType: res6.taskType });
    if (res6.intent === 'TASK' && res6.taskType === 'contract_analysis') {
      console.log('✅ TEST 6 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ TEST 6 FAILED!\n');
    }

    // Setup Task 3: Contract Analysis
    const contractTask = await Task.create({
      userId: testUser._id,
      conversationId: conversation._id,
      prompt: 'Analyze Master Services Agreement contract',
      category: 'contract_analysis',
      status: 'completed',
      selectedEndpoint: '/contract-analyze-fast',
      output: {
        totalClauses: 4,
        averageConfidence: 0.94,
        documents: [
          {
            document: 1,
            clauses: [
              { category: 'Termination', title: 'Termination for Convenience', text: 'Either party may terminate this agreement with 30 days written notice.' },
              { category: 'Liability', title: 'Limitation of Liability', text: 'Total liability under this agreement shall not exceed $50,000.' },
            ],
          },
        ],
      },
    });

    // TEST 7 — Unsupported request
    console.log('🔹 TEST 7: Unsupported request ("What\'s the weather in Hyderabad?")');
    const res7 = await processConversationalMessage({
      conversationId,
      userId,
      message: "What's the weather in Hyderabad?",
    });
    console.log('Result 7:', { intent: res7.intent, message: res7.message });
    if (res7.intent === 'UNSUPPORTED' && res7.message.includes("isn't a capability PRISM currently supports")) {
      console.log('✅ TEST 7 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ TEST 7 FAILED!\n');
    }

    // TEST 8 — Ambiguous reference handling
    console.log('🔹 TEST 8: Ambiguous reference handling (Add second repo review and ask "What were the security issues in the repository?")');
    const secondRepoTask = await Task.create({
      userId: testUser._id,
      conversationId: conversation._id,
      prompt: 'Review github.com/prism-ai/frontend-ui repo',
      category: 'code_review',
      status: 'completed',
      selectedEndpoint: '/code-review-fast',
      output: {
        totalFilesReviewed: 3,
        totalIssues: 1,
        files: [
          { file_path: 'src/App.tsx', issues: [{ severity: 'low', title: 'Unused console log' }] },
        ],
      },
    });

    const res8 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'What were the security issues in the repository?',
    });
    console.log('Result 8:', { intent: res8.intent, isAmbiguous: res8.isAmbiguous, question: res8.clarificationQuestion });
    if (res8.intent === 'CONVERSATIONAL' && res8.isAmbiguous && res8.clarificationQuestion?.includes('multiple repository reviews')) {
      console.log('✅ TEST 8 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ TEST 8 FAILED!\n');
    }

    // TEST 9 — Hallucination protection
    console.log('🔹 TEST 9: Hallucination protection ("What did the contract say about SOC2 compliance?")');
    const res9 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'What did the contract say about SOC2 compliance?',
    });
    console.log('Result 9:', { intent: res9.intent, answer: res9.message });
    if (res9.intent === 'CONVERSATIONAL' && res9.message.includes("don't have that detail")) {
      console.log('✅ TEST 9 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ TEST 9 FAILED!\n');
    }

    // TEST 10 — Repeated task switching sequence
    console.log('🔹 TEST 10: Repeated task switching sequence (Repo -> Resume -> Contract -> Repo -> Resume -> Contract -> Repo)');
    const seq = [
      { msg: 'What authentication issue was in the repo?', expectedCat: 'code_review' },
      { msg: 'Who was the candidate with Python experience?', expectedCat: 'resume_screening' },
      { msg: 'What is the termination period in the contract?', expectedCat: 'contract_analysis' },
      { msg: 'Go back to the repository. What was the quality score?', expectedCat: 'code_review' },
      { msg: 'Returning to resumes, which candidate had Java skills?', expectedCat: 'resume_screening' },
      { msg: 'Regarding the contract, what is the liability limit?', expectedCat: 'contract_analysis' },
    ];

    let seqPassed = true;
    for (const step of seq) {
      const stepRes = await processConversationalMessage({
        conversationId,
        userId,
        message: step.msg,
      });
      console.log(`  Step "${step.msg}" -> intent: ${stepRes.intent}, answer snippet: "${stepRes.message.slice(0, 60)}..."`);
      if (stepRes.intent !== 'CONVERSATIONAL' || !stepRes.message || stepRes.message.includes("don't have a previous task result")) {
        seqPassed = false;
      }
    }

    if (seqPassed) {
      console.log('✅ TEST 10 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ TEST 10 FAILED!\n');
    }

  } catch (err) {
    console.error('Test matrix execution error:', err);
  } finally {
    // Cleanup test records
    await Task.deleteMany({ conversationId: conversation._id });
    await Conversation.deleteOne({ _id: conversation._id });
    await User.deleteOne({ _id: testUser._id });
    await mongoose.disconnect();
  }

  console.log('====================================================');
  console.log(`🏆 TEST MATRIX RESULTS: ${passedCount}/${totalTests} TESTS PASSED`);
  console.log('====================================================');

  if (passedCount === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestMatrix();
