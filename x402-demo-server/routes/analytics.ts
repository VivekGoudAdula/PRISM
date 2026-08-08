import { Hono } from 'hono';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { Payments } from '../models/Payments';
import { EndpointUsage } from '../models/EndpointUsage';
import { AuditLog } from '../models/AuditLog';
import { UserSession } from '../models/UserSession';
import { TokenUsage } from '../models/TokenUsage';
import mongoose from 'mongoose';

export const analyticsRouter = new Hono();
export const adminRouter = new Hono();

// Secure all analytics routes
analyticsRouter.use('*', requireAuth);

/**
 * USER DASHBOARD ANALYTICS
 */
analyticsRouter.get('/dashboard', async (c) => {
  try {
    const userPayload = (c as any).get('user');
    const userId = new mongoose.Types.ObjectId(userPayload.userId);

    // Basic User info & Totals
    const dbUser = await User.findById(userId);
    if (!dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get all tasks for this user (exclude planned ones which are just quotes)
    const tasks = await Task.find({ userId, status: { $ne: 'planned' } });
    const totalTasks = tasks.length;
    const totalSpent = dbUser.totalSpent;
    const totalSaved = dbUser.totalSaved;
    
    // Calculations
    const avgCost = totalTasks > 0 ? (totalSpent / totalTasks) : 0;
    
    const executionTimes = tasks.filter(t => t.executionTime !== undefined).map(t => t.executionTime as number);
    const avgExecutionTime = executionTimes.length > 0 
      ? (executionTimes.reduce((sum, current) => sum + current, 0) / executionTimes.length) 
      : 0;

    // Unique endpoints used
    const uniqueEndpoints = [...new Set(tasks.map(t => t.selectedEndpoint).filter(Boolean))];
    const endpointsUsed = uniqueEndpoints.length;

    // Most used endpoint
    const endpointCounts = tasks.reduce((acc, t) => {
      if (t.selectedEndpoint) {
        acc[t.selectedEndpoint] = (acc[t.selectedEndpoint] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    let mostUsedEndpoint = 'None';
    let maxCount = 0;
    Object.entries(endpointCounts).forEach(([endpoint, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostUsedEndpoint = endpoint;
      }
    });

    // Tasks Per Day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentTasks = await Task.find({
      userId,
      status: { $ne: 'planned' },
      createdAt: { $gte: thirtyDaysAgo }
    });

    const tasksPerDayMap = new Map<string, number>();
    // initialize last 30 days with 0
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      tasksPerDayMap.set(dateString, 0);
    }

    recentTasks.forEach(t => {
      const dateString = t.createdAt.toISOString().split('T')[0];
      if (tasksPerDayMap.has(dateString)) {
        tasksPerDayMap.set(dateString, (tasksPerDayMap.get(dateString) || 0) + 1);
      }
    });

    const tasksPerDay = Array.from(tasksPerDayMap.entries()).map(([day, count]) => ({ day, count }));

    // Recent Activity (combine audit logs + tasks)
    const recentActivity = await AuditLog.find({ userId })
      .sort({ timestamp: -1 })
      .limit(10);

    return c.json({
      totalTasks,
      totalSpent,
      totalSaved,
      avgCost,
      avgExecutionTime,
      endpointsUsed,
      mostUsedEndpoint,
      tasksPerDay,
      recentActivity
    });
  } catch (error: any) {
    console.error('Dashboard Analytics Error:', error);
    return c.json({ error: 'Failed to retrieve analytics.' }, 500);
  }
});

/**
 * GET USER'S TASK HISTORY
 */
analyticsRouter.get('/tasks', async (c) => {
  try {
    const userPayload = (c as any).get('user');
    const tasks = await Task.find({ 
      userId: userPayload.userId,
      status: { $ne: 'planned' }
    }).sort({ createdAt: -1 }).limit(20);
    return c.json(tasks);
  } catch (error) {
    console.error('Get user tasks error:', error);
    return c.json({ error: 'Failed to fetch tasks history' }, 500);
  }
});

/**
 * USER TOKEN USAGE SUMMARY (Time-based aggregation)
 * GET /api/analytics/token-usage/summary?period=today|7d|30d|all
 */
analyticsRouter.get('/token-usage/summary', async (c) => {
  try {
    const userPayload = (c as any).get('user');
    const userId = new mongoose.Types.ObjectId(userPayload.userId);
    const period = c.req.query('period') || '30d';

    let dateFilter: any = {};
    const now = new Date();

    if (period === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      dateFilter = { $gte: startOfDay };
    } else if (period === '7d') {
      const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
      dateFilter = { $gte: sevenDaysAgo };
    } else if (period === '30d') {
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
      dateFilter = { $gte: thirtyDaysAgo };
    }

    const matchQuery: any = { userId };
    if (dateFilter.$gte) {
      matchQuery.createdAt = dateFilter;
    }

    const aggregation = await TokenUsage.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalExecutions: { $sum: 1 },
          totalOriginalInputTokens: { $sum: '$originalInputTokens' },
          totalOptimizedInputTokens: { $sum: '$optimizedInputTokens' },
          totalOutputTokens: { $sum: '$outputTokens' },
          totalTokensProcessed: { $sum: '$totalTokens' },
          totalTokensSaved: { $sum: '$tokensSaved' },
          totalEstimatedOriginalCost: { $sum: '$estimatedOriginalCost' },
          totalOptimizedCost: { $sum: '$optimizedCost' },
          totalCostSaved: { $sum: '$costSaved' },
          avgCompressionRatio: { $avg: '$compressionRatio' },
          cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } },
        },
      },
    ]);

    const stats = aggregation[0] || {
      totalExecutions: 0,
      totalOriginalInputTokens: 0,
      totalOptimizedInputTokens: 0,
      totalOutputTokens: 0,
      totalTokensProcessed: 0,
      totalTokensSaved: 0,
      totalEstimatedOriginalCost: 0,
      totalOptimizedCost: 0,
      totalCostSaved: 0,
      avgCompressionRatio: 0,
      cacheHits: 0,
    };

    const cacheHitRate = stats.totalExecutions > 0 
      ? parseFloat(((stats.cacheHits / stats.totalExecutions) * 100).toFixed(1))
      : 0;

    return c.json({
      period,
      ...stats,
      totalEstimatedOriginalCost: parseFloat((stats.totalEstimatedOriginalCost || 0).toFixed(4)),
      totalOptimizedCost: parseFloat((stats.totalOptimizedCost || 0).toFixed(4)),
      totalCostSaved: parseFloat((stats.totalCostSaved || 0).toFixed(4)),
      avgCompressionRatio: parseFloat((stats.avgCompressionRatio || 0).toFixed(1)),
      cacheHitRate,
    });
  } catch (error: any) {
    console.error('Token Usage Summary Error:', error);
    return c.json({ error: 'Failed to fetch token usage summary' }, 500);
  }
});

/**
 * USER TOKEN USAGE HISTORY
 * GET /api/analytics/token-usage/history
 */
analyticsRouter.get('/token-usage/history', async (c) => {
  try {
    const userPayload = (c as any).get('user');
    const userId = new mongoose.Types.ObjectId(userPayload.userId);

    const history = await TokenUsage.find({ userId })
      .populate('taskId', 'prompt category status executionTime')
      .sort({ createdAt: -1 })
      .limit(50);

    return c.json(history);
  } catch (error) {
    console.error('Token Usage History Error:', error);
    return c.json({ error: 'Failed to fetch token history' }, 500);
  }
});

/**
 * SINGLE TASK TOKEN USAGE
 * GET /api/analytics/token-usage/task/:taskId
 */
analyticsRouter.get('/token-usage/task/:taskId', async (c) => {
  try {
    const userPayload = (c as any).get('user');
    const userId = new mongoose.Types.ObjectId(userPayload.userId);
    const taskId = c.req.param('taskId');

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return c.json({ error: 'Invalid taskId' }, 400);
    }

    const usage = await TokenUsage.findOne({
      taskId: new mongoose.Types.ObjectId(taskId),
      userId,
    }).populate('taskId', 'prompt category status');

    if (!usage) {
      return c.json({ error: 'Token usage metrics not found for task' }, 404);
    }

    return c.json(usage);
  } catch (error) {
    console.error('Task Token Usage Error:', error);
    return c.json({ error: 'Failed to fetch task token usage' }, 500);
  }
});

// Secure all admin routes
adminRouter.use('*', requireAuth, requireAdmin);

/**
 * ADMIN: Fetch Users List (excluding admins)
 */
adminRouter.get('/users', async (c) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).select('-passwordHash').sort({ createdAt: -1 }).lean();
    
    // Dynamically calculate the actual non-planned (executed) tasks run per user
    const usersWithDynamicStats = await Promise.all(
      users.map(async (user: any) => {
        const actualTasksRun = await Task.countDocuments({
          userId: user._id,
          status: { $ne: 'planned' }
        });
        return {
          ...user,
          totalTasks: actualTasksRun
        };
      })
    );
    
    return c.json(usersWithDynamicStats);
  } catch (error) {
    return c.json({ error: 'Failed to retrieve users' }, 500);
  }
});

/**
 * ADMIN: Fetch Tasks List
 */
adminRouter.get('/tasks', async (c) => {
  try {
    const tasks = await Task.find({
      status: { $ne: 'planned' }
    }).populate('userId', 'fullName email').sort({ createdAt: -1 }).limit(100);
    return c.json(tasks);
  } catch (error) {
    return c.json({ error: 'Failed to retrieve tasks' }, 500);
  }
});

/**
 * ADMIN: Fetch Payments List (mainnet only — excludes any testnet records)
 * Testnet transactions are identified by the blockchain field containing 'testnet'
 * (case-insensitive) or an explicit network field set to 'testnet'.
 */
adminRouter.get('/payments', async (c) => {
  try {
    const payments = await Payments.find({
      // Exclude testnet transactions — mainnet only
      blockchain: { $not: /testnet/i },
      $or: [
        { network: { $exists: false } },
        { network: { $not: /testnet/i } },
      ],
    })
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(200);
    return c.json(payments);
  } catch (error) {
    return c.json({ error: 'Failed to retrieve payments' }, 500);
  }
});

/**
 * ADMIN: Fetch Endpoint Usage List
 */
adminRouter.get('/endpoints', async (c) => {
  try {
    const usages = await EndpointUsage.find({}).populate('userId', 'fullName email').sort({ timestamp: -1 }).limit(100);
    return c.json(usages);
  } catch (error) {
    return c.json({ error: 'Failed to retrieve endpoint usage' }, 500);
  }
});

/**
 * ADMIN: Stats & Platform KPIs (excluding admins from user metrics)
 */
adminRouter.get('/stats', async (c) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get list of non-admin user IDs to filter session counts
    const nonAdminUserIds = await User.distinct('_id', { role: { $ne: 'admin' } });

    // DAU (Daily Active Users in user sessions)
    const activeToday = await UserSession.distinct('userId', {
      userId: { $in: nonAdminUserIds as any },
      lastActivity: { $gte: today }
    } as any);
    const dau = activeToday.length;

    // MAU (Monthly Active Users)
    const activeMonth = await UserSession.distinct('userId', {
      userId: { $in: nonAdminUserIds as any },
      lastActivity: { $gte: thirtyDaysAgo }
    } as any);
    const mau = activeMonth.length;

    // Revenue (Sum of all completed payments)
    const completedPayments = await Payments.find({ status: 'completed' });
    const revenue = completedPayments.reduce((sum, p) => sum + p.amount, 0);

    // Most Used Categories (exclude planned tasks)
    const tasks = await Task.find({ status: { $ne: 'planned' } });
    const categoryCounts = tasks.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostUsedCategories = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count
    })).sort((a, b) => b.count - a.count);

    // Recent platform activities
    const recentActivity = await AuditLog.find({})
      .populate('userId', 'fullName email')
      .sort({ timestamp: -1 })
      .limit(20);

    return c.json({
      dau,
      mau,
      revenue,
      mostUsedCategories,
      recentActivity,
      totals: {
        users: await User.countDocuments({ role: { $ne: 'admin' } }),
        tasks: await Task.countDocuments({ status: { $ne: 'planned' } }),
        payments: completedPayments.length,
      }
    });
  } catch (error: any) {
    console.error('Admin Stats Error:', error);
    return c.json({ error: 'Failed to load admin stats.' }, 500);
  }
});

/**
 * ADMIN: Time-Series Analytics (over-time data for graphs)
 * Query params (use one of the two modes):
 *   Mode A — custom date range: startDate (YYYY-MM-DD) & endDate (YYYY-MM-DD)
 *   Mode B — preset: days (integer, default 30)
 * Returns daily series for: volume (USDC), settlements, transactions, newUsers.
 */
adminRouter.get('/analytics-overtime', async (c) => {
  try {
    const startDateParam = c.req.query('startDate');
    const endDateParam   = c.req.query('endDate');
    const daysParam      = parseInt(c.req.query('days') || '30', 10);

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      // Custom date range mode — user-supplied from/to dates
      startDate = new Date(startDateParam + 'T00:00:00.000Z');
      endDate   = new Date(endDateParam   + 'T23:59:59.999Z');
    } else {
      // Preset mode — N days back from today
      const days = Math.min(Math.max(daysParam, 1), 365);
      endDate   = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }

    // Clamp: endDate must not exceed today
    const now = new Date();
    if (endDate > now) endDate = now;

    // Safety: if startDate is after endDate, swap them
    if (startDate > endDate) [startDate, endDate] = [endDate, startDate];

    // Build a day-keyed template with zeroes for every day in range
    const template = new Map<string, {
      date: string;
      volume: number;
      settlements: number;
      transactions: number;
      newUsers: number;
    }>();

    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(endDate);
    endDay.setHours(0, 0, 0, 0);

    while (cursor <= endDay) {
      const key = cursor.toISOString().split('T')[0];
      template.set(key, { date: key, volume: 0, settlements: 0, transactions: 0, newUsers: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Daily payment volume + settlement count (mainnet only)
    const paymentDocs = await Payments.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed',
      blockchain: { $not: /testnet/i },
      $or: [
        { network: { $exists: false } },
        { network: { $not: /testnet/i } },
      ],
    }).select('amount createdAt').lean();

    for (const p of paymentDocs) {
      const key = (p.createdAt as Date).toISOString().split('T')[0];
      const entry = template.get(key);
      if (entry) {
        entry.volume += p.amount || 0;
        entry.settlements += 1;
      }
    }

    // Daily task (transaction) count
    const taskDocs = await Task.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'planned' },
    }).select('createdAt').lean();

    for (const t of taskDocs) {
      const key = (t.createdAt as Date).toISOString().split('T')[0];
      const entry = template.get(key);
      if (entry) {
        entry.transactions += 1;
      }
    }

    // Daily new user registrations (non-admin)
    const userDocs = await User.find({
      role: { $ne: 'admin' },
      createdAt: { $gte: startDate, $lte: endDate },
    }).select('createdAt').lean();

    for (const u of userDocs) {
      const key = (u.createdAt as Date).toISOString().split('T')[0];
      const entry = template.get(key);
      if (entry) {
        entry.newUsers += 1;
      }
    }

    const series = Array.from(template.values());

    // Summary totals for the selected period
    const totalVolume       = series.reduce((s, d) => s + d.volume, 0);
    const totalSettlements  = series.reduce((s, d) => s + d.settlements, 0);
    const totalTransactions = series.reduce((s, d) => s + d.transactions, 0);
    const totalNewUsers     = series.reduce((s, d) => s + d.newUsers, 0);

    return c.json({
      startDate: startDate.toISOString().split('T')[0],
      endDate:   endDate.toISOString().split('T')[0],
      series,
      totals: {
        volume:       totalVolume,
        settlements:  totalSettlements,
        transactions: totalTransactions,
        newUsers:     totalNewUsers,
      },
    });
  } catch (error: any) {
    console.error('Analytics Overtime Error:', error);
    return c.json({ error: 'Failed to load analytics.' }, 500);
  }
});

/**
 * ADMIN: Global Token Usage Analytics
 * GET /api/admin/analytics/token-usage
 */
adminRouter.get('/analytics/token-usage', async (c) => {
  try {
    const globalAggregation = await TokenUsage.aggregate([
      {
        $group: {
          _id: null,
          totalExecutions: { $sum: 1 },
          totalOriginalInputTokens: { $sum: '$originalInputTokens' },
          totalOptimizedInputTokens: { $sum: '$optimizedInputTokens' },
          totalOutputTokens: { $sum: '$outputTokens' },
          totalTokensProcessed: { $sum: '$totalTokens' },
          totalTokensSaved: { $sum: '$tokensSaved' },
          totalEstimatedOriginalCost: { $sum: '$estimatedOriginalCost' },
          totalOptimizedCost: { $sum: '$optimizedCost' },
          totalCostSaved: { $sum: '$costSaved' },
          avgCompressionRatio: { $avg: '$compressionRatio' },
          cacheHits: { $sum: { $cond: ['$cacheHit', 1, 0] } },
        },
      },
    ]);

    const stats = globalAggregation[0] || {
      totalExecutions: 0,
      totalOriginalInputTokens: 0,
      totalOptimizedInputTokens: 0,
      totalOutputTokens: 0,
      totalTokensProcessed: 0,
      totalTokensSaved: 0,
      totalEstimatedOriginalCost: 0,
      totalOptimizedCost: 0,
      totalCostSaved: 0,
      avgCompressionRatio: 0,
      cacheHits: 0,
    };

    // Top endpoints by token consumption
    const topEndpoints = await TokenUsage.aggregate([
      {
        $group: {
          _id: '$endpointId',
          totalTokens: { $sum: '$totalTokens' },
          tokensSaved: { $sum: '$tokensSaved' },
          costSaved: { $sum: '$costSaved' },
          executions: { $sum: 1 },
        },
      },
      { $sort: { totalTokens: -1 } },
      { $limit: 10 },
    ]);

    // Top optimized users
    const topUsers = await TokenUsage.aggregate([
      {
        $group: {
          _id: '$userId',
          totalTokensSaved: { $sum: '$tokensSaved' },
          totalCostSaved: { $sum: '$costSaved' },
          totalExecutions: { $sum: 1 },
        },
      },
      { $sort: { totalTokensSaved: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          fullName: '$user.fullName',
          email: '$user.email',
          totalTokensSaved: 1,
          totalCostSaved: 1,
          totalExecutions: 1,
        },
      },
    ]);

    return c.json({
      totals: {
        totalExecutions: stats.totalExecutions,
        totalInputTokens: stats.totalOriginalInputTokens,
        totalOptimizedInputTokens: stats.totalOptimizedInputTokens,
        totalOutputTokens: stats.totalOutputTokens,
        totalTokensProcessed: stats.totalTokensProcessed,
        totalTokensSaved: stats.totalTokensSaved,
        estimatedOriginalCost: parseFloat((stats.totalEstimatedOriginalCost || 0).toFixed(4)),
        optimizedCost: parseFloat((stats.totalOptimizedCost || 0).toFixed(4)),
        totalCostSaved: parseFloat((stats.totalCostSaved || 0).toFixed(4)),
        avgCompressionRatio: parseFloat((stats.avgCompressionRatio || 0).toFixed(1)),
        cacheHits: stats.cacheHits,
      },
      topEndpoints,
      topUsers,
    });
  } catch (error: any) {
    console.error('Admin Token Analytics Error:', error);
    return c.json({ error: 'Failed to load admin token analytics' }, 500);
  }
});

