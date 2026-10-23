import mongoose, { Types } from 'mongoose';
import crypto from 'crypto';
import { User, IUser } from '../models/User';
import { Task } from '../models/Task';
import { Payments } from '../models/Payments';
import { ReferralCampaign, IReferralCampaign } from '../models/ReferralCampaign';
import { ReferralAttribution, IReferralAttribution } from '../models/ReferralAttribution';
import { ReferralLedger } from '../models/ReferralLedger';
import { ReferralProfile, IReferralProfile } from '../models/ReferralProfile';
import { ReferralFraudReview } from '../models/ReferralFraudReview';
import { AuditLog } from '../models/AuditLog';

/** Default fallback campaign configuration */
export const DEFAULT_CAMPAIGN_CODE = 'LAUNCH2026';
export const DEFAULT_REFERRER_POINTS = 5;
export const DEFAULT_REFEREE_POINTS = 10;

/**
 * Ensures indexes are built for all referral collections non-destructively.
 */
export async function initReferralIndexes(): Promise<void> {
  try {
    await Promise.all([
      ReferralCampaign.createIndexes(),
      ReferralAttribution.createIndexes(),
      ReferralLedger.createIndexes(),
      ReferralProfile.createIndexes(),
      ReferralFraudReview.createIndexes(),
    ]);
  } catch (err) {
    console.warn('Non-critical: error ensuring referral indexes:', err);
  }
}

/**
 * Generates a cryptographically random, human-readable referral code.
 * Format: PRISM-XXXXXX (Base32 Crockford style, excluding ambiguous chars: 0, O, 1, I)
 */
export async function generateUniqueReferralCode(prefix = 'PRISM'): Promise<string> {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let attempts = 0;

  while (attempts < 10) {
    attempts++;
    let randomPart = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      randomPart += chars[bytes[i] % chars.length];
    }
    const candidateCode = `${prefix}-${randomPart}`;
    const [existingUser, existingProfile] = await Promise.all([
      User.findOne({ referralCode: candidateCode }),
      ReferralProfile.findOne({ referralCode: candidateCode }),
    ]);
    if (!existingUser && !existingProfile) {
      return candidateCode;
    }
  }

  // Fallback with timestamp suffix if collisions occur
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Ensures a user document and its 1:1 ReferralProfile have a referral code assigned.
 */
export async function ensureUserReferralCode(user: any): Promise<string> {
  let code = user.referralCode;
  if (!code || code.trim().length === 0) {
    code = await generateUniqueReferralCode();
    user.referralCode = code;
    await user.save();
  }

  // Ensure 1:1 ReferralProfile exists and matches
  try {
    let profile = await ReferralProfile.findOne({ userId: user._id });
    if (!profile) {
      profile = await ReferralProfile.findOneAndUpdate(
        { userId: user._id },
        {
          $setOnInsert: {
            userId: user._id,
            referralCode: code,
            status: 'active',
            totalReferred: 0,
            totalQualified: 0,
            totalPointsEarned: 0,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
    } else if (profile.referralCode !== code) {
      profile.referralCode = code;
      await profile.save();
    }
  } catch (profileErr: any) {
    if (profileErr.code !== 11000) {
      console.warn('Error syncing ReferralProfile:', profileErr);
    }
  }

  return code;
}

/**
 * Fetches the active campaign or seeds the default campaign if none exists.
 */
export async function getActiveCampaign(): Promise<IReferralCampaign> {
  let campaign = await ReferralCampaign.findOne({ isActive: true }).sort({ createdAt: -1 });
  if (!campaign) {
    campaign = await ReferralCampaign.create({
      name: 'PRISM Pioneer Referral Program',
      code: DEFAULT_CAMPAIGN_CODE,
      description: 'Invite creators, developers, and enterprises to execute AI tasks with PRISM.',
      referrerPoints: DEFAULT_REFERRER_POINTS,
      refereePoints: DEFAULT_REFEREE_POINTS,
      isActive: true,
      startDate: new Date(),
      rulesVersion: '1.0',
      limits: {
        maxReferralsPerUser: 0,
        totalCampaignBudgetPoints: 0,
      },
      qualificationCriteria: {
        minTaskCostUSD: 0.01,
        allowedNetworks: ['MAINNET', 'TESTNET'],
        requirePaymentCompleted: true,
        disallowMockSignaturesInProd: true,
      },
    });
  } else if (
    campaign.code === DEFAULT_CAMPAIGN_CODE &&
    (campaign.referrerPoints !== DEFAULT_REFERRER_POINTS || campaign.refereePoints !== DEFAULT_REFEREE_POINTS)
  ) {
    // Safely synchronize active default campaign to standardized MVP rewards (5 pts referrer, 10 pts referee)
    // Preserves existing earned user balances and append-only ledger entries untouched.
    campaign.referrerPoints = DEFAULT_REFERRER_POINTS;
    campaign.refereePoints = DEFAULT_REFEREE_POINTS;
    await campaign.save();
    console.log(
      `[Referral] Safely synchronized active campaign (${campaign.code}) rewards to ${DEFAULT_REFERRER_POINTS} referrer pts / ${DEFAULT_REFEREE_POINTS} referee pts`
    );
  }
  return campaign;
}

/**
 * Registers attribution when a referred user signs up (Web2 or Web3).
 * Strictly enforces anti-fraud: no self-referrals, no duplicate attributions, active campaign check.
 */
export async function attributeReferralOnSignup(params: {
  refereeId: Types.ObjectId | string;
  referralCode: string;
  clientIp?: string;
  userAgent?: string;
}): Promise<{ success: boolean; message: string; attribution?: IReferralAttribution }> {
  const { refereeId, referralCode, clientIp = '', userAgent = '' } = params;

  if (!referralCode || typeof referralCode !== 'string' || referralCode.trim().length === 0) {
    return { success: false, message: 'Referral code is required.' };
  }

  const cleanCode = referralCode.trim().toUpperCase();

  // Find referrer
  const referrer = await User.findOne({ referralCode: cleanCode });
  if (!referrer) {
    return { success: false, message: 'Invalid referral code. No matching user found.' };
  }

  const refereeObjectId = new Types.ObjectId(refereeId);

  // Anti-fraud: Disallow self-referral
  if (referrer._id.equals(refereeObjectId)) {
    return { success: false, message: 'Self-referral is not permitted.' };
  }

  // Anti-fraud: Verify referee is not already attributed (strict 1 attribution per referee)
  const existingAttribution = await ReferralAttribution.findOne({ refereeId: refereeObjectId });
  if (existingAttribution) {
    return { success: false, message: 'User is already attributed to a referral.' };
  }

  // Anti-fraud: Verify wallet address does not match referrer's wallet
  const referee = await User.findById(refereeObjectId);
  if (referee && referee.walletAddress && referrer.walletAddress) {
    if (referee.walletAddress.toLowerCase() === referrer.walletAddress.toLowerCase()) {
      return { success: false, message: 'Referral disallowed: Matching wallet address.' };
    }
  }

  // Fetch active campaign
  const campaign = await getActiveCampaign();

  // Check campaign limits if set
  if (campaign.limits?.maxReferralsPerUser > 0) {
    const userReferralsCount = await ReferralAttribution.countDocuments({ referrerId: referrer._id });
    if (userReferralsCount >= campaign.limits.maxReferralsPerUser) {
      return { success: false, message: 'Referrer has reached the maximum referral limit for this campaign.' };
    }
  }

  // Create attribution record in 'pending' status
  let attribution: IReferralAttribution;
  try {
    attribution = await ReferralAttribution.create({
      referrerId: referrer._id,
      refereeId: refereeObjectId,
      referralCodeUsed: cleanCode,
      campaignId: campaign._id,
      status: 'pending',
      clientIp,
      userAgent,
    });
  } catch (createErr: any) {
    if (createErr.code === 11000) {
      return { success: false, message: 'User is already attributed to a referral.' };
    }
    throw createErr;
  }

  // Link referredBy on referee User record
  if (referee) {
    referee.referredBy = referrer._id;
    await referee.save();
  }

  // Update referrer ReferralProfile metrics
  await ReferralProfile.findOneAndUpdate(
    { userId: referrer._id },
    { $inc: { totalReferred: 1 } },
    { upsert: false }
  ).catch(() => {});

  // Audit log
  await AuditLog.create({
    userId: refereeObjectId,
    action: 'Referral Applied',
    details: {
      attributionId: attribution._id,
      referrerId: referrer._id,
      referralCode: cleanCode,
      campaignId: campaign._id,
    },
    ipAddress: clientIp,
  }).catch(() => {});

  return {
    success: true,
    message: 'Referral code applied successfully. Bonus points will be awarded upon your first paid task execution.',
    attribution,
  };
}

/**
 * Evaluates whether a user's task execution fulfills the qualification criteria
 * for a pending referral attribution.
 *
 * Source of Truth Invariant:
 * 1. Task must be 'completed', verificationStatus !== 'failed', refundIssued !== true, totalCost > 0.
 * 2. Payments record must exist with status 'completed', amount > 0, genuine transaction ID.
 * 3. Atomic transition from 'pending' -> 'qualified' and append-only ledger transaction.
 */
export async function evaluateReferralQualification(
  userId: Types.ObjectId | string,
  taskId?: Types.ObjectId | string
): Promise<{ qualified: boolean; message: string; pointsAwarded?: number }> {
  try {
    const userObjectId = new Types.ObjectId(userId);

    // 1. Check if user has an attribution in 'pending' status
    const attribution = await ReferralAttribution.findOne({
      refereeId: userObjectId,
      status: 'pending',
    });

    if (!attribution) {
      return { qualified: false, message: 'No pending attribution found for this user.' };
    }

    // 2. Identify candidate task
    let task = null;
    if (taskId) {
      task = await Task.findOne({
        _id: new Types.ObjectId(taskId),
        userId: userObjectId,
        status: 'completed',
        refundIssued: { $ne: true },
        verificationStatus: { $ne: 'failed' },
        totalCost: { $gt: 0 },
      });
      if (!task) {
        return { qualified: false, message: 'Specified task is not completed, was refunded, or failed verification.' };
      }
    } else {
      task = await Task.findOne({
        userId: userObjectId,
        status: 'completed',
        refundIssued: { $ne: true },
        verificationStatus: { $ne: 'failed' },
        totalCost: { $gt: 0 },
      }).sort({ createdAt: 1 });
    }

    if (!task) {
      return { qualified: false, message: 'No successful, unrefunded task found.' };
    }

    // Invariant: Verify this task has not already qualified another attribution
    const existingTaskUsage = await ReferralAttribution.findOne({
      qualifyingTaskId: task._id,
      status: 'qualified',
      _id: { $ne: attribution._id },
    });
    if (existingTaskUsage) {
      return { qualified: false, message: 'This task has already been used to qualify another referral.' };
    }

    // 3. Find genuine matching completed payment
    const payment = await Payments.findOne({
      taskId: task._id,
      userId: userObjectId,
      status: 'completed',
      $or: [{ totalAmount: { $gt: 0 } }, { amount: { $gt: 0 } }],
    }).sort({ createdAt: 1 });

    if (!payment) {
      return { qualified: false, message: 'No verified completed payment found for qualifying task.' };
    }

    // Invariant: Verify this payment has not already qualified another attribution
    const existingPaymentUsage = await ReferralAttribution.findOne({
      qualifyingPaymentId: payment._id,
      status: 'qualified',
      _id: { $ne: attribution._id },
    });
    if (existingPaymentUsage) {
      return { qualified: false, message: 'This payment transaction has already been used to qualify another referral.' };
    }

    // 4. Fetch campaign & validate qualification criteria
    const campaign = await ReferralCampaign.findById(attribution.campaignId) || await getActiveCampaign();
    const referrerPoints = campaign.referrerPoints || DEFAULT_REFERRER_POINTS;
    const refereePoints = campaign.refereePoints || DEFAULT_REFEREE_POINTS;

    // Invariant: Verify payment network is permitted by active campaign
    const allowedNetworks = campaign.qualificationCriteria?.allowedNetworks || ['MAINNET', 'TESTNET'];
    if (payment.network && !allowedNetworks.includes(payment.network)) {
      return { qualified: false, message: `Payment network (${payment.network}) is not permitted by active campaign.` };
    }

    // Exclude mock test signatures unless in non-production local testing
    const txId = payment.x402TransactionId || '';
    const disallowMock = campaign.qualificationCriteria?.disallowMockSignaturesInProd || process.env.NODE_ENV === 'production';
    if (disallowMock && process.env.NODE_ENV === 'production' && (txId.startsWith('mock-signature-') || txId.startsWith('grouped-independent-'))) {
      return { qualified: false, message: 'Mock payment signatures cannot qualify in production.' };
    }

    // Check task cost against campaign minimum
    const minCost = campaign.qualificationCriteria?.minTaskCostUSD || 0.01;
    const taskCost = task.totalCost || 0;
    if (taskCost < minCost) {
      return { qualified: false, message: `Task cost (${taskCost}) does not meet campaign minimum (${minCost}).` };
    }

    // Invariant: Check total campaign points budget if set
    if (campaign.limits?.totalCampaignBudgetPoints && campaign.limits.totalCampaignBudgetPoints > 0) {
      const budgetAggregate = await ReferralLedger.aggregate([
        { $match: { campaignId: campaign._id, points: { $gt: 0 } } },
        { $group: { _id: null, totalAwarded: { $sum: '$points' } } },
      ]);
      const currentAwarded = budgetAggregate[0]?.totalAwarded || 0;
      if (currentAwarded + referrerPoints + refereePoints > campaign.limits.totalCampaignBudgetPoints) {
        return { qualified: false, message: 'Campaign points budget has been exhausted.' };
      }
    }

    const qualificationMetadata = {
      taskCostUSD: taskCost,
      paymentAmount: payment.totalAmount || payment.amount || 0,
      network: payment.network || 'MAINNET',
      currency: payment.currency || 'USDC',
      transactionId: payment.x402TransactionId || '',
      verifiedAt: payment.createdAt || new Date(),
    };

    // 5. ATOMIC TRANSITION: Update attribution to 'qualified'
    // Concurrency guard: Only the thread that transitions status 'pending' -> 'qualified' succeeds
    let updatedAttribution: IReferralAttribution | null = null;
    try {
      updatedAttribution = await ReferralAttribution.findOneAndUpdate(
        { _id: attribution._id, status: 'pending' },
        {
          $set: {
            status: 'qualified',
            qualifyingTaskId: task._id,
            qualifyingPaymentId: payment._id,
            qualifiedAt: new Date(),
            qualificationMetadata,
          },
        },
        { returnDocument: 'after' }
      );
    } catch (atomicErr: any) {
      if (atomicErr.code === 11000) {
        return { qualified: false, message: 'Qualifying task or payment is already bound to another referral.' };
      }
      throw atomicErr;
    }

    if (!updatedAttribution) {
      // Race condition occurred; another thread already qualified this attribution
      return { qualified: false, message: 'Attribution already qualified by a concurrent operation.' };
    }

    // 6. Append-only ledger updates with deterministic idempotency keys
    const referrerId = updatedAttribution.referrerId;
    const refereeId = updatedAttribution.refereeId;

    // Referrer reward
    const referrerIdempotencyKey = `qualify:attribution:${updatedAttribution._id}:user:${referrerId}`;
    const referrerUser = await User.findById(referrerId);
    if (referrerUser) {
      try {
        await User.findByIdAndUpdate(referrerId, { $inc: { referralPointsBalance: referrerPoints } });
        const updatedRefUser = await User.findById(referrerId);
        const newBalance = updatedRefUser?.referralPointsBalance || referrerPoints;

        await ReferralLedger.create({
          userId: referrerId,
          attributionId: updatedAttribution._id,
          campaignId: campaign._id,
          type: 'referral_reward',
          points: referrerPoints,
          balanceAfter: newBalance,
          description: `Referral reward: Invited user completed first genuine paid task (${task.category || 'AI task'})`,
          idempotencyKey: referrerIdempotencyKey,
          metadata: {
            taskId: task._id.toString(),
            paymentId: payment._id.toString(),
            category: task.category,
          },
        });

        // Update Referrer ReferralProfile
        await ReferralProfile.findOneAndUpdate(
          { userId: referrerId },
          { $inc: { totalQualified: 1, totalPointsEarned: referrerPoints } },
          { upsert: true }
        ).catch(() => {});
      } catch (ledgerErr: any) {
        if (ledgerErr.code === 11000) {
          await User.findByIdAndUpdate(referrerId, { $inc: { referralPointsBalance: -referrerPoints } });
        } else {
          console.error('ReferralLedger creation error for referrer:', ledgerErr);
        }
      }
    }

    // Referee welcome bonus
    const refereeIdempotencyKey = `qualify:attribution:${updatedAttribution._id}:user:${refereeId}`;
    const refereeUser = await User.findById(refereeId);
    if (refereeUser) {
      try {
        await User.findByIdAndUpdate(refereeId, { $inc: { referralPointsBalance: refereePoints } });
        const updatedRefereeUser = await User.findById(refereeId);
        const newBalance = updatedRefereeUser?.referralPointsBalance || refereePoints;

        await ReferralLedger.create({
          userId: refereeId,
          attributionId: updatedAttribution._id,
          campaignId: campaign._id,
          type: 'welcome_bonus',
          points: refereePoints,
          balanceAfter: newBalance,
          description: `Welcome bonus: Completed your first genuine paid AI task (${task.category || 'AI task'})`,
          idempotencyKey: refereeIdempotencyKey,
          metadata: {
            taskId: task._id.toString(),
            paymentId: payment._id.toString(),
            category: task.category,
          },
        });

        // Update Referee ReferralProfile
        await ReferralProfile.findOneAndUpdate(
          { userId: refereeId },
          { $inc: { totalPointsEarned: refereePoints } },
          { upsert: true }
        ).catch(() => {});
      } catch (ledgerErr: any) {
        if (ledgerErr.code === 11000) {
          await User.findByIdAndUpdate(refereeId, { $inc: { referralPointsBalance: -refereePoints } });
        } else {
          console.error('ReferralLedger creation error for referee:', ledgerErr);
        }
      }
    }

    // Audit log
    await AuditLog.create({
      userId: referrerId,
      action: 'Referral Qualified',
      details: {
        attributionId: updatedAttribution._id,
        refereeId,
        qualifyingTaskId: task._id,
        qualifyingPaymentId: payment._id,
        referrerPoints,
        refereePoints,
      },
    }).catch(() => {});

    return {
      qualified: true,
      message: 'Referral qualified and points successfully credited.',
      pointsAwarded: referrerPoints,
    };
  } catch (error: any) {
    console.error('Error evaluating referral qualification:', error);
    return { qualified: false, message: error.message || 'Error evaluating qualification.' };
  }
}

/**
 * Returns the authenticated user's referral summary.
 */
export async function getUserReferralSummary(userId: Types.ObjectId | string, baseUrl?: string) {
  const userObjectId = new Types.ObjectId(userId);
  const user = await User.findById(userObjectId);
  if (!user) throw new Error('User not found');

  const referralCode = await ensureUserReferralCode(user);
  const campaign = await getActiveCampaign();

  const totalReferred = await ReferralAttribution.countDocuments({ referrerId: userObjectId });
  const pendingCount = await ReferralAttribution.countDocuments({ referrerId: userObjectId, status: 'pending' });
  const qualifiedCount = await ReferralAttribution.countDocuments({ referrerId: userObjectId, status: 'qualified' });

  // Recalculate or retrieve balance and lifetime points earned
  const balance = user.referralPointsBalance || 0;
  const profileDoc = await ReferralProfile.findOne({ userId: userObjectId });
  const pointsEarned = profileDoc?.totalPointsEarned || balance;

  let rank: number | null = null;
  if (balance > 0) {
    const higherUsers = await User.countDocuments({ referralPointsBalance: { $gt: balance } });
    rank = higherUsers + 1;
  }

  const appBaseUrl = baseUrl || process.env.VITE_APP_URL || 'https://prism.app';
  const shareUrl = `${appBaseUrl}?ref=${referralCode}`;

  return {
    referralCode,
    shareUrl,
    pointsBalance: balance,
    pointsEarned,
    rank: rank ? `#${rank}` : 'Unranked',
    counts: {
      totalReferred,
      pendingCount,
      qualifiedCount,
    },
    metrics: {
      totalReferred,
      pendingCount,
      qualifiedCount,
    },
    campaign: {
      code: campaign.code,
      name: campaign.name,
      referrerPoints: campaign.referrerPoints,
      refereePoints: campaign.refereePoints,
    },
  };
}

/**
 * Mask an email or wallet address to protect referee privacy.
 * E.g., 'john.doe@example.com' -> 'j***e@example.com', 'ALGORANDWALLETKEY' -> 'ALGO...KEY'
 */
export function maskDisplayName(user: any): string {
  if (!user) return 'Anonymous User';

  if (user.fullName && user.fullName.trim().length > 0) {
    const parts = user.fullName.trim().split(' ');
    return parts
      .map((p: string) => (p.length > 2 ? `${p[0]}***${p[p.length - 1]}` : `${p[0]}*`))
      .join(' ');
  }

  if (user.email && user.email.includes('@')) {
    const [local, domain] = user.email.split('@');
    const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}*`;
    return `${maskedLocal}@${domain}`;
  }

  if (user.walletAddress && user.walletAddress.length > 8) {
    return `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}`;
  }

  return 'PRISM Pioneer';
}

/**
 * Returns privacy-masked list of referrals for the logged in user.
 */
export async function getUserAttributions(userId: Types.ObjectId | string, page = 1, limit = 20) {
  const userObjectId = new Types.ObjectId(userId);
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const [attributions, total] = await Promise.all([
    ReferralAttribution.find({ referrerId: userObjectId })
      .populate('refereeId', 'fullName email walletAddress createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    ReferralAttribution.countDocuments({ referrerId: userObjectId }),
  ]);

  const campaign = await getActiveCampaign();
  const referrerPts = campaign.referrerPoints || DEFAULT_REFERRER_POINTS;

  return {
    attributions: attributions.map((attr: any) => {
      const masked = maskDisplayName(attr.refereeId);
      return {
        id: attr._id,
        maskedRefereeName: masked,
        referredUser: masked,
        status: attr.status,
        createdAt: attr.createdAt,
        qualifiedAt: attr.qualifiedAt || null,
        pointsEarned: attr.status === 'qualified' ? referrerPts : 0,
      };
    }),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * Returns privacy-preserving leaderboard of top referrers.
 */
export async function getReferralLeaderboard(page = 1, limit = 25) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(5, limit));
  const skip = (safePage - 1) * safeLimit;

  const [topUsers, total] = await Promise.all([
    User.find({ referralPointsBalance: { $gt: 0 } })
      .select('fullName email walletAddress referralPointsBalance')
      .sort({ referralPointsBalance: -1, createdAt: 1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    User.countDocuments({ referralPointsBalance: { $gt: 0 } }),
  ]);

  const items = await Promise.all(
    topUsers.map(async (u, idx) => {
      const qualifiedCount = await ReferralAttribution.countDocuments({
        referrerId: u._id,
        status: 'qualified',
      });

      return {
        rank: skip + idx + 1,
        displayName: maskDisplayName(u),
        points: u.referralPointsBalance || 0,
        totalPoints: u.referralPointsBalance || 0,
        qualifiedReferrals: qualifiedCount,
      };
    })
  );

  return {
    leaderboard: items,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
    privacyPolicy: 'In accordance with PRISM data protection standards, participant names are privacy-masked. Raw emails, user IDs, and payment details are strictly withheld.',
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Returns paginated points ledger for the user.
 */
export async function getUserLedger(userId: Types.ObjectId | string, page = 1, limit = 20) {
  const userObjectId = new Types.ObjectId(userId);
  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    ReferralLedger.find({ userId: userObjectId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ReferralLedger.countDocuments({ userId: userObjectId }),
  ]);

  const user = await User.findById(userObjectId).select('referralPointsBalance');

  return {
    balance: user?.referralPointsBalance || 0,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    entries: entries.map((e: any) => ({
      id: e._id,
      type: e.type,
      points: e.points,
      balanceAfter: e.balanceAfter,
      description: e.description,
      timestamp: e.createdAt,
    })),
  };
}

/**
 * Returns admin overview statistics.
 */
export async function getAdminReferralsOverview() {
  const [
    totalAttributions,
    pendingAttributions,
    qualifiedAttributions,
    rejectedAttributions,
    totalPointsResult,
    campaigns,
    recentAttributions,
  ] = await Promise.all([
    ReferralAttribution.countDocuments({}),
    ReferralAttribution.countDocuments({ status: 'pending' }),
    ReferralAttribution.countDocuments({ status: 'qualified' }),
    ReferralAttribution.countDocuments({ status: 'rejected' }),
    ReferralLedger.aggregate([
      { $match: { points: { $gt: 0 } } },
      { $group: { _id: null, totalPoints: { $sum: '$points' } } },
    ]),
    ReferralCampaign.find({}).sort({ createdAt: -1 }).lean(),
    ReferralAttribution.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('referrerId', 'fullName email walletAddress')
      .populate('refereeId', 'fullName email walletAddress createdAt')
      .populate('qualifyingTaskId', 'totalCost category status')
      .lean(),
  ]);

  const totalPointsAwarded = totalPointsResult[0]?.totalPoints || 0;

  // Detect potential suspicious attributions
  const flaggedAttributions = recentAttributions.filter((attr: any) => {
    return attr.clientIp && attr.clientIp !== '127.0.0.1' && attr.clientIp !== 'localhost';
  });

  return {
    summary: {
      totalAttributions,
      pendingAttributions,
      qualifiedAttributions,
      rejectedAttributions,
      totalPointsAwarded,
    },
    flaggedCount: flaggedAttributions.length,
    campaigns,
    recentAttributions: recentAttributions.map((a: any) => ({
      id: a._id,
      referrer: {
        id: a.referrerId?._id,
        name: a.referrerId?.fullName || 'Unknown',
        email: a.referrerId?.email || '',
        wallet: a.referrerId?.walletAddress || '',
      },
      referee: {
        id: a.refereeId?._id,
        name: a.refereeId?.fullName || 'Unknown',
        email: a.refereeId?.email || '',
        wallet: a.refereeId?.walletAddress || '',
      },
      referralCodeUsed: a.referralCodeUsed,
      status: a.status,
      qualifyingTaskId: a.qualifyingTaskId?._id || null,
      qualifiedAt: a.qualifiedAt || null,
      clientIp: a.clientIp,
      createdAt: a.createdAt,
      adminReview: a.adminReview,
    })),
  };
}

/**
 * Admin action to manually review an attribution (approve or reject).
 * Reversals are recorded as compensating ledger entries.
 */
export async function reviewAttribution(
  attributionId: string,
  action: 'approve' | 'reject',
  reason: string,
  adminUserId: Types.ObjectId | string,
  clientIp = '',
  userAgent = ''
) {
  const attribution = await ReferralAttribution.findById(attributionId);
  if (!attribution) {
    throw new Error('Attribution not found.');
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw new Error('A documented reason of at least 5 characters is required for all administrative review actions.');
  }

  const cleanReason = reason.trim();
  const campaign = await ReferralCampaign.findById(attribution.campaignId) || await getActiveCampaign();
  const referrerPoints = campaign.referrerPoints || DEFAULT_REFERRER_POINTS;
  const refereePoints = campaign.refereePoints || DEFAULT_REFEREE_POINTS;

  if (action === 'approve') {
    if (attribution.status === 'qualified') {
      return { success: true, message: 'Attribution is already qualified.', attribution };
    }

    // Verify genuine qualification rules: does a verified paid task exist for this referee?
    const qualificationResult = await evaluateReferralQualification(attribution.refereeId);
    if (!qualificationResult.qualified) {
      throw new Error(`Cannot approve referral: referee has no verified completed paid AI task (${qualificationResult.message}). Administrative reviews cannot fabricate payments or bypass qualification rules.`);
    }

    // Qualification succeeded via genuine payment verification
    const refreshedAttribution = await ReferralAttribution.findById(attribution._id);
    if (refreshedAttribution) {
      refreshedAttribution.adminReview = {
        reviewedBy: new Types.ObjectId(adminUserId),
        reviewedAt: new Date(),
        reason: cleanReason,
        previousStatus: 'pending',
      };
      await refreshedAttribution.save();
    }

    // Record formal fraud review audit
    await ReferralFraudReview.create({
      attributionId: attribution._id,
      referrerId: attribution.referrerId,
      refereeId: attribution.refereeId,
      reviewerId: new Types.ObjectId(adminUserId),
      action: 'approve',
      reason: cleanReason,
      pointsRevoked: 0,
      clientIp,
      userAgent,
    });

    await AuditLog.create({
      userId: new Types.ObjectId(adminUserId),
      action: 'Referral Reviewed',
      details: { attributionId: attribution._id, action: 'approve', reason: cleanReason },
    }).catch(() => {});

    return {
      success: true,
      message: 'Attribution verified against genuine paid task and qualified successfully.',
      attribution: refreshedAttribution || attribution,
      pointsAwarded: qualificationResult.pointsAwarded,
    };
  } else {
    // Action: 'reject'
    const previousStatus = attribution.status;
    if (previousStatus === 'rejected') {
      return { success: true, message: 'Attribution is already rejected.', attribution };
    }

    attribution.status = 'rejected';
    attribution.adminReview = {
      reviewedBy: new Types.ObjectId(adminUserId),
      reviewedAt: new Date(),
      reason: cleanReason,
      previousStatus,
    };
    await attribution.save();

    let compensatingLedger = null;
    let pointsRevoked = 0;

    // If was previously qualified, revoke points via compensating negative ledger entry
    if (previousStatus === 'qualified') {
      const referrer = await User.findById(attribution.referrerId);
      if (referrer) {
        // Query original reward ledger entry to revoke the exact awarded amount
        const originalReward = await ReferralLedger.findOne({
          attributionId: attribution._id,
          userId: referrer._id,
          type: 'referral_reward',
        });
        pointsRevoked = originalReward ? originalReward.points : referrerPoints;
        const newBal = Math.max(0, (referrer.referralPointsBalance || 0) - pointsRevoked);
        try {
          compensatingLedger = await ReferralLedger.create({
            userId: referrer._id,
            attributionId: attribution._id,
            campaignId: campaign._id,
            type: 'revocation',
            points: -pointsRevoked,
            balanceAfter: newBal,
            description: `Compensating revocation: ${reason || 'Rejected by administrator'}`,
            idempotencyKey: `admin_revoke:${attribution._id}:${referrer._id}`,
          });
          referrer.referralPointsBalance = newBal;
          await referrer.save();

          await ReferralProfile.findOneAndUpdate(
            { userId: referrer._id },
            { $inc: { totalQualified: -1, totalPointsEarned: -pointsRevoked } },
            { upsert: false }
          ).catch(() => {});
        } catch (ledgerErr: any) {
          if (ledgerErr.code === 11000) {
            console.warn('Revocation already processed for this attribution:', attribution._id);
          } else {
            throw ledgerErr;
          }
        }
      }
    }

    // Record formal fraud review audit
    await ReferralFraudReview.create({
      attributionId: attribution._id,
      referrerId: attribution.referrerId,
      refereeId: attribution.refereeId,
      reviewerId: new Types.ObjectId(adminUserId),
      action: 'reject',
      reason: cleanReason,
      pointsRevoked,
      compensatingLedgerId: compensatingLedger?._id,
      clientIp,
      userAgent,
    });

    await AuditLog.create({
      userId: new Types.ObjectId(adminUserId),
      action: 'Referral Reviewed',
      details: { attributionId: attribution._id, action: 'reject', reason: cleanReason, pointsRevoked },
    }).catch(() => {});

    return { success: true, message: 'Attribution rejected and points revoked.', attribution };
  }
}

/**
 * Reconciles the user's displayed referralPointsBalance against the sum of the append-only ledger entries.
 * Single Source of Truth: ReferralLedger entries define the true auditable balance.
 * Synchronizes User.referralPointsBalance and ReferralProfile metrics to prevent silent divergence.
 */
export async function reconcileUserLedgerBalance(userId: Types.ObjectId | string): Promise<number> {
  const userObjectId = new Types.ObjectId(userId);
  const [ledgerSumResult, lifetimeResult, qualifiedCount, totalReferredCount] = await Promise.all([
    ReferralLedger.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]),
    ReferralLedger.aggregate([
      { $match: { userId: userObjectId, points: { $gt: 0 } } },
      { $group: { _id: null, lifetime: { $sum: '$points' } } },
    ]),
    ReferralAttribution.countDocuments({ referrerId: userObjectId, status: 'qualified' }),
    ReferralAttribution.countDocuments({ referrerId: userObjectId }),
  ]);

  const trueBalance = Math.max(0, ledgerSumResult[0]?.total || 0);
  const lifetimeEarned = lifetimeResult[0]?.lifetime || 0;

  const [user] = await Promise.all([
    User.findById(userObjectId).select('referralCode'),
  ]);

  await Promise.all([
    User.findByIdAndUpdate(userObjectId, { referralPointsBalance: trueBalance }),
    ReferralProfile.findOneAndUpdate(
      { userId: userObjectId },
      {
        $set: {
          totalPointsEarned: lifetimeEarned,
          totalQualified: qualifiedCount,
          totalReferred: totalReferredCount,
        },
        $setOnInsert: {
          userId: userObjectId,
          referralCode: user?.referralCode || `PRISM-${userObjectId.toString().slice(-6).toUpperCase()}`,
          status: 'active',
        },
      },
      { upsert: true }
    ),
  ]);

  return trueBalance;
}
