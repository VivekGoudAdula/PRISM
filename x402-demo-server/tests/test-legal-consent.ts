import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { config } from 'dotenv';
config();

import mongoose from 'mongoose';
import { Hono } from 'hono';
import authRouter from '../routes/auth';
import legalRouter from '../routes/legal';
import { User } from '../models/User';
import { LegalConsent } from '../models/LegalConsent';
import { UserSession } from '../models/UserSession';
import { AuditLog } from '../models/AuditLog';
import { Task } from '../models/Task';
import { SemanticCache } from '../models/SemanticCache';
import { Conversation } from '../models/Chat';
import {
  CURRENT_LEGAL_VERSIONS,
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
} from '../legal.config';

async function runLegalConsentTests() {
  console.log('\n================================================================');
  console.log('       PRISM LEGAL CONSENT & PRIVACY COMPLIANCE TEST SUITE      ');
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

  console.log(`Connecting to MongoDB for testing...`);
  try {
    await mongoose.connect(connectionString, { serverSelectionTimeoutMS: 30000 });
    console.log('✅ Connected to MongoDB\n');
  } catch (err: any) {
    console.error('❌ Could not connect to MongoDB:', err.message);
    process.exit(1);
  }

  // Create isolated test Hono app instance
  const testApp = new Hono();
  testApp.route('/api/auth', authRouter);
  testApp.route('/api/legal', legalRouter);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`         Detail: ${detail}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  const testRunId = Date.now().toString().slice(-6);
  const testEmail = `legal.tester.${testRunId}@prism.ai`;
  const testPassword = 'Password123!';
  const testFullName = `Legal Compliance Tester ${testRunId}`;

  if (mongoose.connection.readyState === 1) {
    await User.deleteMany({ email: { $regex: 'wallet_algo_test_' } }).catch(() => {});
    await User.deleteMany({ walletAddress: { $regex: 'ALGO_TEST_WALLET_' } }).catch(() => {});
    await User.deleteMany({ email: { $regex: 'legal.tester.' } }).catch(() => {});
  }

  try {
    // ── Test 1: Public legal config and documents endpoints ──────────────────
    console.log('--- Suite A: Public Legal Documents & Metadata ---');
    const configRes = await testApp.request('/api/legal/config');
    const configJson = await configRes.json();
    assert(configRes.status === 200, 'GET /api/legal/config returns 200 OK');
    assert(
      configJson.versions?.termsVersion === CURRENT_LEGAL_VERSIONS.termsVersion,
      'Config returns authoritative termsVersion matching CURRENT_LEGAL_VERSIONS'
    );
    assert(
      configJson.terms?.sectionCount === 17,
      'Terms of Service contains complete 17 required sections',
      `Found ${configJson.terms?.sectionCount}`
    );
    assert(
      configJson.privacy?.sectionCount === 17,
      'Privacy Policy contains complete 17 required sections',
      `Found ${configJson.privacy?.sectionCount}`
    );

    // ── Test 2: Signup with NEITHER checkbox selected ─────────────────────────
    console.log('\n--- Suite B: Server-Side Consent Validation on Registration ---');
    const resNoConsent = await testApp.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: testFullName,
        email: testEmail,
        password: testPassword,
        agreedToTerms: false,
        acknowledgedPrivacyPolicy: false,
        termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      }),
    });
    const jsonNoConsent = await resNoConsent.json();
    assert(
      resNoConsent.status === 400,
      'Signup rejected with HTTP 400 when neither checkbox is accepted'
    );
    assert(
      jsonNoConsent.field === 'agreedToTerms',
      'Rejection indicates missing Terms of Service agreement'
    );

    // ── Test 3: Signup with ONLY Terms accepted ───────────────────────────────
    const resTermsOnly = await testApp.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: testFullName,
        email: testEmail,
        password: testPassword,
        agreedToTerms: true,
        acknowledgedPrivacyPolicy: false,
        termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      }),
    });
    const jsonTermsOnly = await resTermsOnly.json();
    assert(
      resTermsOnly.status === 400,
      'Signup rejected with HTTP 400 when only Terms of Service is agreed'
    );
    assert(
      jsonTermsOnly.field === 'acknowledgedPrivacyPolicy',
      'Rejection indicates missing Privacy Policy acknowledgment'
    );

    // ── Test 4: Signup with ONLY Privacy Policy acknowledged ─────────────────
    const resPrivacyOnly = await testApp.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: testFullName,
        email: testEmail,
        password: testPassword,
        agreedToTerms: false,
        acknowledgedPrivacyPolicy: true,
        termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      }),
    });
    const jsonPrivacyOnly = await resPrivacyOnly.json();
    assert(
      resPrivacyOnly.status === 400,
      'Signup rejected with HTTP 400 when only Privacy Policy is acknowledged'
    );
    assert(
      jsonPrivacyOnly.field === 'agreedToTerms',
      'Rejection highlights mandatory Terms of Service requirement'
    );

    // ── Test 5: Direct API bypass attempt with outdated or spoofed versions ───
    const resOutdatedVersion = await testApp.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: testFullName,
        email: testEmail,
        password: testPassword,
        agreedToTerms: true,
        acknowledgedPrivacyPolicy: true,
        termsVersion: '0.0.1-deprecated',
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      }),
    });
    const jsonOutdated = await resOutdatedVersion.json();
    assert(
      resOutdatedVersion.status === 400,
      'Direct API request with outdated termsVersion rejected with HTTP 400'
    );
    assert(
      jsonOutdated.field === 'termsVersion',
      'Error identifies mismatched or unsupported Terms version'
    );

    // ── Test 6: Successful registration with both required selections ─────────
    console.log('\n--- Suite C: Successful Registration & Versioned Consent Storage ---');
    const startTime = Date.now();
    const resSuccess = await testApp.request('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.195',
        'user-agent': 'PrismAutomatedTestRunner/1.0',
      },
      body: JSON.stringify({
        fullName: testFullName,
        email: testEmail,
        password: testPassword,
        agreedToTerms: true,
        acknowledgedPrivacyPolicy: true,
        termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      }),
    });
    const jsonSuccess = await resSuccess.json();
    assert(
      resSuccess.status === 201,
      'Successful signup returns HTTP 201 Created when both consents are provided'
    );
    assert(
      Boolean(jsonSuccess.accessToken && jsonSuccess.user?.id),
      'Account creation succeeds and yields access credentials'
    );

    const createdUserId = jsonSuccess.user.id;
    const accessToken = jsonSuccess.accessToken;

    // ── Test 7: Verify server-side timestamp & immutable consent record ───────
    if (mongoose.connection.readyState === 1) {
      const storedConsent = await LegalConsent.findOne({ userId: createdUserId });
      assert(
        Boolean(storedConsent),
        'LegalConsent record successfully persisted in MongoDB collection'
      );
      assert(
        storedConsent?.agreedToTerms === true &&
          storedConsent?.acknowledgedPrivacyPolicy === true,
        'Stored consent record reflects affirmative agreement to both documents'
      );
      assert(
        storedConsent?.termsVersion === CURRENT_LEGAL_VERSIONS.termsVersion,
        'Stored consent matches active Terms version'
      );
      assert(
        storedConsent?.privacyVersion === CURRENT_LEGAL_VERSIONS.privacyVersion,
        'Stored consent matches active Privacy version'
      );
      assert(
        storedConsent?.signupFlow === 'email_signup',
        'Signup flow recorded accurately as "email_signup"'
      );
      assert(
        storedConsent?.ipAddress === '203.0.113.195',
        'Client IP address captured in audit log'
      );

      // Verify server-side timestamp generation (not client-provided)
      const recordedTime = new Date(storedConsent!.acceptedAt).getTime();
      const elapsed = Math.abs(recordedTime - startTime);
      assert(
        elapsed < 10000,
        'Timestamp is generated on the server at execution time (within 10s window)',
        `Elapsed: ${elapsed}ms`
      );

      // Verify user model has consent metadata
      const storedUser = await User.findById(createdUserId);
      assert(
        storedUser?.termsAcceptedVersion === CURRENT_LEGAL_VERSIONS.termsVersion,
        'User model records termsAcceptedVersion'
      );
      assert(
        storedUser?.privacyAcceptedVersion === CURRENT_LEGAL_VERSIONS.privacyVersion,
        'User model records privacyAcceptedVersion'
      );
    }

    // ── Test 8: Duplicate registration attempt rejected ───────────────────────
    console.log('\n--- Suite D: Conflict Handling & Existing User Login ---');
    const resDuplicate = await testApp.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: testFullName,
        email: testEmail,
        password: testPassword,
        agreedToTerms: true,
        acknowledgedPrivacyPolicy: true,
        termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      }),
    });
    assert(
      resDuplicate.status === 400,
      'Duplicate signup with existing email returns HTTP 400 conflict'
    );

    // ── Test 9: Existing user login preserved seamlessly ──────────────────────
    const resLogin = await testApp.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const jsonLogin = await resLogin.json();
    assert(
      resLogin.status === 200,
      'Existing registered user logs in successfully without consent friction'
    );
    assert(
      Boolean(jsonLogin.accessToken),
      'Login issues valid JWT access token'
    );

    // ── Test 10: Web3 Wallet Connect Flow — New Wallet Requires Consent ───────
    console.log('\n--- Suite E: Web3 Wallet Connection & Account Creation ---');
    const freshWalletAddress = `ALGO_TEST_WALLET_${testRunId}_XYZ123`;
    const resWalletNoConsent = await testApp.request('/api/auth/connect-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: freshWalletAddress,
      }),
    });
    const jsonWalletNoConsent = await resWalletNoConsent.json();
    assert(
      resWalletNoConsent.status === 403,
      'Unregistered wallet connection rejected with HTTP 403 when legal consent is missing'
    );
    assert(
      jsonWalletNoConsent.requiresConsent === true,
      'Response prompts client to display Terms & Privacy consent modal'
    );

    // ── Test 11: Web3 Wallet Connect Flow — Registration with Valid Consent ───
    const resWalletWithConsent = await testApp.request('/api/auth/connect-wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '198.51.100.42',
        'user-agent': 'AlgorandPeraWallet/2.0',
      },
      body: JSON.stringify({
        walletAddress: freshWalletAddress,
        agreedToTerms: true,
        acknowledgedPrivacyPolicy: true,
        termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      }),
    });
    const jsonWalletWithConsent = await resWalletWithConsent.json();
    assert(
      resWalletWithConsent.status === 200,
      'New wallet successfully registered with affirmative legal consent'
    );
    assert(
      Boolean(jsonWalletWithConsent.user?.walletAddress === freshWalletAddress),
      'Wallet account created with matching Algorand address'
    );

    if (mongoose.connection.readyState === 1) {
      const walletConsentRecord = await LegalConsent.findOne({
        userId: jsonWalletWithConsent.user.id,
      });
      assert(
        walletConsentRecord?.signupFlow === 'wallet_connect',
        'Wallet consent record stored with signupFlow: "wallet_connect"'
      );
    }

    // ── Test 12: Consent Status Endpoint ──────────────────────────────────────
    console.log('\n--- Suite F: Consent Status, Renewals & Data Rights ---');
    const resConsentStatus = await testApp.request('/api/auth/consent-status', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const jsonConsentStatus = await resConsentStatus.json();
    assert(
      resConsentStatus.status === 200,
      'GET /api/auth/consent-status returns 200 for authenticated user'
    );
    assert(
      jsonConsentStatus.needsRenewedConsent === false,
      'Active user is marked compliant with current document versions'
    );
    assert(
      jsonConsentStatus.history?.length > 0,
      'User consent history returns historical audit trail'
    );

    // ── Test 13: Renew Consent Endpoint (Simulate Policy Update) ──────────────
    const resRenew = await testApp.request('/api/auth/renew-consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        agreedToTerms: true,
        acknowledgedPrivacyPolicy: true,
        termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      }),
    });
    const jsonRenew = await resRenew.json();
    assert(
      resRenew.status === 200,
      'POST /api/auth/renew-consent records updated affirmative acceptance'
    );

    if (mongoose.connection.readyState === 1) {
      const allConsents = await LegalConsent.find({ userId: createdUserId }).sort({
        acceptedAt: 1,
      });
      assert(
        allConsents.length === 2,
        'Prior consent record is preserved as superseded; history is never destroyed'
      );
      assert(
        allConsents[0].status === 'superseded',
        'Initial consent status transitioned to "superseded"'
      );
      assert(
        allConsents[1].status === 'active',
        'New consent status is "active"'
      );
      assert(
        allConsents[1].signupFlow === 'renewed_acceptance',
        'New record identifies flow as "renewed_acceptance"'
      );
    }

    // ── Test 14: Data Rights Request: Export ──────────────────────────────────
    const resExport = await testApp.request('/api/auth/data-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ requestType: 'export' }),
    });
    const jsonExport = await resExport.json();
    assert(
      resExport.status === 200 && jsonExport.requestType === 'export',
      'POST /api/auth/data-request provides structured machine-readable export'
    );
    assert(
      jsonExport.data?.profile?.email === testEmail,
      'Export includes user profile without exposing password hashes'
    );
    assert(
      jsonExport.data?.profile?.passwordHash === undefined,
      'Password hash is strictly omitted from export payload'
    );

    // ── Test 15: Data Rights Request: Erasure Request (Pending Verification) ──
    const resDelete = await testApp.request('/api/auth/data-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ requestType: 'delete', notes: 'Automated test erasure' }),
    });
    const jsonDelete = await resDelete.json();
    assert(
      resDelete.status === 200 && jsonDelete.status === 'pending_verification',
      'Erasure request logs formal ticket and explains legal compliance verification'
    );
    assert(
      Boolean(jsonDelete.referenceId),
      'Erasure ticket provides unique reference ID'
    );
    assert(
      jsonDelete.requiresConfirmation === true,
      'Response clearly indicates that confirmation is required for execution'
    );

    // ── Test 16: Data Rights Request: Consent Withdrawal ───────────────────────
    const resWithdraw = await testApp.request('/api/auth/data-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ requestType: 'withdraw_consent' }),
    });
    const jsonWithdraw = await resWithdraw.json();
    assert(
      resWithdraw.status === 200 && jsonWithdraw.requestType === 'withdraw_consent',
      'Consent withdrawal processed successfully'
    );

    if (mongoose.connection.readyState === 1) {
      const activeConsentsAfterWithdraw = await LegalConsent.find({
        userId: createdUserId,
        status: 'active',
      });
      assert(
        activeConsentsAfterWithdraw.length === 0,
        'Active consent records transitioned away from "active"'
      );

      const revokedConsent = await LegalConsent.findOne({
        userId: createdUserId,
        status: 'revoked',
      });
      assert(
        Boolean(revokedConsent),
        'Consent record marked with status: "revoked"'
      );

      // Verify user account profile is NOT unexpectedly destroyed
      const userAfterWithdraw = await User.findById(createdUserId);
      assert(
        Boolean(userAfterWithdraw && userAfterWithdraw.email === testEmail),
        'User account profile is preserved following consent withdrawal'
      );
      assert(
        userAfterWithdraw?.termsAcceptedVersion === undefined,
        'User model cleared of active termsAcceptedVersion'
      );
    }

    // ── Test 17: Consent Status Reflects Revoked State ─────────────────────────
    const resRevokedStatus = await testApp.request('/api/auth/consent-status', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const jsonRevokedStatus = await resRevokedStatus.json();
    assert(
      resRevokedStatus.status === 200 && jsonRevokedStatus.consentStatus === 'revoked',
      'GET /api/auth/consent-status explicitly identifies consentStatus as "revoked"'
    );
    assert(
      jsonRevokedStatus.needsRenewedConsent === true,
      'User is prompted to re-affirm consent before using platform capabilities'
    );

    // ── Test 18: Account Reactivation via Renew Consent ───────────────────────
    const resReactivate = await testApp.request('/api/auth/renew-consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        agreedToTerms: true,
        acknowledgedPrivacyPolicy: true,
        termsVersion: CURRENT_LEGAL_VERSIONS.termsVersion,
        privacyVersion: CURRENT_LEGAL_VERSIONS.privacyVersion,
      }),
    });
    assert(
      resReactivate.status === 200,
      'User can seamlessly re-affirm consent and reactivate account without duplicate registration'
    );

    if (mongoose.connection.readyState === 1) {
      const activeConsentRestored = await LegalConsent.findOne({
        userId: createdUserId,
        status: 'active',
      });
      assert(
        Boolean(activeConsentRestored),
        'Active legal consent restored in database'
      );
    }

    // ── Test 19: Verified Safe Erasure with Explicit Confirmation ─────────────
    console.log('\n--- Suite G: Verified Safe Erasure with Retention Exceptions ---');
    if (mongoose.connection.readyState === 1) {
      // Seed test data: Task with files, SemanticCache, and Conversation
      await Task.create({
        userId: createdUserId,
        prompt: 'Screen this test resume',
        category: 'resume-screening',
        status: 'completed',
        plannerOutput: {
          files: [{ name: 'resume.pdf', content_base64: 'JVBERi0xLjQK...' }],
          extractedFiles: [{ name: 'resume.pdf', text: 'Candidate Sensitive Details' }],
        },
        output: { candidateName: 'John Doe', rating: 'High' },
      });

      await SemanticCache.create({
        userId: createdUserId,
        taskType: 'resume-screening',
        normalizedQuery: 'screen resume query',
        semanticContext: { parsedResume: 'John Doe' },
        sourceFingerprint: 'dummy_sha256_hash_123',
      });

      await Conversation.create({
        userId: createdUserId,
        title: 'Confidential Strategy Chat',
        thread: [{ role: 'user', content: 'Here is our confidential contract' }],
      });
    }

    const resVerifiedDelete = await testApp.request('/api/auth/data-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ requestType: 'delete', confirmed: true }),
    });
    const jsonVerifiedDelete = await resVerifiedDelete.json();
    assert(
      resVerifiedDelete.status === 200 && jsonVerifiedDelete.status === 'verified_deletion_completed',
      'Verified erasure executed when confirmed: true is submitted'
    );
    assert(
      jsonVerifiedDelete.auditSummary?.tasksScrubbed >= 1,
      'Audit summary reports uploaded files scrubbed from task records'
    );
    assert(
      jsonVerifiedDelete.auditSummary?.retainedUnderExemptions?.length > 0,
      'Audit summary transparently identifies records retained under legal exemptions'
    );

    if (mongoose.connection.readyState === 1) {
      // Verify files were scrubbed
      const tasksAfterDelete = await Task.find({ userId: createdUserId });
      for (const t of tasksAfterDelete) {
        assert(
          t.plannerOutput?.files === undefined,
          'Task record plannerOutput.files is permanently scrubbed'
        );
        assert(
          t.output === undefined,
          'Task record output is permanently scrubbed'
        );
      }

      // Verify caches were purged
      const cachesAfterDelete = await SemanticCache.find({ userId: createdUserId });
      assert(
        cachesAfterDelete.length === 0,
        'Semantic cache entries for the user were permanently purged'
      );

      // Verify conversations were purged
      const convsAfterDelete = await Conversation.find({ userId: createdUserId });
      assert(
        convsAfterDelete.length === 0,
        'Conversation records for the user were permanently purged'
      );

      // Verify sessions were terminated
      const sessionsAfterDelete = await UserSession.find({ userId: createdUserId });
      assert(
        sessionsAfterDelete.length === 0,
        'User sessions were permanently terminated'
      );

      // Verify audit log entry exists
      const erasureLog = await AuditLog.findOne({
        userId: createdUserId,
        action: 'Verified Account Erasure Executed',
      });
      assert(
        Boolean(erasureLog),
        'Audit log recorded verified account erasure execution'
      );
    }

    console.log('\n================================================================');
    console.log(`✅ ALL ${passedTests} OF ${totalTests} COMPLIANCE & CONSENT TESTS PASSED!`);
    console.log('================================================================\n');
  } finally {
    // Cleanup test accounts
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: { $regex: testRunId } }).catch(() => {});
      await LegalConsent.deleteMany({ userEmail: { $regex: testRunId } }).catch(() => {});
      await UserSession.deleteMany({}).catch(() => {});
      await mongoose.disconnect().catch(() => {});
    }
  }
}

runLegalConsentTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test Suite Aborted with Error:', err);
    process.exit(1);
  });
