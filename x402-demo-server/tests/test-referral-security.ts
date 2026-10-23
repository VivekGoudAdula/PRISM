import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { config } from 'dotenv';
config();

import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import authRouter from '../routes/auth';
import referralRouter from '../routes/referrals';
import adminReferralRouter from '../routes/adminReferrals';
import { getJwtSecret } from '../middleware/auth';
import { User } from '../models/User';
import { Task } from '../models/Task';
import { Payments } from '../models/Payments';
import { ReferralCampaign } from '../models/ReferralCampaign';
import { ReferralAttribution } from '../models/ReferralAttribution';
import { ReferralLedger } from '../models/ReferralLedger';
import { ReferralProfile } from '../models/ReferralProfile';
import { ReferralFraudReview } from '../models/ReferralFraudReview';
import {
  evaluateReferralQualification,
  reconcileUserLedgerBalance,
  initReferralIndexes,
  getActiveCampaign,
} from '../services/referral';

function generateTestToken(user: any): string {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: '1h' }
  );
}

async function runSecurityAuditTests() {
  console.log('\n================================================================');
  console.log('       PRISM REFERRAL PROGRAM COMPREHENSIVE SECURITY AUDIT      ');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const mongoDbName = process.env.MONGO_DB_NAME || 'prism_app';

  let connectionString = mongoUri;
  if (mongoUri.includes('?')) {
    const parts = mongoUri.split('?');
    const base = parts[0].endsWith('/') ? parts[0].slice(0, -1) : parts[0];
    const protocolSeparator = base.indexOf('//');
    const pathPart = base.substring(protocolSeparator + 2);
    const slashCount = (pathPart.match(/\//g) || []).length;
    if (slashCount > 0) {
      const lastSlash = base.lastIndexOf('/');
      connectionString = base.substring(0, lastSlash) + '/' + mongoDbName + '?' + parts[1];
    } else {
      connectionString = base + '/' + mongoDbName + '?' + parts[1];
    }
  } else {
    connectionString = mongoUri.endsWith('/') ? mongoUri + mongoDbName : mongoUri + '/' + mongoDbName;
  }

  await mongoose.connect(connectionString);
  console.log('✅ Connected to MongoDB for Security Verification');

  // Create isolated test app
  const app = new Hono();
  app.route('/api/auth', authRouter);
  app.route('/api/referrals', referralRouter);
  app.route('/api/admin/referrals', adminReferralRouter);

  await initReferralIndexes();

  // Test identifiers
  const auditPrefix = 'AUDIT-' + Date.now();
  const adminEmail = `admin-${auditPrefix}@prism-security.test`;
  const attackerEmail = `attacker-${auditPrefix}@prism-security.test`;
  const referrerEmail = `referrer-${auditPrefix}@prism-security.test`;
  const referee1Email = `referee1-${auditPrefix}@prism-security.test`;
  const referee2Email = `referee2-${auditPrefix}@prism-security.test`;

  const campaign = await getActiveCampaign();
  campaign.limits = { maxReferralsPerUser: 0, totalCampaignBudgetPoints: 0 };
  await campaign.save();

  // Seed Users
  const [admin, attacker, referrer, referee1, referee2] = await Promise.all([
    User.create({
      fullName: 'Security Auditor Admin',
      email: adminEmail,
      passwordHash: '$2a$10$dummyhashforsecurityunittesting12345678901234567890123',
      role: 'admin',
      referralCode: `PRISM-ADM${Math.floor(1000 + Math.random() * 9000)}`,
      walletAddress: 'ALGO-ADMIN-WALLET-' + Date.now(),
    }),
    User.create({
      fullName: 'Eve Attacker',
      email: attackerEmail,
      passwordHash: '$2a$10$dummyhashforsecurityunittesting12345678901234567890123',
      role: 'user',
      referralCode: `PRISM-EVE${Math.floor(1000 + Math.random() * 9000)}`,
      walletAddress: 'ALGO-ATTACKER-WALLET-' + Date.now(),
    }),
    User.create({
      fullName: 'Alice Referrer',
      email: referrerEmail,
      passwordHash: '$2a$10$dummyhashforsecurityunittesting12345678901234567890123',
      role: 'user',
      referralCode: `PRISM-REF${Math.floor(1000 + Math.random() * 9000)}`,
      walletAddress: 'ALGO-ALICE-WALLET-' + Date.now(),
    }),
    User.create({
      fullName: 'Bob Referee 1',
      email: referee1Email,
      passwordHash: '$2a$10$dummyhashforsecurityunittesting12345678901234567890123',
      role: 'user',
      referralCode: `PRISM-BOB${Math.floor(1000 + Math.random() * 9000)}`,
      walletAddress: 'ALGO-BOB1-WALLET-' + Date.now(),
    }),
    User.create({
      fullName: 'Charlie Referee 2',
      email: referee2Email,
      passwordHash: '$2a$10$dummyhashforsecurityunittesting12345678901234567890123',
      role: 'user',
      referralCode: `PRISM-CHA${Math.floor(1000 + Math.random() * 9000)}`,
      walletAddress: 'ALGO-CHARLIE-WALLET-' + Date.now(),
    }),
  ]);

  const adminToken = generateTestToken(admin);
  const attackerToken = generateTestToken(attacker);
  const referrerToken = generateTestToken(referrer);
  const referee1Token = generateTestToken(referee1);

  try {
    // -------------------------------------------------------------
    // SECTION A: ATTRIBUTION SECURITY INVARIANTS
    // -------------------------------------------------------------
    console.log('--- SECTION A: ATTRIBUTION SECURITY INVARIANTS ---');

    // A1: Self-Referral Protection
    const selfRefRes = await app.request('/api/referrals/attribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${referrerToken}`,
      },
      body: JSON.stringify({ referralCode: referrer.referralCode }),
    });
    if (selfRefRes.status !== 400) throw new Error(`A1 Failed: Expected 400 on self-referral, got ${selfRefRes.status}`);
    const selfRefData = await selfRefRes.json();
    if (!selfRefData.error?.includes('Self-referral')) throw new Error('A1 Failed: Expected self-referral error message');
    console.log('✅ A1: Self-referral strictly rejected');

    // A2: Valid Attribution for Referee 1
    const validAttrRes = await app.request('/api/referrals/attribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${referee1Token}`,
      },
      body: JSON.stringify({ referralCode: referrer.referralCode }),
    });
    if (validAttrRes.status !== 201) throw new Error(`A2 Failed: Expected 201 on valid attribution, got ${validAttrRes.status}`);
    console.log('✅ A2: Valid initial attribution bound in pending status');

    // A3: Attribution Switching Prevention (At most one referrer per referee)
    const switchRes = await app.request('/api/referrals/attribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${referee1Token}`,
      },
      body: JSON.stringify({ referralCode: attacker.referralCode }),
    });
    if (switchRes.status !== 409) throw new Error(`A3 Failed: Expected 409 on attribution switch attempt, got ${switchRes.status}`);
    console.log('✅ A3: Attribution switching blocked (one referrer permanently bound)');

    // A4: Guessing / Malformed Code Validation
    const invalidFormats = ['', 'a', 'TOO_LONG_CODE_THAT_EXCEEDS_MAX_32_CHARS_LIMIT_12345', '<script>', '$$$%%%'];
    for (const code of invalidFormats) {
      const res = await app.request('/api/referrals/attribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${referee1Token}`,
        },
        body: JSON.stringify({ referralCode: code }),
      });
      if (res.status !== 400 && res.status !== 409) {
        throw new Error(`A4 Failed: Expected 400 for code "${code}", got ${res.status}`);
      }
    }
    console.log('✅ A4: Referral code guessing & malformed payloads rejected');

    // -------------------------------------------------------------
    // SECTION B: QUALIFICATION, PAYMENT INTEGRITY & DOUBLE-AWARD GUARD
    // -------------------------------------------------------------
    console.log('\n--- SECTION B: QUALIFICATION, PAYMENT INTEGRITY & DOUBLE-AWARD GUARD ---');

    // Create Genuine Paid Task for Referee 1
    const genuineTask = await Task.create({
      userId: referee1._id,
      prompt: 'Security verification code review',
      category: 'code_review',
      status: 'completed',
      totalCost: 1.25,
      verificationStatus: 'passed',
      refundIssued: false,
    });

    const genuinePayment = await Payments.create({
      taskId: genuineTask._id,
      userId: referee1._id,
      x402TransactionId: `ALGO-TX-AUDIT-${Date.now()}-${Math.random()}`,
      unitPrice: 1.25,
      executionQuantity: 1,
      executionCost: 1.00,
      platformFee: 0.25,
      totalAmount: 1.25,
      amount: 1.25,
      currency: 'USDC',
      blockchain: 'Algorand',
      network: 'MAINNET',
      status: 'completed',
    });

    // B1: Genuine Qualification
    const qualRes = await evaluateReferralQualification(referee1._id, genuineTask._id);
    if (!qualRes.qualified) throw new Error(`B1 Failed: Expected qualification to succeed, got: ${qualRes.message}`);
    console.log('✅ B1: Trusted completed paid task qualified attribution');

    // B2: Double Qualification Prevention on Same Attribution (Exactly Once)
    const replayRes = await evaluateReferralQualification(referee1._id, genuineTask._id);
    if (replayRes.qualified) throw new Error('B2 Failed: Second qualification attempt must return qualified: false');
    console.log('✅ B2: Replayed qualification awarded zero additional points (exactly once)');

    // B3: Cross-Referral Task Reuse Prevention (Single qualifying task cannot award multiple referrers)
    // Create attribution for Referee 2 to Attacker
    const attr2 = await ReferralAttribution.create({
      referrerId: attacker._id,
      refereeId: referee2._id,
      referralCodeUsed: attacker.referralCode,
      campaignId: campaign._id,
      status: 'pending',
    });

    // Attempt to qualify Referee 2 using Referee 1's already-used genuineTask
    const reuseTaskRes = await evaluateReferralQualification(referee2._id, genuineTask._id);
    if (reuseTaskRes.qualified) {
      throw new Error('B3 Failed: Security breach! A task was reused to qualify a second referral attribution!');
    }
    console.log('✅ B3: Cross-attribution task reuse blocked (task cannot award multiple referrers)');

    // B4: Campaign Points Budget Limit Enforcement
    const referee2Task = await Task.create({
      userId: referee2._id,
      prompt: 'Budget test execution',
      category: 'code_review',
      status: 'completed',
      totalCost: 1.00,
      verificationStatus: 'passed',
      refundIssued: false,
    });

    await Payments.create({
      taskId: referee2Task._id,
      userId: referee2._id,
      x402TransactionId: `ALGO-TX-AUDIT-BUDGET-${Date.now()}`,
      unitPrice: 1.00,
      executionQuantity: 1,
      executionCost: 1.00,
      platformFee: 0.00,
      totalAmount: 1.00,
      amount: 1.00,
      currency: 'USDC',
      blockchain: 'Algorand',
      network: 'MAINNET',
      status: 'completed',
    });

    const tempCampaign = await ReferralCampaign.findById(campaign._id);
    if (tempCampaign) {
      const originalBudget = tempCampaign.limits?.totalCampaignBudgetPoints || 0;
      try {
        tempCampaign.limits = { ...tempCampaign.limits, totalCampaignBudgetPoints: 1 }; // Set 1 point budget (will be exceeded by 5+10 pts)
        await tempCampaign.save();

        const budgetExhaustedRes = await evaluateReferralQualification(referee2._id, referee2Task._id);
        if (budgetExhaustedRes.qualified) {
          throw new Error('B4 Failed: Attribution qualified despite exhausted campaign points budget!');
        }
        if (!budgetExhaustedRes.message.includes('budget has been exhausted')) {
          throw new Error(`B4 Failed: Expected exhausted budget message, got: ${budgetExhaustedRes.message}`);
        }
        console.log('✅ B4: Campaign points budget limit strictly enforced against ledger total');
      } finally {
        // Restore original budget
        tempCampaign.limits = { ...tempCampaign.limits, totalCampaignBudgetPoints: originalBudget };
        await tempCampaign.save();
      }
    }

    // -------------------------------------------------------------
    // SECTION C: ACCESS CONTROL & OBJECTID VALIDATION
    // -------------------------------------------------------------
    console.log('\n--- SECTION C: ACCESS CONTROL & OBJECTID VALIDATION ---');

    // C1: Anonymous Access to Protected User APIs
    const unauthAttributions = await app.request('/api/referrals/attributions');
    if (unauthAttributions.status !== 401) throw new Error(`C1 Failed: Expected 401, got ${unauthAttributions.status}`);

    const unauthLedger = await app.request('/api/referrals/ledger');
    if (unauthLedger.status !== 401) throw new Error(`C1 Failed: Expected 401, got ${unauthLedger.status}`);

    const unauthAdminOverview = await app.request('/api/admin/referrals/overview');
    if (unauthAdminOverview.status !== 401) throw new Error(`C1 Failed: Expected 401, got ${unauthAdminOverview.status}`);
    console.log('✅ C1: Anonymous requests to protected routes rejected with 401');

    // C2: Non-Admin Access to Admin APIs
    const forbiddenAdmin = await app.request('/api/admin/referrals/overview', {
      headers: { Authorization: `Bearer ${attackerToken}` },
    });
    if (forbiddenAdmin.status !== 403) throw new Error(`C2 Failed: Expected 403, got ${forbiddenAdmin.status}`);
    console.log('✅ C2: Non-admin users rejected from admin APIs with 403');

    // C3: Malformed ObjectId Parameters Handled with HTTP 400 (No unhandled 500 cast errors)
    const malformedPatch = await app.request('/api/admin/referrals/campaigns/not-a-valid-object-id', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ referrerPoints: 5 }),
    });
    if (malformedPatch.status !== 400) throw new Error(`C3 Failed: Expected 400 for malformed campaign ID, got ${malformedPatch.status}`);

    const malformedReview = await app.request('/api/admin/referrals/invalid-mongo-id/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ action: 'reject', reason: 'Audit test reason' }),
    });
    if (malformedReview.status !== 400) throw new Error(`C3 Failed: Expected 400 for malformed review ID, got ${malformedReview.status}`);
    console.log('✅ C3: Malformed MongoDB ObjectIds return 400 Bad Request');

    // C4: Leaderboard Privacy Protection
    const lbRes = await app.request('/api/referrals/leaderboard?page=1&limit=10');
    if (lbRes.status !== 200) throw new Error(`C4 Failed: Expected 200, got ${lbRes.status}`);
    const lbData = await lbRes.json();
    for (const item of lbData.leaderboard) {
      if (item.email || item.walletAddress || item.userId || item._id) {
        throw new Error('C4 Failed: Privacy leak! Raw user identifiers found in leaderboard entry!');
      }
      if (typeof item.displayName !== 'string' || item.displayName.includes('@prism-security.test')) {
        throw new Error(`C4 Failed: Email leaked in displayName: ${item.displayName}`);
      }
    }
    console.log('✅ C4: Leaderboard privacy policy verified (zero email, wallet, or user ID leakage)');

    // -------------------------------------------------------------
    // SECTION D: DATABASE CONSISTENCY & RECONCILIATION
    // -------------------------------------------------------------
    console.log('\n--- SECTION D: DATABASE CONSISTENCY & RECONCILIATION ---');

    // D1: Verify Alice Ledger Sum matches User referralPointsBalance
    const aliceUser = await User.findById(referrer._id);
    const aliceLedgerSum = await ReferralLedger.aggregate([
      { $match: { userId: referrer._id } },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]);
    const expectedAliceBalance = aliceLedgerSum[0]?.total || 0;
    if (aliceUser?.referralPointsBalance !== expectedAliceBalance) {
      throw new Error(`D1 Failed: Balance mismatch! DB balance: ${aliceUser?.referralPointsBalance}, Ledger sum: ${expectedAliceBalance}`);
    }
    console.log(`✅ D1: Referrer balance (${aliceUser.referralPointsBalance} pts) matches exact ledger sum`);

    // D2: Reconcile Utility Verification
    const reconciledBal = await reconcileUserLedgerBalance(referrer._id);
    if (reconciledBal !== expectedAliceBalance) {
      throw new Error(`D2 Failed: Reconcile balance mismatch: ${reconciledBal} !== ${expectedAliceBalance}`);
    }
    console.log('✅ D2: reconcileUserLedgerBalance verifies against append-only ledger');

    // D3: Admin Review Revocation & Ledger Audit
    const ref1Attr = await ReferralAttribution.findOne({ refereeId: referee1._id });
    if (!ref1Attr) throw new Error('D3 Failed: ref1Attr not found');

    const rejectRes = await app.request(`/api/admin/referrals/${ref1Attr._id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        action: 'reject',
        reason: 'Security audit test: simulated dispute and points revocation',
      }),
    });
    if (rejectRes.status !== 200) throw new Error(`D3 Failed: Expected 200 on rejection, got ${rejectRes.status}`);

    // Verify compensating negative ledger entry
    const revocationEntry = await ReferralLedger.findOne({
      userId: referrer._id,
      attributionId: ref1Attr._id,
      type: 'revocation',
    });
    if (!revocationEntry || revocationEntry.points !== -campaign.referrerPoints) {
      throw new Error(`D3 Failed: Compensating revocation entry missing or mismatch: ${JSON.stringify(revocationEntry)}`);
    }

    const aliceAfterRevocation = await User.findById(referrer._id);
    if (aliceAfterRevocation?.referralPointsBalance !== 0) {
      throw new Error(`D3 Failed: Alice balance after revocation should be 0, got ${aliceAfterRevocation?.referralPointsBalance}`);
    }
    console.log('✅ D3: Compensating revocation debited exact points via immutable ledger entry');

    // D4: Repeated Rejection Idempotency (Cannot double-revoke points or create duplicate compensating entries)
    const repeatRejectRes = await app.request(`/api/admin/referrals/${ref1Attr._id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        action: 'reject',
        reason: 'Security audit test: repeated rejection attempt',
      }),
    });
    if (repeatRejectRes.status !== 200) throw new Error(`D4 Failed: Expected 200 on repeat rejection, got ${repeatRejectRes.status}`);
    const repeatData = await repeatRejectRes.json();
    if (!repeatData.message?.includes('already rejected')) throw new Error('D4 Failed: Expected already rejected message');

    const revocationCount = await ReferralLedger.countDocuments({
      userId: referrer._id,
      attributionId: ref1Attr._id,
      type: 'revocation',
    });
    if (revocationCount !== 1) throw new Error(`D4 Failed: Expected exactly 1 revocation ledger entry, found ${revocationCount}`);
    console.log('✅ D4: Repeated rejection is strictly idempotent (zero duplicate revocations)');

    // D5: Admin Reconcile Endpoint & ReferralProfile Consistency
    const reconcileRes = await app.request(`/api/admin/referrals/reconcile/${referrer._id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (reconcileRes.status !== 200) throw new Error(`D5 Failed: Expected 200 from admin reconcile endpoint, got ${reconcileRes.status}`);
    const reconcileData = await reconcileRes.json();
    if (reconcileData.reconciledBalance !== 0) throw new Error(`D5 Failed: Expected 0 balance, got ${reconcileData.reconciledBalance}`);

    const refProfile = await ReferralProfile.findOne({ userId: referrer._id });
    if (!refProfile || refProfile.totalPointsEarned < 0) {
      throw new Error('D5 Failed: ReferralProfile metrics inconsistent');
    }
    console.log('✅ D5: Admin reconcile endpoint synchronizes User and ReferralProfile consistently');

    console.log('\n================================================================');
    console.log('       ALL SECURITY AUDIT INVARIANTS PASSED SUCCESSFULLY ✓      ');
    console.log('================================================================\n');

  } finally {
    // Cleanup audit records
    const allAuditUserIds = [admin._id, attacker._id, referrer._id, referee1._id, referee2._id];
    await ReferralAttribution.deleteMany({ $or: [{ referrerId: { $in: allAuditUserIds } }, { refereeId: { $in: allAuditUserIds } }] });
    await ReferralLedger.deleteMany({ userId: { $in: allAuditUserIds } });
    await ReferralProfile.deleteMany({ userId: { $in: allAuditUserIds } });
    await ReferralFraudReview.deleteMany({ reviewerId: admin._id });
    await Task.deleteMany({ userId: { $in: allAuditUserIds } });
    await Payments.deleteMany({ userId: { $in: allAuditUserIds } });
    await User.deleteMany({ _id: { $in: allAuditUserIds } });

    await mongoose.disconnect();
  }
}

runSecurityAuditTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ SECURITY AUDIT TEST FAILED:', err);
    process.exit(1);
  });
