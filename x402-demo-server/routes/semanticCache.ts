import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { findSimilarContext, saveContext } from '../services/semanticCache';
import { SemanticCache } from '../models/SemanticCache';
import mongoose from 'mongoose';

export const semanticCacheRouter = new Hono();

semanticCacheRouter.use('*', requireAuth);

/**
 * POST /api/semantic-cache/check
 * Performs an authenticated semantic cache check for a prompt + file context.
 */
semanticCacheRouter.post('/check', async (c) => {
  try {
    const userPayload = (c as any).get('user');
    const body = await c.req.json().catch(() => ({}));
    const { prompt = '', files = [], taskType = 'general_query', workspaceId, chatId } = body;

    const result = await findSimilarContext({
      userId: userPayload.userId,
      workspaceId,
      chatId,
      taskType,
      prompt,
      files,
    });

    return c.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/semantic-cache/check:', error);
    return c.json({ error: 'Semantic cache check failed', message: error.message }, 500);
  }
});

/**
 * GET /api/semantic-cache/stats
 * Retrieves global token reduction and cache hit statistics for the user.
 */
semanticCacheRouter.get('/stats', async (c) => {
  try {
    const userPayload = (c as any).get('user');
    const userId = new mongoose.Types.ObjectId(userPayload.userId);

    const stats = await SemanticCache.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          totalHits: { $sum: '$hitCount' },
          totalCachedTokens: { $sum: '$tokenEstimate' },
        },
      },
    ]);

    const res = stats[0] || { totalEntries: 0, totalHits: 0, totalCachedTokens: 0 };
    return c.json(res);
  } catch (error: any) {
    console.error('Error in GET /api/semantic-cache/stats:', error);
    return c.json({ error: 'Failed to fetch cache stats' }, 500);
  }
});

/**
 * GET /api/semantic-cache/history
 * Returns saved semantic context entries for the user.
 */
semanticCacheRouter.get('/history', async (c) => {
  try {
    const userPayload = (c as any).get('user');
    const userId = new mongoose.Types.ObjectId(userPayload.userId);

    const entries = await SemanticCache.find({ userId })
      .select('-embedding')
      .sort({ lastUsedAt: -1 })
      .limit(50);

    return c.json(entries);
  } catch (error: any) {
    console.error('Error in GET /api/semantic-cache/history:', error);
    return c.json({ error: 'Failed to fetch cache history' }, 500);
  }
});

/**
 * DELETE /api/semantic-cache/:id
 * Deletes a semantic cache entry owned by the user.
 */
semanticCacheRouter.delete('/:id', async (c) => {
  try {
    const userPayload = (c as any).get('user');
    const { id } = c.req.param();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return c.json({ error: 'Invalid cache entry ID' }, 400);
    }

    const deleted = await SemanticCache.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userPayload.userId),
    });

    if (!deleted) {
      return c.json({ error: 'Cache entry not found or unauthorized' }, 404);
    }

    return c.json({ success: true, id });
  } catch (error: any) {
    console.error('Error in DELETE /api/semantic-cache/:id:', error);
    return c.json({ error: 'Failed to delete cache entry' }, 500);
  }
});

export default semanticCacheRouter;
