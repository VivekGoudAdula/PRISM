import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { optimizePrompt } from '../services/promptOptimizer';
import { PromptOptimization } from '../models/PromptOptimization';
import mongoose from 'mongoose';

export const promptOptimizerRouter = new Hono();

promptOptimizerRouter.use('*', requireAuth);

/**
 * POST /api/prompt-optimizer/optimize
 * Authenticated endpoint for prompt & context optimization.
 */
promptOptimizerRouter.post('/optimize', async (c) => {
  try {
    const userPayload = (c as any).get('user');
    const body = await c.req.json().catch(() => ({}));
    const {
      taskDescription = '',
      improvedPrompt = '',
      originalPrompt = '',
      taskType = 'general_query',
      dataMap,
      semanticContext,
      files = [],
      constraints = [],
      requiredEntities = [],
      requiredRelationships = [],
    } = body;

    const inputPrompt = originalPrompt || taskDescription;

    const optimization = await optimizePrompt({
      originalPrompt: inputPrompt,
      improvedPrompt,
      dataMap,
      semanticContext,
      files,
      taskType,
      constraints,
      requiredEntities,
      requiredRelationships,
    });

    // Asynchronously save record to MongoDB
    try {
      await PromptOptimization.create({
        userId: new mongoose.Types.ObjectId(userPayload.userId),
        originalInputTokens: optimization.originalInputTokens,
        optimizedInputTokens: optimization.optimizedInputTokens,
        tokensSaved: optimization.tokensSaved,
        reductionPercentage: optimization.reductionPercentage,
        compressionRatio: optimization.compressionRatio,
        cacheHit: false,
        cacheTokensSaved: 0,
        optimizerTokensSaved: optimization.tokensSaved,
        totalTokensSaved: optimization.tokensSaved,
        preservedEntities: optimization.preservedEntities,
        preservedRelationships: optimization.preservedRelationships,
        preservedConstraints: optimization.preservedConstraints,
        removedRedundancies: optimization.removedRedundancies,
        removedIrrelevantContext: optimization.removedIrrelevantContext,
        summarizedSections: optimization.summarizedSections,
        optimizationApplied: optimization.optimizationApplied,
        modelUsed: optimization.modelUsed,
        measurementSource: optimization.measurementSource,
      });
    } catch (dbErr: any) {
      console.error('Error recording PromptOptimization in DB (non-blocking):', dbErr?.message || dbErr);
    }

    return c.json({
      success: true,
      optimization,
      tokenSavings: {
        originalInputTokens: optimization.originalInputTokens,
        optimizedInputTokens: optimization.optimizedInputTokens,
        tokensSaved: optimization.tokensSaved,
        reductionPercentage: optimization.reductionPercentage,
        compressionRatio: optimization.compressionRatio,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/prompt-optimizer/optimize:', error);
    return c.json({ error: 'Prompt optimization failed', message: error.message }, 500);
  }
});

export default promptOptimizerRouter;
