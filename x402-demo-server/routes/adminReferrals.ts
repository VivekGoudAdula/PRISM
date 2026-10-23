import { Hono } from 'hono';
import { Types } from 'mongoose';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { rateLimiter } from '../middleware/common';
import {
  getAdminReferralsOverview,
  reviewAttribution,
  reconcileUserLedgerBalance,
} from '../services/referral';
import { ReferralCampaign } from '../models/ReferralCampaign';
import { AuditLog } from '../models/AuditLog';

const adminReferralRouter = new Hono();

// Apply rate limiting and enforce admin authorization on all routes
adminReferralRouter.use('*', rateLimiter);
adminReferralRouter.use('*', requireAuth, requireAdmin);

/**
 * 7. GET /api/admin/referrals/overview
 * Admin only: program-wide referral stats, funnel metrics, and review queue without exposing raw PII.
 */
adminReferralRouter.get('/overview', async (c) => {
  try {
    const overview = await getAdminReferralsOverview();
    return c.json(overview);
  } catch (err: any) {
    console.error('Safe error in GET /api/admin/referrals/overview:', err?.message || err);
    return c.json({ error: 'Failed to retrieve admin referrals overview' }, 500);
  }
});

/**
 * 8. PATCH /api/admin/referrals/campaigns/:id
 * Admin only: update referral campaign parameters with validation on date ranges, limits, and points.
 * Records who changed the campaign and when.
 */
adminReferralRouter.patch('/campaigns/:id', async (c) => {
  try {
    const campaignId = c.req.param('id');
    if (!campaignId || !Types.ObjectId.isValid(campaignId)) {
      return c.json({ error: 'Invalid campaign ID format' }, 400);
    }
    const tokenUser = (c as any).get('user');
    const body = await c.req.json().catch(() => ({}));

    const campaign = await ReferralCampaign.findById(campaignId);
    if (!campaign) {
      return c.json({ error: 'Campaign not found' }, 404);
    }

    const previousValues = {
      name: campaign.name,
      referrerPoints: campaign.referrerPoints,
      refereePoints: campaign.refereePoints,
      isActive: campaign.isActive,
      endDate: campaign.endDate,
      limits: campaign.limits,
    };

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2) return c.json({ error: 'Campaign name must be at least 2 characters' }, 400);
      campaign.name = name;
    }

    if (body.description !== undefined) {
      campaign.description = String(body.description).trim();
    }

    if (body.referrerPoints !== undefined) {
      const rp = Number(body.referrerPoints);
      if (isNaN(rp) || rp < 0) return c.json({ error: 'referrerPoints must be a non-negative number' }, 400);
      campaign.referrerPoints = rp;
    }

    if (body.refereePoints !== undefined) {
      const rp = Number(body.refereePoints);
      if (isNaN(rp) || rp < 0) return c.json({ error: 'refereePoints must be a non-negative number' }, 400);
      campaign.refereePoints = rp;
    }

    if (body.isActive !== undefined) {
      campaign.isActive = Boolean(body.isActive);
    }

    // Date range validation
    if (body.endDate !== undefined) {
      if (body.endDate === null || body.endDate === '') {
        campaign.endDate = undefined;
      } else {
        const parsedEnd = new Date(body.endDate);
        if (isNaN(parsedEnd.getTime())) {
          return c.json({ error: 'Invalid endDate format' }, 400);
        }
        if (parsedEnd.getTime() <= new Date(campaign.startDate).getTime()) {
          return c.json({ error: 'endDate must be after startDate' }, 400);
        }
        campaign.endDate = parsedEnd;
      }
    }

    // Limits validation
    if (body.limits !== undefined && typeof body.limits === 'object') {
      if (body.limits.maxReferralsPerUser !== undefined) {
        const maxRef = Number(body.limits.maxReferralsPerUser);
        if (isNaN(maxRef) || maxRef < 0) return c.json({ error: 'limits.maxReferralsPerUser must be >= 0' }, 400);
        campaign.limits = { ...campaign.limits, maxReferralsPerUser: maxRef };
      }
      if (body.limits.totalCampaignBudgetPoints !== undefined) {
        const maxBudget = Number(body.limits.totalCampaignBudgetPoints);
        if (isNaN(maxBudget) || maxBudget < 0) return c.json({ error: 'limits.totalCampaignBudgetPoints must be >= 0' }, 400);
        campaign.limits = { ...campaign.limits, totalCampaignBudgetPoints: maxBudget };
      }
    }

    await campaign.save();

    // Record administrative audit trail with before/after changes
    await AuditLog.create({
      userId: tokenUser.userId,
      action: 'Referral Campaign Updated',
      details: {
        campaignId: campaign._id,
        updatedBy: tokenUser.userId,
        timestamp: new Date().toISOString(),
        previousValues,
        newValues: {
          name: campaign.name,
          referrerPoints: campaign.referrerPoints,
          refereePoints: campaign.refereePoints,
          isActive: campaign.isActive,
          endDate: campaign.endDate,
          limits: campaign.limits,
        },
      },
    }).catch(() => {});

    return c.json({ success: true, campaign });
  } catch (err: any) {
    console.error('Safe error in PATCH /api/admin/referrals/campaigns/:id:', err?.message || err);
    return c.json({ error: err.message || 'Failed to update campaign' }, 500);
  }
});

/**
 * 9. POST /api/admin/referrals/:id/review
 * Admin only: documented approve or reject action with mandatory reason.
 * SECURITY GUARANTEE: Never allows an approval action to fabricate a payment or bypass genuine qualification rules.
 */
adminReferralRouter.post('/:id/review', async (c) => {
  try {
    const attributionId = c.req.param('id');
    if (!attributionId || !Types.ObjectId.isValid(attributionId)) {
      return c.json({ error: 'Invalid attribution ID format' }, 400);
    }
    const tokenUser = (c as any).get('user');
    const body = await c.req.json().catch(() => ({}));
    const { action, reason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return c.json({ error: "Invalid action. Must be 'approve' or 'reject'." }, 400);
    }

    // Enforce mandatory documented reason
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return c.json({ error: 'A documented reason of at least 5 characters is required for all administrative review actions.' }, 400);
    }

    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = c.req.header('user-agent')?.slice(0, 120) || 'Unknown';

    const result = await reviewAttribution(
      attributionId,
      action as 'approve' | 'reject',
      reason.trim(),
      tokenUser.userId,
      clientIp,
      userAgent
    );

    return c.json(result);
  } catch (err: any) {
    console.error('Safe error in POST /api/admin/referrals/:id/review:', err?.message || err);
    const msg = err.message || 'Failed to review attribution';
    const statusCode = msg.includes('Cannot approve') || msg.includes('reason') ? 400 : msg.includes('not found') ? 404 : 500;
    return c.json({ error: msg }, statusCode);
  }
});

/**
 * 10. POST /api/admin/referrals/reconcile/:userId
 * Admin only: reconcile a user's displayed referral points balance against their append-only ledger entries.
 */
adminReferralRouter.post('/reconcile/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return c.json({ error: 'Invalid user ID format' }, 400);
    }
    const tokenUser = (c as any).get('user');
    const reconciledBalance = await reconcileUserLedgerBalance(userId);

    await AuditLog.create({
      userId: tokenUser.userId,
      action: 'Referral Ledger Reconciled',
      details: { targetUserId: userId, reconciledBalance },
    }).catch(() => {});

    return c.json({ success: true, userId, reconciledBalance });
  } catch (err: any) {
    console.error('Safe error in POST /api/admin/referrals/reconcile/:userId:', err?.message || err);
    return c.json({ error: err.message || 'Failed to reconcile user balance' }, 500);
  }
});

export default adminReferralRouter;
