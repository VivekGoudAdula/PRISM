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
    // STEP 1: Code Review Execution (37 files, 34 issues, 88% quality)
    // ------------------------------------------------------------------
    console.log('🔹 STEP 1: Execute Repository Code Review (37 files, 34 issues, 88% quality)');
    const repoTask = await Task.create({
      userId: testUser._id,
      conversationId: conversation._id,
      prompt: 'Review this repository',
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
          {
            file_path: 'auth/jwt.js',
            overall_quality_score: 0.85,
            issues: [
              {
                line_estimate: 5,
                severity: 'medium',
                title: 'Hardcoded secret token',
                description: 'Hardcoded secret token found in auth/jwt.js',
                suggestion: 'Use process.env.JWT_SECRET instead.',
              },
            ],
          },
        ],
      },
    });

    await Conversation.findByIdAndUpdate(conversation._id, { activeTaskId: repoTask._id });
    console.log(`✅ Step 1 complete. Repo Task ID: ${repoTask._id}\n`);

    // STEP 2: Ask "What was the issue in README.template.md?"
    console.log('🔹 STEP 2: Ask "What was the issue in README.template.md?"');
    const res2 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'What was the issue in README.template.md?',
    });
    console.log('Result 2:', { intent: res2.intent, answer: res2.message });
    if (res2.intent === 'CONVERSATIONAL' && res2.referencedTaskIds.includes(repoTask._id.toString()) && res2.message.includes('README.template.md') && !res2.message.includes("don't have a previous result")) {
      console.log('✅ STEP 2 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 2 FAILED!\n');
    }

    // STEP 3: Ask "How many issues were found?"
    console.log('🔹 STEP 3: Ask "How many issues were found?"');
    const res3 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'How many issues were found?',
    });
    console.log('Result 3:', { intent: res3.intent, answer: res3.message });
    if (res3.intent === 'CONVERSATIONAL' && res3.message.includes('34')) {
      console.log('✅ STEP 3 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 3 FAILED!\n');
    }

    // STEP 4: Ask "What was the overall quality score?"
    console.log('🔹 STEP 4: Ask "What was the overall quality score?"');
    const res4 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'What was the overall quality score?',
    });
    console.log('Result 4:', { intent: res4.intent, answer: res4.message });
    if (res4.intent === 'CONVERSATIONAL' && res4.message.includes('88%')) {
      console.log('✅ STEP 4 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 4 FAILED!\n');
    }

    // STEP 5: Ask "Which files had low severity issues?"
    console.log('🔹 STEP 5: Ask "Which files had low severity issues?"');
    const res5 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'Which files had low severity issues?',
    });
    console.log('Result 5:', { intent: res5.intent, answer: res5.message });
    if (res5.intent === 'CONVERSATIONAL' && (res5.message.includes('README.template.md') || res5.message.includes('contributorsList.js'))) {
      console.log('✅ STEP 5 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 5 FAILED!\n');
    }

    // STEP 6: Switch Task -> Screen resumes for frontend developer
    console.log('🔹 STEP 6: Switch task ("Screen these resumes for a frontend developer.")');
    const res6 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'Screen these resumes for a frontend developer.',
      hasFiles: true,
    });
    console.log('Result 6:', { intent: res6.intent, taskType: res6.taskType });

    const resumeTask = await Task.create({
      userId: testUser._id,
      conversationId: conversation._id,
      prompt: 'Screen these resumes for a frontend developer.',
      category: 'resume_screening',
      status: 'completed',
      selectedEndpoint: '/resume-screen-accurate',
      output: {
        totalFiles: 2,
        candidates: [
          { name: 'Polla Vishnu Vardhan', score: 91, skills: ['React', 'TypeScript', 'Tailwind', 'Next.js'], recommendation: 'Strong Hire' },
          { name: 'Vivek Goud', score: 88, skills: ['Python', 'TypeScript', 'Algorand', 'React'], recommendation: 'Strong Hire' },
        ],
      },
    });
    await Conversation.findByIdAndUpdate(conversation._id, { activeTaskId: resumeTask._id });

    if (res6.intent === 'TASK' && res6.taskType === 'resume_screening') {
      console.log('✅ STEP 6 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 6 FAILED!\n');
    }

    // STEP 7: Ask "Who scored highest?"
    console.log('🔹 STEP 7: Ask "Who scored highest?"');
    const res7 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'Who scored highest?',
    });
    console.log('Result 7:', { intent: res7.intent, answer: res7.message });
    if (res7.intent === 'CONVERSATIONAL' && res7.message.includes('Polla Vishnu Vardhan') && res7.message.includes('91%')) {
      console.log('✅ STEP 7 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 7 FAILED!\n');
    }

    // STEP 8: Ask "Go back to the repository. What was the issue in README.template.md?"
    console.log('🔹 STEP 8: Ask "Go back to the repository. What was the issue in README.template.md?"');
    const res8 = await processConversationalMessage({
      conversationId,
      userId,
      message: 'Go back to the repository. What was the issue in README.template.md?',
    });
    console.log('Result 8:', { intent: res8.intent, answer: res8.message });
    if (res8.intent === 'CONVERSATIONAL' && res8.referencedTaskIds.includes(repoTask._id.toString()) && res8.message.includes('README.template.md')) {
      console.log('✅ STEP 8 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 8 FAILED!\n');
    }

    // STEP 9: Ask "What was Vivek's resume score?"
    console.log('🔹 STEP 9: Ask "What was Vivek\'s resume score?"');
    const res9 = await processConversationalMessage({
      conversationId,
      userId,
      message: "What was Vivek's resume score?",
    });
    console.log('Result 9:', { intent: res9.intent, answer: res9.message });
    if (res9.intent === 'CONVERSATIONAL' && res9.referencedTaskIds.includes(resumeTask._id.toString()) && res9.message.includes('88%')) {
      console.log('✅ STEP 9 PASSED!\n');
      passedCount++;
    } else {
      console.error('❌ STEP 9 FAILED!\n');
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
  console.log(`🏆 HISTORICAL TASK RETRIEVAL MATRIX RESULTS: ${passedCount}/${totalTests} TESTS PASSED`);
  console.log('====================================================');

  if (passedCount === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestMatrix();
