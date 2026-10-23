import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { config } from 'dotenv';
config();

import mongoose from 'mongoose';
import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import authRouter from '../routes/auth';
import referralRouter from '../routes/referrals';
import adminReferralRouter from '../routes/adminReferrals';

import { User } from '../models/User';
import { Task } from '../models/Task';
import { Payments } from '../models/Payments';
import { ReferralCampaign } from '../models/ReferralCampaign';
import { ReferralAttribution } from '../models/ReferralAttribution';
import { ReferralLedger } from '../models/ReferralLedger';
import { ReferralProfile } from '../models/ReferralProfile';
import { ReferralFraudReview } from '../models/ReferralFraudReview';
import { getJwtSecret } from '../middleware/auth';
import {
  evaluateReferralQualification,
  getActiveCampaign,
  attributeReferralOnSignup,
  initReferralIndexes,
} from '../services/referral';
import { CURRENT_LEGAL_VERSIONS } from '../legal.config';

function generateTestToken(userId: string, email: string, role: 'user' | 'admin'): string {
  return jwt.sign({ userId, email, role }, getJwtSecret(), { expiresIn: '1h' });
}

async function runReferralTests() {
  console.log('\n================================================================');
  console.log('       PRISM REFERRAL PROGRAM END-TO-END VERIFICATION SUITE      ');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
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

  console.log('Connecting to MongoDB...');
  await mongoose.connect(connectionString);
  console.log('✅ Connected to MongoDB\n');

  // Create isolated test app
  const app = new Hono();
  app.route('/api/auth', authRouter);
  app.route('/api/referrals', referralRouter);
  app.route('/api/admin/referrals', adminReferralRouter);

  try {
    // Clean up test data
    const testEmails = ['test_alice_ref@prism.ai', 'test_bob_ref@prism.ai', 'test_eve_ref@prism.ai', 'test_admin_ref@prism.ai'];
    const existingTestUsers = await User.find({ email: { $in: testEmails } });
    const userIds = existingTestUsers.map((u) => u._id);
    await ReferralAttribution.deleteMany({ $or: [{ referrerId: { $in: userIds } }, { refereeId: { $in: userIds } }] });
    await ReferralLedger.deleteMany({ userId: { $in: userIds } });
    await ReferralProfile.deleteMany({ $or: [{ userId: { $in: userIds } }, { referralCode: { $in: ['PRISM-ALICE9', 'PRISM-BOBM77', 'PRISM-EVEX11'] } }] });
    await ReferralFraudReview.deleteMany({});
    await Task.deleteMany({ userId: { $in: userIds } });
    await Payments.deleteMany({ $or: [{ userId: { $in: userIds } }, { x402TransactionId: { $regex: /^ALGO-TX-GENUINE-TEST/ } }] });
    await User.deleteMany({ email: { $in: testEmails } });

    console.log('--- Step 1: Ensure active Referral Campaign and Indexes ---');
    await initReferralIndexes();
    const campaign = await getActiveCampaign();
    campaign.referrerPoints = 5;
    campaign.refereePoints = 10;
    await campaign.save();
    console.log(`Active campaign: ${campaign.name} (${campaign.code}), Referrer: ${campaign.referrerPoints} pts, Referee: ${campaign.refereePoints} pts`);
    console.log('✅ Campaign & non-destructive indexes verified\n');

    console.log('--- Step 2: Seed Users (Admin, Alice Referrer, Bob Referee, Eve Attacker) ---');
    const salt = await bcrypt.genSalt(10);
    const pwdHash = await bcrypt.hash('Password123!', salt);

    const admin = await User.create({
      fullName: 'Referral Admin',
      email: 'test_admin_ref@prism.ai',
      passwordHash: pwdHash,
      role: 'admin',
      credits: 9999,
      referralPointsBalance: 0,
      termsAcceptedVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
      privacyAcceptedVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
    });

    const alice = await User.create({
      fullName: 'Alice Walker',
      email: 'test_alice_ref@prism.ai',
      passwordHash: pwdHash,
      role: 'user',
      credits: 100,
      referralCode: 'PRISM-ALICE9',
      referralPointsBalance: 0,
      termsAcceptedVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
      privacyAcceptedVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
    });

    const bob = await User.create({
      fullName: 'Bob Martinez',
      email: 'test_bob_ref@prism.ai',
      passwordHash: pwdHash,
      role: 'user',
      credits: 100,
      referralCode: 'PRISM-BOBM77',
      referralPointsBalance: 0,
      termsAcceptedVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
      privacyAcceptedVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
    });

    const eve = await User.create({
      fullName: 'Eve Sybil',
      email: 'test_eve_ref@prism.ai',
      passwordHash: pwdHash,
      role: 'user',
      credits: 100,
      referralCode: 'PRISM-EVEX11',
      referralPointsBalance: 0,
      termsAcceptedVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
      privacyAcceptedVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
    });

    const aliceToken = generateTestToken(alice._id.toString(), alice.email, 'user');
    const bobToken = generateTestToken(bob._id.toString(), bob.email, 'user');
    const adminToken = generateTestToken(admin._id.toString(), admin.email, 'admin');

    console.log(`Alice ID: ${alice._id}, code: ${alice.referralCode}`);
    console.log(`Bob ID:   ${bob._id}, code: ${bob.referralCode}`);
    console.log('✅ Users seeded\n');

    console.log('--- Step 3: GET /api/referrals/campaign (Public) ---');
    const campRes = await app.request('/api/referrals/campaign');
    if (campRes.status !== 200) throw new Error(`Expected 200, got ${campRes.status}`);
    const campData = await campRes.json();
    if (!campData.campaign || campData.campaign.code !== campaign.code) {
      throw new Error('Campaign response mismatch');
    }
    console.log('✅ Public campaign endpoint passed\n');

    console.log('--- Step 4: GET /api/referrals/me (Alice) ---');
    const meRes = await app.request('/api/referrals/me', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    if (meRes.status !== 200) throw new Error(`Expected 200, got ${meRes.status}`);
    const meData = await meRes.json();
    if (meData.referralCode !== 'PRISM-ALICE9' || meData.counts.totalReferred !== 0) {
      throw new Error(`Profile data mismatch: ${JSON.stringify(meData)}`);
    }
    console.log('✅ User referral summary passed (Alice code: ' + meData.referralCode + ')\n');

    // Verify 1:1 ReferralProfile exists for Alice
    const aliceProfile = await ReferralProfile.findOne({ userId: alice._id });
    if (!aliceProfile || aliceProfile.referralCode !== 'PRISM-ALICE9') {
      throw new Error(`Alice ReferralProfile missing or invalid: ${JSON.stringify(aliceProfile)}`);
    }
    console.log('✅ ReferralProfile 1:1 model verified (status: ' + aliceProfile.status + ', code: ' + aliceProfile.referralCode + ')\n');

    console.log('--- Step 5: Anti-Fraud: Alice attempts self-referral ---');
    const selfRefRes = await app.request('/api/referrals/attribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ referralCode: 'PRISM-ALICE9' }),
    });
    if (selfRefRes.status !== 400) {
      throw new Error(`Expected 400 for self-referral, got ${selfRefRes.status}`);
    }
    const selfRefData = await selfRefRes.json();
    console.log(`Rejected properly with: "${selfRefData.error}"`);
    console.log('✅ Self-referral prevented successfully\n');

    console.log("--- Step 6: Bob attributes to Alice's referral code ---");
    const attrRes = await app.request('/api/referrals/attribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({ referralCode: 'PRISM-ALICE9' }),
    });
    if (attrRes.status !== 201) {
      const errText = await attrRes.text();
      throw new Error(`Expected 201, got ${attrRes.status}: ${errText}`);
    }
    const attrData = await attrRes.json();
    console.log(`Attribution created: ID=${attrData.attributionId}, message="${attrData.message}"`);

    // Verify in database: attribution is pending
    const dbAttr = await ReferralAttribution.findById(attrData.attributionId);
    if (!dbAttr || dbAttr.status !== 'pending' || !dbAttr.referrerId.equals(alice._id)) {
      throw new Error('Attribution document invalid in DB');
    }
    console.log('✅ Attribution status is "pending" as required\n');

    console.log('--- Step 7: Duplicate Attribution Prevention: Eve attempts to attribute Bob ---');
    const dupRes = await app.request('/api/referrals/attribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({ referralCode: 'PRISM-EVEX11' }),
    });
    if (dupRes.status !== 409) {
      throw new Error(`Expected 409 for duplicate attribution, got ${dupRes.status}`);
    }
    console.log('✅ Duplicate attribution blocked with HTTP 409\n');

    console.log('--- Step 8: Source of Truth Check 1: Failed / Refunded Task Does NOT Qualify ---');
    const failedTask = await Task.create({
      userId: bob._id,
      prompt: 'Extract invoice with corrupted document',
      category: 'invoice_extraction',
      status: 'failed',
      verificationStatus: 'failed',
      refundIssued: true,
      refundAmount: 0.75,
      totalCost: 0.75,
    });
    const failedEval = await evaluateReferralQualification(bob._id, failedTask._id);
    if (failedEval.qualified !== false) {
      throw new Error('Failed/refunded task incorrectly qualified referral!');
    }
    const attrAfterFail = await ReferralAttribution.findById(dbAttr._id);
    if (attrAfterFail?.status !== 'pending') {
      throw new Error('Attribution status changed unexpectedly on failed task');
    }
    console.log('✅ Failed/refunded task correctly rejected for qualification\n');

    console.log('--- Step 9: Source of Truth Check 2: Task without matching completed payment does NOT qualify ---');
    const unpaidTask = await Task.create({
      userId: bob._id,
      prompt: 'Quick resume screening without payment record',
      category: 'resume_screening',
      status: 'completed',
      verificationStatus: 'passed',
      refundIssued: false,
      totalCost: 0.50,
    });
    const unpaidEval = await evaluateReferralQualification(bob._id, unpaidTask._id);
    if (unpaidEval.qualified !== false) {
      throw new Error('Unpaid task incorrectly qualified referral!');
    }
    console.log('✅ Unpaid task correctly rejected for qualification\n');

    console.log('--- Step 10: Source of Truth Check 3: Genuine Completed Paid Task QUALIFIES ---');
    const genuineTask = await Task.create({
      userId: bob._id,
      prompt: 'Genuine code review of repository',
      category: 'code_review',
      status: 'completed',
      verificationStatus: 'passed',
      refundIssued: false,
      totalCost: 0.75,
    });

    const genuinePayment = await Payments.create({
      taskId: genuineTask._id,
      userId: bob._id,
      x402TransactionId: `ALGO-TX-GENUINE-TEST-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      amount: 0.75,
      totalAmount: 0.75,
      blockchain: 'Algorand',
      network: 'MAINNET',
      currency: 'USDC',
      status: 'completed',
    });

    const qualifyResult = await evaluateReferralQualification(bob._id, genuineTask._id);
    if (!qualifyResult.qualified) {
      throw new Error(`Expected qualification to succeed, got: ${qualifyResult.message}`);
    }
    console.log(`Qualification succeeded: message="${qualifyResult.message}", points=${qualifyResult.pointsAwarded}`);

    // Verify database state: attribution transitioned to 'qualified'
    const attrQualified = await ReferralAttribution.findById(dbAttr._id);
    if (attrQualified?.status !== 'qualified') {
      throw new Error(`Expected status "qualified", got ${attrQualified?.status}`);
    }
    if (!attrQualified.qualifyingTaskId?.equals(genuineTask._id)) {
      throw new Error('Qualifying taskId not saved');
    }

    // Verify ledger: exactly 1 credit for Alice (5 pts) and 1 for Bob (10 pts)
    const aliceLedger = await ReferralLedger.find({ userId: alice._id });
    if (aliceLedger.length !== 1 || aliceLedger[0].points !== 5) {
      throw new Error(`Alice ledger incorrect: ${JSON.stringify(aliceLedger)}`);
    }
    const bobLedger = await ReferralLedger.find({ userId: bob._id });
    if (bobLedger.length !== 1 || bobLedger[0].points !== 10) {
      throw new Error(`Bob ledger incorrect: ${JSON.stringify(bobLedger)}`);
    }

    // Verify user balance cache
    const aliceUpdated = await User.findById(alice._id);
    if (aliceUpdated?.referralPointsBalance !== 5) {
      throw new Error(`Alice points balance mismatch: expected 5, got ${aliceUpdated?.referralPointsBalance}`);
    }
    const bobUpdated = await User.findById(bob._id);
    if (bobUpdated?.referralPointsBalance !== 10) {
      throw new Error(`Bob points balance mismatch: expected 10, got ${bobUpdated?.referralPointsBalance}`);
    }
    console.log('✅ Qualification invariant verified: Alice +5 pts, Bob +10 pts\n');

    console.log('--- Step 11: Idempotency Check: Second call awards ZERO additional points ---');
    const secondQualify = await evaluateReferralQualification(bob._id, genuineTask._id);
    if (secondQualify.qualified !== false) {
      throw new Error('Second qualification attempt unexpectedly returned true');
    }
    const aliceLedgerCount = await ReferralLedger.countDocuments({ userId: alice._id });
    if (aliceLedgerCount !== 1) {
      throw new Error(`Duplicate ledger entry created! Count: ${aliceLedgerCount}`);
    }
    console.log('✅ Exactly-once points invariant verified: duplicate call yielded 0 extra points\n');

    console.log('--- Step 12: GET /api/referrals/attributions (Alice sees Bob, masked for privacy) ---');
    const attrListRes = await app.request('/api/referrals/attributions', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    if (attrListRes.status !== 200) throw new Error(`Expected 200, got ${attrListRes.status}`);
    const attrListData = await attrListRes.json();
    if (attrListData.attributions.length !== 1) {
      throw new Error(`Expected 1 attribution, got ${attrListData.attributions.length}`);
    }
    const item = attrListData.attributions[0];
    if (item.status !== 'qualified' || item.pointsEarned !== 5) {
      throw new Error(`Attribution list item mismatch: ${JSON.stringify(item)}`);
    }
    // Verify referee email is NOT exposed
    if (JSON.stringify(attrListData).includes('test_bob_ref@prism.ai')) {
      throw new Error('SECURITY VIOLATION: Referee raw email was exposed in attributions list!');
    }
    console.log(`Referral displayed as: "${item.referredUser}", points: ${item.pointsEarned}, status: "${item.status}"`);
    console.log('✅ Attributions privacy verified (zero email leakage)\n');

    console.log('--- Step 13: GET /api/referrals/leaderboard (Public Leaderboard) ---');
    const lbRes = await app.request('/api/referrals/leaderboard');
    if (lbRes.status !== 200) throw new Error(`Expected 200, got ${lbRes.status}`);
    const lbData = await lbRes.json();
    if (!Array.isArray(lbData.leaderboard) || lbData.leaderboard.length === 0) {
      throw new Error('Leaderboard is empty');
    }
    const referrerEntry = lbData.leaderboard.find((entry: any) => entry.qualifiedReferrals >= 1);
    if (!referrerEntry || referrerEntry.qualifiedReferrals < 1) {
      throw new Error('No referrer with qualified referrals found in leaderboard');
    }
    // Verify privacy
    if (JSON.stringify(lbData).includes('@prism.ai')) {
      throw new Error('SECURITY VIOLATION: Email found in public leaderboard response!');
    }
    console.log(`Leaderboard Referrer: "${referrerEntry.displayName}" with ${referrerEntry.qualifiedReferrals} referrals, ${referrerEntry.totalPoints} pts`);
    console.log('✅ Leaderboard privacy & ranking verified\n');

    console.log('--- Step 14: GET /api/referrals/ledger (Paginated history) ---');
    const ledgerRes = await app.request('/api/referrals/ledger?page=1&limit=10', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    if (ledgerRes.status !== 200) throw new Error(`Expected 200, got ${ledgerRes.status}`);
    const ledgerData = await ledgerRes.json();
    if (ledgerData.balance !== 5 || ledgerData.entries.length !== 1) {
      throw new Error(`Ledger response mismatch: ${JSON.stringify(ledgerData)}`);
    }
    console.log(`Ledger balance: ${ledgerData.balance}, entries: ${ledgerData.entries.length}`);
    console.log('✅ Ledger endpoint verified\n');

    console.log('--- Step 15: Admin Endpoints ---');
    // 15A. Overview
    const adminOverviewRes = await app.request('/api/admin/referrals/overview', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (adminOverviewRes.status !== 200) throw new Error(`Admin overview expected 200, got ${adminOverviewRes.status}`);
    const adminOverview = await adminOverviewRes.json();
    if (adminOverview.summary.qualifiedAttributions < 1) {
      throw new Error('Admin overview count mismatch');
    }
    console.log(`Admin Overview: total=${adminOverview.summary.totalAttributions}, qualified=${adminOverview.summary.qualifiedAttributions}, points=${adminOverview.summary.totalPointsAwarded}`);

    // 15B. Campaign Patch
    const patchRes = await app.request(`/api/admin/referrals/campaigns/${campaign._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ referrerPoints: 5, refereePoints: 10 }),
    });
    if (patchRes.status !== 200) throw new Error(`Campaign patch expected 200, got ${patchRes.status}`);
    const patchData = await patchRes.json();
    if (patchData.campaign.referrerPoints !== 5 || patchData.campaign.refereePoints !== 10) {
      throw new Error('Campaign points were not updated');
    }
    console.log(`Campaign updated by admin: referrerPoints=${patchData.campaign.referrerPoints}, refereePoints=${patchData.campaign.refereePoints}`);

    // 15C. Attribution Review (Reject & revoke)
    const reviewRes = await app.request(`/api/admin/referrals/${dbAttr._id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ action: 'reject', reason: 'Sybil investigation' }),
    });
    if (reviewRes.status !== 200) throw new Error(`Review expected 200, got ${reviewRes.status}`);
    const reviewData = await reviewRes.json();
    if (reviewData.attribution.status !== 'rejected') {
      throw new Error('Attribution was not marked rejected');
    }
    // Verify points revoked from Alice's balance
    const aliceRevoked = await User.findById(alice._id);
    if (aliceRevoked?.referralPointsBalance !== 0) {
      throw new Error(`Points were not revoked: Alice balance is ${aliceRevoked?.referralPointsBalance}`);
    }
    // Verify fraud review record created in DB
    const fraudRecord = await ReferralFraudReview.findOne({ attributionId: dbAttr._id });
    if (!fraudRecord || fraudRecord.action !== 'reject' || fraudRecord.pointsRevoked !== 5) {
      throw new Error(`ReferralFraudReview record mismatch: ${JSON.stringify(fraudRecord)}`);
    }
    console.log(`Admin review rejection verified: status=rejected, Alice balance rolled back to ${aliceRevoked.referralPointsBalance}`);
    console.log('✅ Admin review, points revocation, and ReferralFraudReview record verified\n');

    console.log('--- Step 16: Security, Auth & Boundary Verification ---');

    // 16A: Authentication failures (unauthenticated requests return 401)
    const unauthMe = await app.request('/api/referrals/me');
    if (unauthMe.status !== 401) throw new Error(`Expected 401 for unauthenticated /me, got ${unauthMe.status}`);

    const unauthAttr = await app.request('/api/referrals/attributions');
    if (unauthAttr.status !== 401) throw new Error(`Expected 401 for unauthenticated /attributions, got ${unauthAttr.status}`);

    const unauthLedger = await app.request('/api/referrals/ledger');
    if (unauthLedger.status !== 401) throw new Error(`Expected 401 for unauthenticated /ledger, got ${unauthLedger.status}`);

    const unauthAdmin = await app.request('/api/admin/referrals/overview');
    if (unauthAdmin.status !== 401) throw new Error(`Expected 401 for unauthenticated admin overview, got ${unauthAdmin.status}`);
    console.log('✅ Authentication enforcement verified (401 on missing tokens)');

    // 16B: Authorization failures (regular user accessing admin endpoints returns 403)
    const forbiddenOverview = await app.request('/api/admin/referrals/overview', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    if (forbiddenOverview.status !== 403) throw new Error(`Expected 403 for non-admin overview, got ${forbiddenOverview.status}`);

    const forbiddenPatch = await app.request(`/api/admin/referrals/campaigns/${campaign._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ referrerPoints: 9999 }),
    });
    if (forbiddenPatch.status !== 403) throw new Error(`Expected 403 for non-admin patch, got ${forbiddenPatch.status}`);

    const forbiddenReview = await app.request(`/api/admin/referrals/${dbAttr._id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ action: 'reject', reason: 'Attempt unauthorized review' }),
    });
    if (forbiddenReview.status !== 403) throw new Error(`Expected 403 for non-admin review, got ${forbiddenReview.status}`);
    console.log('✅ Authorization enforcement verified (403 on non-admin tokens)');

    // 16C: Validation errors (invalid formats, negative points, missing reasons)
    const badCodeRes = await app.request('/api/referrals/attribute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ referralCode: '!!@@$$' }),
    });
    if (badCodeRes.status !== 400) throw new Error(`Expected 400 for invalid code format, got ${badCodeRes.status}`);

    const negativePtsRes = await app.request(`/api/admin/referrals/campaigns/${campaign._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ referrerPoints: -100 }),
    });
    if (negativePtsRes.status !== 400) throw new Error(`Expected 400 for negative points, got ${negativePtsRes.status}`);

    const shortReasonRes = await app.request(`/api/admin/referrals/${dbAttr._id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ action: 'reject', reason: 'no' }),
    });
    if (shortReasonRes.status !== 400) throw new Error(`Expected 400 for short review reason (<5 chars), got ${shortReasonRes.status}`);
    console.log('✅ Validation error handling verified (400 on malformed input)');

    // 16D: Payment fabrication prevention: Admin cannot manually approve unpaid referral
    const eveAttr = await ReferralAttribution.create({
      referrerId: alice._id,
      refereeId: eve._id,
      referralCodeUsed: 'PRISM-ALICE9',
      campaignId: campaign._id,
      status: 'pending',
    });

    const fabricateApproveRes = await app.request(`/api/admin/referrals/${eveAttr._id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ action: 'approve', reason: 'Attempting to approve without paid task' }),
    });
    if (fabricateApproveRes.status !== 400) {
      throw new Error(`Security breach: expected 400 for approving unpaid referral, got ${fabricateApproveRes.status}`);
    }
    const fabricateData = await fabricateApproveRes.json();
    if (!fabricateData.error?.includes('genuine paid') && !fabricateData.error?.includes('Cannot approve')) {
      throw new Error(`Unexpected error message for payment fabrication attempt: ${fabricateData.error}`);
    }
    console.log('✅ Payment fabrication prevention verified (admin cannot approve without genuine paid task)');

    // 16E: Cross-user data isolation
    const bobAttrRes = await app.request('/api/referrals/attributions', {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobAttrData = await bobAttrRes.json();
    if (bobAttrData.attributions?.length !== 0) {
      throw new Error(`Cross-user leakage: Bob saw ${bobAttrData.attributions.length} attributions`);
    }

    const bobLedgerRes = await app.request('/api/referrals/ledger', {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobLedgerData = await bobLedgerRes.json();
    if (bobLedgerData.balance !== 10) {
      throw new Error(`Bob balance mismatch: expected 10 welcome bonus, got ${bobLedgerData.balance}`);
    }
    console.log('✅ Cross-user data isolation verified (users only see their own records)\n');

    // Clean up test records
    const allCreatedUserIds = [admin._id, alice._id, bob._id, eve._id];
    await ReferralAttribution.deleteMany({ $or: [{ referrerId: { $in: allCreatedUserIds } }, { refereeId: { $in: allCreatedUserIds } }] });
    await ReferralLedger.deleteMany({ userId: { $in: allCreatedUserIds } });
    await ReferralProfile.deleteMany({ userId: { $in: allCreatedUserIds } });
    await ReferralFraudReview.deleteMany({ attributionId: dbAttr._id });
    await Task.deleteMany({ userId: { $in: allCreatedUserIds } });
    await Payments.deleteMany({ $or: [{ userId: { $in: allCreatedUserIds } }, { x402TransactionId: { $regex: /^ALGO-TX-GENUINE-TEST/ } }] });
    await User.deleteMany({ email: { $in: testEmails } });

    // Restore active campaign to official MVP rewards (5 referrer pts, 10 referee pts)
    await ReferralCampaign.findByIdAndUpdate(campaign._id, {
      referrerPoints: 5,
      refereePoints: 10,
    });

    console.log('================================================================');
    console.log('       ALL 15 REFERRAL PROGRAM VERIFICATION TESTS PASSED ✓      ');
    console.log('================================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST FAILURE:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runReferralTests();
