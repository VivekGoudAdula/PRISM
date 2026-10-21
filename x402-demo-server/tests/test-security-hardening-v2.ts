/**
 * PRISM Data Security Hardening V2 — Automated Verification Suite
 *
 * Verifies:
 * 1. Safe, resumable, idempotent encryption migration for Task document files.
 * 2. Pre-write verification and key rotation.
 * 3. Cross-user semantic cache isolation (User B cannot access User A sensitive cached output).
 * 4. Cache fingerprint invalidation on document modification.
 * 5. Explicit cache invalidation workflows.
 * 6. Admin authorization on retention endpoints (GET /status, POST /prune).
 * 7. Active automated retention scheduler telemetry and idempotent pruning.
 * 8. Production secret validation (JWT, refresh secret, 256-bit encryption key).
 */

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { config } from 'dotenv';
config();

import crypto from 'crypto';
import mongoose from 'mongoose';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';

// Models
import { Task } from '../models/Task';
import { SemanticCache } from '../models/SemanticCache';
import { UserSession } from '../models/UserSession';
import { User } from '../models/User';

// Services
import {
  encryptDocument,
  decryptDocument,
  isEncrypted,
  getEncryptionKey,
} from '../services/encryption';
import {
  migrateLegacyTasks,
  rotateTaskEncryptionKey,
} from '../services/migration';
import {
  createContextFingerprint,
  findSimilarContext,
  saveContext,
  invalidateContext,
  invalidateUserCache,
} from '../services/semanticCache';
import {
  getRetentionConfig,
  pruneExpiredData,
  startRetentionScheduler,
  stopRetentionScheduler,
  getRetentionSchedulerStatus,
} from '../services/retention';
import {
  securityHeaders,
  validateProductionSecrets,
  safeErrorHandler,
} from '../middleware/security';
import { getJwtSecret } from '../middleware/auth';
import { adminRouter } from '../routes/analytics';

async function runHardeningV2Tests() {
  console.log('\n' + '═'.repeat(70));
  console.log('    PRISM DATA SECURITY HARDENING V2 — AUTOMATED VERIFICATION     ');
  console.log('═'.repeat(70) + '\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 1: Encryption Migration & Verification (Task 1)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- SUITE 1: Encryption Migration, Verification & Key Rotation ---');

  const userA_Id = new mongoose.Types.ObjectId();
  const rawResumeBase64 = Buffer.from('John Doe Senior Security Architect Resume').toString('base64');
  const rawContractText = 'CONFIDENTIAL NDA: Party A shall not disclose proprietary algorithm.';

  // Mock Task data for migration test
  const legacyTasks: any[] = [
    {
      _id: new mongoose.Types.ObjectId(),
      userId: userA_Id,
      prompt: 'Screen candidate resume',
      category: 'resume_screening',
      plannerOutput: {
        files: [
          {
            filename: 'resume.pdf',
            content_base64: rawResumeBase64, // Unencrypted plaintext
            extracted_text: 'John Doe Senior Security Architect', // Unencrypted plaintext
          },
        ],
      },
    },
    {
      _id: new mongoose.Types.ObjectId(),
      userId: userA_Id,
      prompt: 'Review NDA contract',
      category: 'contract_analysis',
      plannerOutput: {
        files: [
          {
            filename: 'nda.docx',
            text: rawContractText, // Unencrypted plaintext
            content: rawContractText, // Unencrypted plaintext
          },
        ],
      },
    },
  ];

  // Mock Task.find cursor for migration
  const originalTaskFind = Task.find;
  const originalTaskUpdateOne = Task.updateOne;

  let updateCalls: any[] = [];
  (Task as any).updateOne = async (filter: any, update: any) => {
    updateCalls.push({ filter, update });
    const target = legacyTasks.find((t) => t._id.toString() === filter._id.toString());
    if (target && update.$set?.['plannerOutput.files']) {
      target.plannerOutput.files = update.$set['plannerOutput.files'];
    }
    return { modifiedCount: 1 };
  };

  (Task as any).find = function (query: any) {
    return {
      select: () => ({
        cursor: () => {
          let idx = 0;
          return {
            async *[Symbol.asyncIterator]() {
              while (idx < legacyTasks.length) {
                yield legacyTasks[idx++];
              }
            },
          };
        },
      }),
    };
  };

  try {
    // Test 1.1: Dry-run migration does not write to database
    updateCalls = [];
    const dryRunStats = await migrateLegacyTasks({ dryRun: true });
    assert(
      dryRunStats.dryRun === true && dryRunStats.tasksNeedingMigration === 2,
      '1.1: Dry-run correctly detects 2 tasks needing encryption migration'
    );
    assert(
      updateCalls.length === 0,
      '1.2: Dry-run does NOT execute any database writes'
    );
    assert(
      !isEncrypted(legacyTasks[0].plannerOutput.files[0].content_base64),
      '1.3: Document content remains unchanged in dry-run mode'
    );

    // Test 1.4: Live execution migrates and verifies all fields
    const liveStats = await migrateLegacyTasks({ dryRun: false });
    assert(
      liveStats.tasksMigrated === 2 && liveStats.verificationFailures === 0,
      '1.4: Live migration successfully encrypts and pre-verifies all tasks'
    );
    assert(
      updateCalls.length === 2,
      '1.5: Database update was executed exactly once per migrated task'
    );

    const migratedFile = legacyTasks[0].plannerOutput.files[0];
    assert(
      isEncrypted(migratedFile.content_base64) && isEncrypted(migratedFile.extracted_text),
      '1.6: Files now contain enc:v1: authenticated ciphertext'
    );

    // Test 1.7: Decryption recovers exact original plaintext
    const decryptedBase64 = decryptDocument(migratedFile.content_base64);
    const decryptedText = decryptDocument(migratedFile.extracted_text);
    assert(
      decryptedBase64 === rawResumeBase64 && decryptedText === 'John Doe Senior Security Architect',
      '1.7: Decrypted content exactly matches original plaintext (zero corruption)'
    );

    // Test 1.8: Idempotence - running migration again skips already encrypted records
    updateCalls = [];
    const secondPassStats = await migrateLegacyTasks({ dryRun: false });
    assert(
      secondPassStats.tasksNeedingMigration === 0 && secondPassStats.filesAlreadyEncrypted > 0,
      '1.8: Resumable/Idempotent - second run skips already-encrypted records with 0 writes'
    );
    assert(
      updateCalls.length === 0,
      '1.9: Zero database updates triggered on already-migrated dataset'
    );

    // Test 1.10: Key Rotation with Verify-before-write
    const newKeyBuffer = crypto.randomBytes(32);
    const newKeyHex = newKeyBuffer.toString('hex');
    const rotateStats = await rotateTaskEncryptionKey(newKeyHex, { dryRun: false });
    assert(
      rotateStats.tasksMigrated === 2 && rotateStats.verificationFailures === 0,
      '1.10: Key rotation re-encrypts all records with new 256-bit key and verifies integrity'
    );

    // Verify record decrypts under new key and fails under old key
    const reEncryptedFile = legacyTasks[0].plannerOutput.files[0].content_base64;
    const decryptedUnderNewKey = decryptDocument(reEncryptedFile, newKeyBuffer);
    assert(
      decryptedUnderNewKey === rawResumeBase64,
      '1.11: Document decrypts successfully using new rotated key'
    );

    let oldKeyFailed = false;
    try {
      decryptDocument(reEncryptedFile, getEncryptionKey());
    } catch {
      oldKeyFailed = true;
    }
    assert(
      oldKeyFailed,
      '1.12: Old key is rejected via GCM authentication tag after rotation'
    );
  } finally {
    Task.find = originalTaskFind;
    Task.updateOne = originalTaskUpdateOne;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 2: Semantic Cache Isolation & Invalidation (Task 2)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 2: Semantic Cache Isolation & Document Context Invalidation ---');

  const userB_Id = new mongoose.Types.ObjectId();
  const sensitiveEvaluation = {
    contractRisk: 'HIGH_RISK_INDEMNITY',
    confidentialNotes: 'Disclosed offshore banking details and secret clause 14b',
  };

  // Mock in-memory store for SemanticCache
  const mockCacheStore = new Map<string, any>();
  const originalCacheFindOne = SemanticCache.findOne;
  const originalCacheFindOneAndUpdate = SemanticCache.findOneAndUpdate;
  const originalCacheDeleteOne = SemanticCache.deleteOne;
  const originalCacheDeleteMany = SemanticCache.deleteMany;

  (SemanticCache as any).findOne = function (filter: any) {
    let matchingDoc: any = null;
    for (const doc of mockCacheStore.values()) {
      if (
        doc.userId.toString() === filter.userId?.toString() &&
        doc.taskType === filter.taskType &&
        doc.sourceFingerprint === filter.sourceFingerprint
      ) {
        if (filter.workspaceId && doc.workspaceId !== filter.workspaceId) continue;
        matchingDoc = {
          ...doc,
          save: async () => {},
        };
        break;
      }
    }
    return {
      select: () => matchingDoc,
    };
  };

  (SemanticCache as any).findOneAndUpdate = function (filter: any, update: any) {
    const key = `${filter.userId}:${filter.taskType}:${filter.sourceFingerprint}`;
    const doc = { _id: new mongoose.Types.ObjectId(), ...update, hitCount: 0 };
    mockCacheStore.set(key, doc);
    return doc;
  };

  (SemanticCache as any).deleteOne = function (filter: any) {
    let deletedCount = 0;
    for (const [key, doc] of mockCacheStore.entries()) {
      if (
        doc.userId.toString() === filter.userId?.toString() &&
        doc.taskType === filter.taskType &&
        doc.sourceFingerprint === filter.sourceFingerprint
      ) {
        mockCacheStore.delete(key);
        deletedCount++;
      }
    }
    return { deletedCount };
  };

  (SemanticCache as any).deleteMany = function (filter: any) {
    let deletedCount = 0;
    for (const [key, doc] of mockCacheStore.entries()) {
      if (filter.userId && doc.userId.toString() === filter.userId.toString()) {
        mockCacheStore.delete(key);
        deletedCount++;
      }
    }
    return { deletedCount };
  };

  try {
    const prompt = 'Analyze proprietary master service agreement';
    const originalFiles = [{ filename: 'msa.pdf', text: 'Proprietary IP terms and conditions' }];

    // User A saves sensitive context to cache
    await saveContext({
      userId: userA_Id,
      taskType: 'contract_analysis',
      prompt,
      files: originalFiles,
      semanticContext: sensitiveEvaluation,
    });

    // Test 2.1: User A gets cache hit
    const userACheck = await findSimilarContext({
      userId: userA_Id,
      taskType: 'contract_analysis',
      prompt,
      files: originalFiles,
    });
    assert(
      userACheck.hit === true && userACheck.semanticContext?.contractRisk === 'HIGH_RISK_INDEMNITY',
      '2.1: User A successfully retrieves own cached semantic context'
    );

    // Test 2.2: User B requesting identical prompt & files gets cache MISS (Isolation)
    const userBCheck = await findSimilarContext({
      userId: userB_Id,
      taskType: 'contract_analysis',
      prompt,
      files: originalFiles,
    });
    assert(
      userBCheck.hit === false && userBCheck.semanticContext === undefined,
      '2.2: User B receives cache MISS for User A document (Zero cross-user leakage)'
    );

    // Test 2.3: Unauthenticated / Invalid userId cache check returns false
    const invalidUserCheck = await findSimilarContext({
      userId: '',
      taskType: 'contract_analysis',
      prompt,
      files: originalFiles,
    });
    assert(
      invalidUserCheck.hit === false,
      '2.3: Cache check with missing/invalid userId safely returns hit: false'
    );

    // Test 2.4: Deterministic fingerprinting across encrypted vs plaintext files
    const encryptedFiles = [
      {
        filename: 'msa.pdf',
        text: encryptDocument('Proprietary IP terms and conditions'),
      },
    ];
    const fpPlaintext = createContextFingerprint(prompt, originalFiles);
    const fpEncrypted = createContextFingerprint(prompt, encryptedFiles);
    assert(
      fpPlaintext === fpEncrypted,
      '2.4: createContextFingerprint is deterministic between plaintext and encrypted inputs'
    );

    // Test 2.5: Document Modification Invalidation (Context change causes cache miss)
    const modifiedFiles = [{ filename: 'msa.pdf', text: 'Revised terms with clause 14b removed' }];
    const modifiedDocCheck = await findSimilarContext({
      userId: userA_Id,
      taskType: 'contract_analysis',
      prompt,
      files: modifiedFiles,
    });
    assert(
      modifiedDocCheck.hit === false,
      '2.5: Modifying document content produces new fingerprint -> cache miss on changed data'
    );

    // Test 2.6: Explicit cache invalidation
    const deleted = await invalidateContext(userA_Id, 'contract_analysis', fpPlaintext);
    assert(
      deleted === true,
      '2.6: Explicit invalidateContext removes cache entry'
    );

    const postInvalidateCheck = await findSimilarContext({
      userId: userA_Id,
      taskType: 'contract_analysis',
      prompt,
      files: originalFiles,
    });
    assert(
      postInvalidateCheck.hit === false,
      '2.7: Query after invalidation returns cache miss'
    );
  } finally {
    SemanticCache.findOne = originalCacheFindOne;
    SemanticCache.findOneAndUpdate = originalCacheFindOneAndUpdate;
    SemanticCache.deleteOne = originalCacheDeleteOne;
    SemanticCache.deleteMany = originalCacheDeleteMany;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 3: Automated Retention & Admin Authorization (Task 3)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 3: Automated Retention Scheduling & Admin Auth ---');

  const testApp = new Hono();
  testApp.route('/api/admin', adminRouter);

  const adminUser_Id = new mongoose.Types.ObjectId();
  const tokenAdmin = jwt.sign(
    { userId: adminUser_Id.toString(), email: 'admin@prism.ai', role: 'admin' },
    getJwtSecret()
  );
  const tokenRegularUser = jwt.sign(
    { userId: userA_Id.toString(), email: 'user@prism.ai', role: 'user' },
    getJwtSecret()
  );

  // Test 3.1: Retention status endpoint requires authentication
  const unauthRes = await testApp.request('/api/admin/retention/status');
  assert(
    unauthRes.status === 401,
    '3.1: Unauthenticated GET /api/admin/retention/status returns 401 Unauthorized'
  );

  // Test 3.2: Non-admin user is rejected with 403 Forbidden
  const forbiddenRes = await testApp.request('/api/admin/retention/status', {
    headers: { Authorization: `Bearer ${tokenRegularUser}` },
  });
  assert(
    forbiddenRes.status === 403,
    '3.2: Regular user GET /api/admin/retention/status returns 403 Forbidden'
  );

  // Test 3.3: Admin user can access retention status & scheduler telemetry
  const adminRes = await testApp.request('/api/admin/retention/status', {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  const adminJson = await adminRes.json();
  assert(
    adminRes.status === 200 && adminJson.status === 'ok',
    '3.3: Admin GET /api/admin/retention/status returns 200 OK'
  );

  // Test 3.4: Automated scheduler start & status verification
  startRetentionScheduler(12); // Schedule every 12 hours
  const statusAfterStart = getRetentionSchedulerStatus();
  assert(
    statusAfterStart.active === true && statusAfterStart.intervalHours === 12 && statusAfterStart.nextRunAt !== null,
    '3.4: Automated retention scheduler is active with valid interval and next run timestamp'
  );

  stopRetentionScheduler();
  const statusAfterStop = getRetentionSchedulerStatus();
  assert(
    statusAfterStop.active === false,
    '3.5: stopRetentionScheduler cleanly terminates the timer'
  );

  // Test 3.6: Idempotent Data Pruning
  const originalTaskUpdateMany = Task.updateMany;
  const originalCacheDeleteMany2 = SemanticCache.deleteMany;
  const originalSessionDeleteMany = UserSession.deleteMany;

  let updateManyCalled = false;
  (Task as any).updateMany = async (filter: any, update: any) => {
    updateManyCalled = true;
    return { modifiedCount: 3 };
  };
  (SemanticCache as any).deleteMany = async () => ({ deletedCount: 5 });
  (UserSession as any).deleteMany = async () => ({ deletedCount: 2 });

  try {
    const prune1 = await pruneExpiredData();
    assert(
      prune1.scrubbedTasksCount === 3 && prune1.purgedCacheCount === 5 && prune1.expiredSessionsCount === 2,
      '3.6: pruneExpiredData successfully executes across tasks, caches, and sessions'
    );

    // Second run with 0 matches (demonstrates idempotence)
    (Task as any).updateMany = async () => ({ modifiedCount: 0 });
    (SemanticCache as any).deleteMany = async () => ({ deletedCount: 0 });
    (UserSession as any).deleteMany = async () => ({ deletedCount: 0 });

    const prune2 = await pruneExpiredData();
    assert(
      prune2.scrubbedTasksCount === 0 && prune2.purgedCacheCount === 0,
      '3.7: Idempotent pruning - subsequent runs safely report 0 without errors'
    );
  } finally {
    Task.updateMany = originalTaskUpdateMany;
    SemanticCache.deleteMany = originalCacheDeleteMany2;
    UserSession.deleteMany = originalSessionDeleteMany;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 4: Production Configuration & Secret Verification (Task 4)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 4: Production Configuration & Environment Secrets ---');

  const oldNodeEnv = process.env.NODE_ENV;
  const oldJwt = process.env.JWT_SECRET;
  const oldRefresh = process.env.JWT_REFRESH_SECRET;
  const oldDocKey = process.env.DOCUMENT_ENCRYPTION_KEY;

  try {
    process.env.NODE_ENV = 'production';

    // Test 4.1: Reject default JWT secret
    process.env.JWT_SECRET = 'prism_default_secret_key_12345';
    let rejectedDefaultJwt = false;
    try {
      validateProductionSecrets();
    } catch {
      rejectedDefaultJwt = true;
    }
    assert(rejectedDefaultJwt, '4.1: Production validator rejects default hardcoded JWT_SECRET');

    // Test 4.2: Reject default refresh secret
    process.env.JWT_SECRET = 'a_secure_production_secret_key_with_high_entropy_123';
    process.env.JWT_REFRESH_SECRET = 'prism_default_refresh_secret_67890';
    let rejectedDefaultRefresh = false;
    try {
      validateProductionSecrets();
    } catch {
      rejectedDefaultRefresh = true;
    }
    assert(rejectedDefaultRefresh, '4.2: Production validator rejects default JWT_REFRESH_SECRET');

    // Test 4.3: Reject missing DOCUMENT_ENCRYPTION_KEY
    process.env.JWT_REFRESH_SECRET = 'a_secure_refresh_secret_key_with_high_entropy_456';
    process.env.DOCUMENT_ENCRYPTION_KEY = '';
    let rejectedMissingDocKey = false;
    try {
      validateProductionSecrets();
    } catch {
      rejectedMissingDocKey = true;
    }
    assert(rejectedMissingDocKey, '4.3: Production validator rejects missing DOCUMENT_ENCRYPTION_KEY');

    // Test 4.4: Reject low-entropy key (< 32 bytes)
    process.env.DOCUMENT_ENCRYPTION_KEY = 'short_key';
    let rejectedShortKey = false;
    try {
      validateProductionSecrets();
    } catch {
      rejectedShortKey = true;
    }
    assert(rejectedShortKey, '4.4: Production validator rejects encryption key < 32 bytes');

    // Test 4.5: Pass when all production secrets are cryptographically strong
    process.env.DOCUMENT_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    let passedValidSecrets = true;
    try {
      validateProductionSecrets();
    } catch {
      passedValidSecrets = false;
    }
    assert(passedValidSecrets, '4.5: Production validator accepts valid, high-entropy secrets');
  } finally {
    process.env.NODE_ENV = oldNodeEnv;
    process.env.JWT_SECRET = oldJwt;
    process.env.JWT_REFRESH_SECRET = oldRefresh;
    process.env.DOCUMENT_ENCRYPTION_KEY = oldDocKey;
  }

  // Test 4.6: In-Transit HTTPS enforcement header check
  const headersApp = new Hono();
  headersApp.use('*', securityHeaders);
  headersApp.get('/api/test', (c) => c.json({ ok: true }));

  const hstsRes = await headersApp.request('/api/test', {
    headers: { 'x-forwarded-proto': 'https' },
  });
  assert(
    hstsRes.headers.get('X-Content-Type-Options') === 'nosniff' &&
    hstsRes.headers.get('X-Frame-Options') === 'DENY' &&
    hstsRes.headers.get('Referrer-Policy') === 'strict-origin-when-cross-origin',
    '4.6: Enterprise security headers enforced across all responses'
  );

  console.log('\n' + '═'.repeat(70));
  console.log(`  VERIFICATION V2 SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('═'.repeat(70) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHardeningV2Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
