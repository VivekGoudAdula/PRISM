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

    // Get all tasks for this user
    const tasks = await Task.find({ userId });
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
    const tasks = await Task.find({ userId: userPayload.userId }).sort({ createdAt: -1 }).limit(20);
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
    const users = await User.find({ role: { $ne: 'admin' } }).select('-passwordHash').sort({ createdAt: -1 });
    return c.json(users);
  } catch (error) {
    return c.json({ error: 'Failed to retrieve users' }, 500);
  }
});

/**
 * ADMIN: Fetch Tasks List
 */
adminRouter.get('/tasks', async (c) => {
  try {
    const tasks = await Task.find({}).populate('userId', 'fullName email').sort({ createdAt: -1 }).limit(100);
    return c.json(tasks);
  } catch (error) {
    return c.json({ error: 'Failed to retrieve tasks' }, 500);
  }
});

/**
 * ADMIN: Fetch Payments List
 */
adminRouter.get('/payments', async (c) => {
  try {
    const payments = await Payments.find({}).populate('userId', 'fullName email').sort({ createdAt: -1 }).limit(100);
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

    // Most Used Categories
    const tasks = await Task.find({});
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
        tasks: await Task.countDocuments({}),
        payments: completedPayments.length,
      }
    });
  } catch (error: any) {
    console.error('Admin Stats Error:', error);
    return c.json({ error: 'Failed to load admin stats.' }, 500);
  }
});
