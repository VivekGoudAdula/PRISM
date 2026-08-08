import type { Context } from 'hono';
import mongoose from 'mongoose';
import { TokenUsage } from '../models/TokenUsage';
import { User } from '../models/User';

/**
 * GET /savings-summary
 * Returns cumulative token and cost savings for the authenticated individual user.
 */
export async function handleSavingsSummaryRequest(c: Context) {
  try {
    const userPayload = (c as any).get('user');

    // If no user payload (unauthenticated guest), return 0 savings
    if (!userPayload || !userPayload.userId) {
      return c.json({
        total_raw_tokens: 0,
        total_map_tokens: 0,
        total_tokens_saved: 0,
        average_reduction_percent: 0,
        estimated_usd_saved: 0,
        savings_multiplier: 1.0,
        total_requests_processed: 0,
        cache_hit_rate_percent: 0,
        total_documents_processed: 0,
      });
    }

    const userId = new mongoose.Types.ObjectId(userPayload.userId);

    // 1. Query TokenUsage collection for this specific user
    const aggregation = await TokenUsage.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalExecutions: { $sum: 1 },
          totalOriginalInputTokens: { $sum: '$originalInputTokens' },
          totalOptimizedInputTokens: { $sum: '$optimizedInputTokens' },
          totalTokensSaved: { $sum: '$tokensSaved' },
          totalCostSaved: { $sum: '$costSaved' },
          cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } },
        },
      },
    ]);

    const stats = aggregation[0];

    // 2. Fetch User model for totalSaved fallback/validation
    const dbUser = await User.findById(userId).select('totalSaved totalTasks');

    let total_raw_tokens = stats?.totalOriginalInputTokens || 0;
    let total_map_tokens = stats?.totalOptimizedInputTokens || 0;
    let total_tokens_saved = stats?.totalTokensSaved || 0;
    let estimated_usd_saved = stats?.totalCostSaved || dbUser?.totalSaved || 0;
    let total_requests_processed = stats?.totalExecutions || dbUser?.totalTasks || 0;

    // Calculate reduction percent
    const average_reduction_percent = total_raw_tokens > 0
      ? parseFloat(((total_tokens_saved / total_raw_tokens) * 100).toFixed(1))
      : 0;

    // Calculate multiplier
    const savings_multiplier = total_map_tokens > 0 && total_raw_tokens > 0
      ? parseFloat((total_raw_tokens / total_map_tokens).toFixed(1))
      : 1.0;

    const cache_hit_rate_percent = total_requests_processed > 0 && stats?.cacheHits
      ? parseFloat(((stats.cacheHits / total_requests_processed) * 100).toFixed(1))
      : 0;

    return c.json({
      total_raw_tokens,
      total_map_tokens,
      total_tokens_saved,
      average_reduction_percent,
      estimated_usd_saved: parseFloat(estimated_usd_saved.toFixed(2)),
      savings_multiplier,
      total_requests_processed,
      cache_hit_rate_percent,
      total_documents_processed: total_requests_processed,
    });
  } catch (error: any) {
    console.error('Error in savings-summary handler:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
