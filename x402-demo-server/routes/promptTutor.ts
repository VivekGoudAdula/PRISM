import { Hono } from 'hono';
import { optionalAuth } from '../middleware/auth';
import { analyzePromptWithLLM } from '../services/promptTutor';
import { PromptAnalysis } from '../models/PromptAnalysis';
import { User } from '../models/User';
import mongoose from 'mongoose';

const promptTutorRouter = new Hono();

promptTutorRouter.use('*', optionalAuth);

/**
 * POST /api/prompt-tutor/analyze
 * Analyzes a user's prompt BEFORE task execution and returns quality score,
 * detected intent, missing requirements, inefficiencies, and an improved prompt.
 */
promptTutorRouter.post('/analyze', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { originalPrompt = '', files = [], category, taskId } = body;

    // Resolve user ID (authenticated token or fallback guest user)
    let userId: any = null;
    const tokenUser = (c as any).get('user');
    if (tokenUser?.userId) {
      const user = await User.findById(tokenUser.userId);
      if (user) userId = user._id;
    }
    if (!userId) {
      let guestUser = await User.findOne({ email: 'guest@prism.ai' });
      if (!guestUser) {
        guestUser = await User.create({
          fullName: 'Guest User',
          email: 'guest@prism.ai',
          passwordHash: 'guest-hashed-pwd',
          role: 'user',
        });
      }
      userId = guestUser._id;
    }

    // Call modular Prompt Tutor service
    const analysisResult = await analyzePromptWithLLM(originalPrompt, files, category);

    // Persist analysis record in MongoDB (avoiding duplicates if taskId provided)
    let savedDoc = null;
    if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
      savedDoc = await PromptAnalysis.findOneAndUpdate(
        { taskId: new mongoose.Types.ObjectId(taskId) },
        {
          userId,
          originalPrompt,
          score: analysisResult.score,
          intent: analysisResult.intent,
          taskType: analysisResult.taskType,
          issues: analysisResult.issues,
          requiredInformation: analysisResult.requiredInformation,
          irrelevantInformation: analysisResult.irrelevantInformation,
          constraints: analysisResult.constraints,
          suggestions: analysisResult.suggestions,
          improvedPrompt: analysisResult.improvedPrompt,
          modelUsed: analysisResult.modelUsed,
        },
        { upsert: true, new: true }
      );
    } else {
      savedDoc = await PromptAnalysis.create({
        userId,
        originalPrompt,
        score: analysisResult.score,
        intent: analysisResult.intent,
        taskType: analysisResult.taskType,
        issues: analysisResult.issues,
        requiredInformation: analysisResult.requiredInformation,
        irrelevantInformation: analysisResult.irrelevantInformation,
        constraints: analysisResult.constraints,
        suggestions: analysisResult.suggestions,
        improvedPrompt: analysisResult.improvedPrompt,
        modelUsed: analysisResult.modelUsed,
      });
    }

    return c.json({
      id: savedDoc._id.toString(),
      ...analysisResult,
    });
  } catch (error: any) {
    console.error('Error in /api/prompt-tutor/analyze:', error);
    // Non-blocking graceful error fallback
    return c.json(
      {
        error: 'Prompt analysis failed',
        message: error.message,
        fallback: true,
        score: 70,
        intent: 'Task execution',
        taskType: 'general_query',
        issues: [],
        requiredInformation: [],
        irrelevantInformation: [],
        constraints: [],
        suggestions: [],
        improvedPrompt: (await c.req.json().catch(() => ({}))).originalPrompt || '',
      },
      200
    );
  }
});

/**
 * GET /api/prompt-tutor/task/:taskId
 * Retrieves saved PromptAnalysis record by taskId.
 */
promptTutorRouter.get('/task/:taskId', async (c) => {
  try {
    const { taskId } = c.req.param();
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return c.json({ error: 'Invalid taskId format' }, 400);
    }

    const analysis = await PromptAnalysis.findOne({ taskId: new mongoose.Types.ObjectId(taskId) });
    if (!analysis) {
      return c.json({ error: 'Prompt analysis not found for this task' }, 404);
    }

    return c.json(analysis);
  } catch (error: any) {
    console.error('Error in GET /api/prompt-tutor/task/:taskId:', error);
    return c.json({ error: 'Failed to fetch prompt analysis' }, 500);
  }
});

export default promptTutorRouter;
