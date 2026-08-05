import { Hono } from 'hono';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { Payments } from '../models/Payments';
import { EndpointUsage } from '../models/EndpointUsage';
import { AuditLog } from '../models/AuditLog';
import { UserSession } from '../models/UserSession';
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
    const userPayload = c.get('user');
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
    const userPayload = c.get('user');
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
      userId: { $in: nonAdminUserIds },
      lastActivity: { $gte: today }
    });
    const dau = activeToday.length;

    // MAU (Monthly Active Users)
    const activeMonth = await UserSession.distinct('userId', {
      userId: { $in: nonAdminUserIds },
      lastActivity: { $gte: thirtyDaysAgo }
    });
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
