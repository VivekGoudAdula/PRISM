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
  console.log('🚀 PRISM PHASE 1 MULTI-TASK & HISTORICAL RETRIEVAL TEST MATRIX');
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
  let totalTests = 8;

  try {
    // ------------------------------------------------------------------
    // STEP 1: New Code Review Request ("review https://github.com/kishanrajput23/Java-Projects-Collections")
    // ------------------------------------------------------------------
    console.log('🔹 STEP 1: "review https://github.com/kishanrajput23/Java-Projects-Collections"');
    const res1 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'review https://github.com/kishanrajput23/Java-Projects-Collections',
    });
    console.log('Result 1:', { intent: res1.intent, taskType: res1.taskType });
    if (res1.intent === 'TASK' && res1.taskType === 'code_review') {
      console.log('✅ STEP 1 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 1 FAILED!\n');
    }

    // Create completed code review task to simulate execution
    const repoTask = await Task.create({
      userId: testUser._id,
      conversationId: conversation._id,
      prompt: 'review https://github.com/kishanrajput23/Java-Projects-Collections',
      category: 'code_review',
      status: 'completed',
      selectedEndpoint: '/code-review-fast',
      output: {
        totalFilesReviewed: 37,
        totalIssues: 34,
        averageQualityScore: 0.88,
        issuesBySeverity: { high: 0, medium: 0, low: 34 },
        files: [
          {
            file_path: 'README.template.md',
            overall_quality_score: 0.88,
            issues: [
              {
                line_estimate: 1,
                severity: 'low',
                title: 'Unresolved task tag found',
                description: 'Unresolved task tag found: // TODO: update documentation',
                suggestion: 'Address leftover TODO task or move to project issue tracker.',
              },
            ],
          },
          {
            file_path: 'contributors/contributorsList.js',
            overall_quality_score: 0.88,
            issues: [
              {
                line_estimate: 12,
                severity: 'low',
                title: 'Active console statement found',
                description: 'Active console.log found in production file',
                suggestion: 'Replace with structured logging.',
              },
            ],
          },
        ],
      },
    });
    await Conversation.findByIdAndUpdate(conversation._id, { activeTaskId: repoTask._id });

    // ------------------------------------------------------------------
    // STEP 2: Follow-up query ("what were the main issues?")
    // ------------------------------------------------------------------
    console.log('🔹 STEP 2: "what were the main issues?"');
    const res2 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'what were the main issues?',
    });
    console.log('Result 2:', { intent: res2.intent, answer: res2.message });
    if ((res2.intent === 'FOLLOW_UP' || res2.intent === 'CONVERSATIONAL') && res2.referencedTaskIds.includes(repoTask._id.toString())) {
      console.log('✅ STEP 2 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 2 FAILED!\n');
    }

    // ------------------------------------------------------------------
    // STEP 3: Specific file question ("what was the issue in README.template.md?")
    // ------------------------------------------------------------------
    console.log('🔹 STEP 3: "what was the issue in README.template.md?"');
    const res3 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'what was the issue in README.template.md?',
    });
    console.log('Result 3:', { intent: res3.intent, answer: res3.message });
    if ((res3.intent === 'FOLLOW_UP' || res3.intent === 'CONVERSATIONAL') && res3.message.includes('README.template.md')) {
      console.log('✅ STEP 3 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 3 FAILED!\n');
    }

    // ------------------------------------------------------------------
    // STEP 4: New Resume Screening Task ("Screen these resumes for a Senior Backend Developer.")
    // ------------------------------------------------------------------
    console.log('🔹 STEP 4: "Screen these resumes for a Senior Backend Developer."');
    const res4 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'Screen these resumes for a Senior Backend Developer.',
      hasFiles: true,
    });
    console.log('Result 4:', { intent: res4.intent, taskType: res4.taskType });

    const resumeTask = await Task.create({
      userId: testUser._id,
      conversationId: conversation._id,
      prompt: 'Screen these resumes for a Senior Backend Developer.',
      category: 'resume_screening',
      status: 'completed',
      selectedEndpoint: '/resume-screen-accurate',
      output: {
        totalFiles: 2,
        candidates: [
          { name: 'Polla Vishnu Vardhan', score: 91, skills: ['React', 'TypeScript', 'Node.js'], recommendation: 'Strong Hire' },
          { name: 'Vivek Goud', score: 88, skills: ['Python', 'TypeScript', 'Node.js'], recommendation: 'Strong Hire' },
        ],
      },
    });
    await Conversation.findByIdAndUpdate(conversation._id, { activeTaskId: resumeTask._id });

    if (res4.intent === 'TASK' && res4.taskType === 'resume_screening') {
      console.log('✅ STEP 4 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 4 FAILED!\n');
    }

    // ------------------------------------------------------------------
    // STEP 5: Resume follow-up ("who scored highest?")
    // ------------------------------------------------------------------
    console.log('🔹 STEP 5: "who scored highest?"');
    const res5 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'who scored highest?',
    });
    console.log('Result 5:', { intent: res5.intent, answer: res5.message });
    if ((res5.intent === 'FOLLOW_UP' || res5.intent === 'CONVERSATIONAL') && res5.message.includes('Polla Vishnu Vardhan')) {
      console.log('✅ STEP 5 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 5 FAILED!\n');
    }

    // ------------------------------------------------------------------
    // STEP 6: Task context switch ("go back to the repository. What was the issue in README.template.md?")
    // ------------------------------------------------------------------
    console.log('🔹 STEP 6: "go back to the repository. What was the issue in README.template.md?"');
    const res6 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'go back to the repository. What was the issue in README.template.md?',
    });
    console.log('Result 6:', { intent: res6.intent, answer: res6.message });
    if ((res6.intent === 'FOLLOW_UP' || res6.intent === 'CONVERSATIONAL') && res6.referencedTaskIds.includes(repoTask._id.toString()) && res6.message.includes('README.template.md')) {
      console.log('✅ STEP 6 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 6 FAILED!\n');
    }

    // ------------------------------------------------------------------
    // STEP 7: New Repo Code Review ("review https://github.com/example/new-repository")
    // ------------------------------------------------------------------
    console.log('🔹 STEP 7: "review https://github.com/example/new-repository"');
    const res7 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'review https://github.com/example/new-repository',
    });
    console.log('Result 7:', { intent: res7.intent, taskType: res7.taskType });
    if (res7.intent === 'TASK' && res7.taskType === 'code_review') {
      console.log('✅ STEP 7 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 7 FAILED!\n');
    }

    // ------------------------------------------------------------------
    // STEP 8: Specific candidate query ("what was Vivek's resume score?")
    // ------------------------------------------------------------------
    console.log('🔹 STEP 8: "what was Vivek\'s resume score?"');
    const res8 = await processConversationalMessage({
      conversationId,
      userId,
      message: "what was Vivek's resume score?",
    });
    console.log('Result 8:', { intent: res8.intent, answer: res8.message });
    if ((res8.intent === 'FOLLOW_UP' || res8.intent === 'CONVERSATIONAL') && res8.referencedTaskIds.includes(resumeTask._id.toString()) && res8.message.includes('88%')) {
      console.log('✅ STEP 8 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 8 FAILED!\n');
    }

  } catch (err) {
    console.error('Test matrix execution error:', err);
  } finally {
    await Task.deleteMany({ conversationId: conversation._id });
    await Conversation.deleteOne({ _id: conversation._id });
    await User.deleteOne({ _id: testUser._id });
    await mongoose.disconnect();
  }

  console.log('====================================================');
  console.log(`🏆 DEFINITION OF DONE REGRESSION RESULTS: ${passedCount}/${totalTests} TESTS PASSED`);
  console.log('====================================================');

  if (passedCount === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestMatrix();

