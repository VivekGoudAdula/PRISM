import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/common';
import {
  getUserReferralSummary,
  getUserAttributions,
  getReferralLeaderboard,
  getActiveCampaign,
  attributeReferralOnSignup,
  getUserLedger,
} from '../services/referral';

const referralRouter = new Hono();

// Apply rate limiting middleware across referral endpoints
referralRouter.use('*', rateLimiter);

/**
 * 1. GET /api/referrals/me
 * Authenticated user: referral code, link, points balance, referral counts, and campaign status.
 * Server-side identity: uses tokenUser.userId directly; never trusts client-supplied user IDs.
 */
referralRouter.get('/me', requireAuth, async (c) => {
  try {
    const tokenUser = (c as any).get('user');
    if (!tokenUser || !tokenUser.userId) {
      return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
    }

    const baseUrl = c.req.header('origin') || c.req.header('host') || undefined;
    const summary = await getUserReferralSummary(tokenUser.userId, baseUrl);
    return c.json(summary);
  } catch (err: any) {
    console.error('Safe error in GET /api/referrals/me:', err?.message || err);
    return c.json({ error: 'Failed to retrieve referral profile' }, 500);
  }
});

/**
 * 2. GET /api/referrals/attributions
 * Authenticated user: only returns referrals attributed to the caller, with safe statuses and pagination.
 */
referralRouter.get('/attributions', requireAuth, async (c) => {
  try {
    const tokenUser = (c as any).get('user');
    if (!tokenUser || !tokenUser.userId) {
      return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
    }

    const pageParam = parseInt(c.req.query('page') || '1', 10);
    const limitParam = parseInt(c.req.query('limit') || '20', 10);
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isInteger(limitParam) ? Math.min(100, Math.max(1, limitParam)) : 20;

    const data = await getUserAttributions(tokenUser.userId, page, limit);
    return c.json(data);
  } catch (err: any) {
    console.error('Safe error in GET /api/referrals/attributions:', err?.message || err);
    return c.json({ error: 'Failed to retrieve referral attributions' }, 500);
  }
});

/**
 * 3. GET /api/referrals/leaderboard
 * Public / Platform: returns ranked display names and points with pagination and privacy policy.
 * PRIVACY GUARANTEE: Never exposes email addresses, private user IDs, documents, payment details, or task contents.
 */
referralRouter.get('/leaderboard', optionalAuth, async (c) => {
  try {
    const pageParam = parseInt(c.req.query('page') || '1', 10);
    const limitParam = parseInt(c.req.query('limit') || '25', 10);
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isInteger(limitParam) ? Math.min(100, Math.max(5, limitParam)) : 25;

    const data = await getReferralLeaderboard(page, limit);
    return c.json(data);
  } catch (err: any) {
    console.error('Safe error in GET /api/referrals/leaderboard:', err?.message || err);
    return c.json({ error: 'Failed to retrieve referral leaderboard' }, 500);
  }
});

/**
 * 4. GET /api/referrals/campaign
 * Public: returns active campaign rules, dates, qualification criteria, point values, limits, and eligibility.
 */
referralRouter.get('/campaign', async (c) => {
  try {
    const campaign = await getActiveCampaign();
    return c.json({
      campaign: {
        id: campaign._id,
        code: campaign.code,
        name: campaign.name,
        description: campaign.description,
        rewards: {
          referrerPoints: campaign.referrerPoints,
          refereePoints: campaign.refereePoints,
        },
        referrerPoints: campaign.referrerPoints,
        refereePoints: campaign.refereePoints,
        rulesVersion: campaign.rulesVersion || '1.0',
        startDate: campaign.startDate,
        endDate: campaign.endDate || null,
        qualificationCriteria: campaign.qualificationCriteria,
        limits: campaign.limits || { maxReferralsPerUser: 0, totalCampaignBudgetPoints: 0 },
        eligibility: 'Open to all verified Web2 (email) and Web3 (Algorand wallet) registered accounts.',
        rules: [
          'A referral qualifies only after the referred user completes their first genuine paid AI task.',
          'Tasks that fail verification or trigger refunds do not qualify.',
          'Test transactions, unpaid requests, and internal wallet transfers do not qualify.',
          'Self-referrals and duplicate attributions are strictly prohibited.',
          'Points are auditable through your append-only points ledger.',
        ],
        isActive: campaign.isActive,
      },
    });
  } catch (err: any) {
    console.error('Safe error in GET /api/referrals/campaign:', err?.message || err);
    return c.json({ error: 'Failed to retrieve referral campaign details' }, 500);
  }
});

/**
 * 5. POST /api/referrals/attribute
 * Authenticated user: validates and records a referral code during signup or onboarding.
 * Strictly rejects invalid codes, self-referrals, duplicate attributions, and prohibited attribution modifications.
 */
referralRouter.post('/attribute', requireAuth, async (c) => {
  try {
    const tokenUser = (c as any).get('user');
    if (!tokenUser || !tokenUser.userId) {
      return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const { referralCode } = body;

    // Strict input validation
    if (!referralCode || typeof referralCode !== 'string') {
      return c.json({ error: 'referralCode is required' }, 400);
    }

    const cleanCode = referralCode.trim().toUpperCase();
    if (cleanCode.length < 3 || cleanCode.length > 32 || !/^[A-Z0-9_-]+$/.test(cleanCode)) {
      return c.json({ error: 'Invalid referral code format. Code must be 3-32 alphanumeric characters.' }, 400);
    }

    const clientIp = c.req.header('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = c.req.header('user-agent')?.slice(0, 120) || 'Unknown';

    const result = await attributeReferralOnSignup({
      refereeId: tokenUser.userId,
      referralCode: cleanCode,
      clientIp,
      userAgent,
    });

    if (!result.success) {
      const statusCode = result.message.includes('already') ? 409 : 400;
      return c.json({ error: result.message }, statusCode);
    }

    return c.json(
      {
        success: true,
        message: result.message,
        attributionId: result.attribution?._id,
      },
      201
    );
  } catch (err: any) {
    console.error('Safe error in POST /api/referrals/attribute:', err?.message || err);
    return c.json({ error: err.message || 'Failed to attribute referral' }, 500);
  }
});

/**
 * 6. GET /api/referrals/ledger
 * Authenticated user: returns paginated point history for the authenticated user only.
 */
referralRouter.get('/ledger', requireAuth, async (c) => {
  try {
    const tokenUser = (c as any).get('user');
    if (!tokenUser || !tokenUser.userId) {
      return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
    }

    const pageParam = parseInt(c.req.query('page') || '1', 10);
    const limitParam = parseInt(c.req.query('limit') || '20', 10);
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isInteger(limitParam) ? Math.min(100, Math.max(1, limitParam)) : 20;

    const ledgerData = await getUserLedger(tokenUser.userId, page, limit);
    return c.json(ledgerData);
  } catch (err: any) {
    console.error('Safe error in GET /api/referrals/ledger:', err?.message || err);
    return c.json({ error: 'Failed to retrieve points ledger' }, 500);
  }
});

export default referralRouter;
