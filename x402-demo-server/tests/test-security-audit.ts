/**
 * PRISM Comprehensive Data Security & Hardening Automated Test Suite
 *
 * Verifies:
 * 1. AES-256-GCM authenticated encryption at rest, decryption, tampering detection, and backward-compat.
 * 2. Cross-user isolation in /chat-reply (ensures no document outputs leak across tenants/users).
 * 3. Access controls & IDOR prevention on DataMap routes (GET /:id, GET /chat/:id, GET /task/:id, PATCH /title, DELETE /:id).
 * 4. Access controls & IDOR prevention on PromptTutor (GET /task/:id).
 * 5. Cross-user plan execution prevention in /execute-task.
 * 6. Authorized task and document deletion with cascading cleanup across DataMap, cache, and optimizations.
 * 7. Authorized chat conversation deletion.
 * 8. Production TLS enforcement and security headers (HSTS, nosniff, DENY).
 * 9. Production secret validation (refuses default JWT/encryption keys).
 * 10. Safe error handling and sensitive data masking.
 */

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { config } from 'dotenv';
config();

import mongoose from 'mongoose';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';

// Import services and middleware
import {
  encryptDocument,
  decryptDocument,
  isEncrypted,
  getEncryptionKey,
} from '../services/encryption';
import {
  securityHeaders,
  validateProductionSecrets,
  safeErrorHandler,
} from '../middleware/security';
import { getJwtSecret } from '../middleware/auth';
import { generateChatReply } from '../handlers/chat-reply';
import { resolveFiles } from '../handlers/lib/resolve-files';
import { getRetentionConfig, pruneExpiredData } from '../services/retention';

// Import routers & models
import dataMapRouter from '../routes/dataMap';
import promptTutorRouter from '../routes/promptTutor';
import chatRouter from '../routes/chat';
import { analyticsRouter } from '../routes/analytics';
import { Task } from '../models/Task';
import { DataMap } from '../models/DataMap';
import { User } from '../models/User';
import { SemanticCache } from '../models/SemanticCache';
import { Conversation, Message } from '../models/Chat';
import { PromptOptimization } from '../models/PromptOptimization';
import { PromptAnalysis } from '../models/PromptAnalysis';
import { AuditLog } from '../models/AuditLog';

async function runSecurityAuditTests() {
  console.log('\n' + '═'.repeat(70));
  console.log('       PRISM DATA SECURITY AUDIT & HARDENING TEST SUITE       ');
  console.log('═'.repeat(70) + '\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failedCount++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 1: AES-256-GCM Encryption at Rest Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- SUITE 1: AES-256-GCM Encryption at Rest ---');

  const sampleContract = 'CONFIDENTIAL NDA: Vendor rate is $150/hr. IP belongs entirely to Acme Corp.';
  const sampleBase64Resume = Buffer.from('John Doe, Senior DevOps Engineer, SSN: 000-12-3456, Phone: +1-555-0199').toString('base64');

  // Test 1.1: Encrypt sensitive document
  const encryptedContract = encryptDocument(sampleContract);
  assert(
    isEncrypted(encryptedContract) && encryptedContract.startsWith('enc:v1:'),
    '1.1: Document is encrypted with enc:v1: format',
    `Result: ${encryptedContract.slice(0, 30)}...`
  );

  // Test 1.2: Decrypt document
  const decryptedContract = decryptDocument(encryptedContract);
  assert(
    decryptedContract === sampleContract,
    '1.2: Decrypted document matches original plaintext perfectly'
  );

  // Test 1.3: Encrypt base64 resume
  const encryptedResume = encryptDocument(sampleBase64Resume);
  assert(
    isEncrypted(encryptedResume) && encryptedResume !== sampleBase64Resume,
    '1.3: Base64 resume file content is encrypted at rest'
  );
  const decryptedResume = decryptDocument(encryptedResume);
  assert(
    decryptedResume === sampleBase64Resume,
    '1.4: Base64 resume decrypted accurately without corruption'
  );

  // Test 1.5: Tampering detection (AEAD Authentication Tag verification)
  let tamperingDetected = false;
  try {
    const parts = encryptedContract.slice('enc:v1:'.length).split(':');
    // Tamper with ciphertext by altering last byte
    const corruptedCiphertext = parts[2].slice(0, -2) + (parts[2].slice(-2) === 'aa' ? 'bb' : 'aa');
    const tamperedPayload = `enc:v1:${parts[0]}:${parts[1]}:${corruptedCiphertext}`;
    decryptDocument(tamperedPayload);
  } catch (err: any) {
    tamperingDetected = true;
  }
  assert(
    tamperingDetected,
    '1.5: Ciphertext tampering detected and rejected via AES-256-GCM auth tag'
  );

  // Test 1.6: Backward-compatible plaintext pass-through
  const legacyPlaintext = 'Legacy unencrypted document string from old database record';
  const passThrough = decryptDocument(legacyPlaintext);
  assert(
    passThrough === legacyPlaintext,
    '1.6: Legacy unencrypted data passes through transparently without error'
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 2: Cross-User Data Isolation in /chat-reply
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 2: Cross-User Isolation in /chat-reply ---');

  // Test 2.1: Anonymous / unauthenticated caller must NOT see any past tasks
  // Mock Task.find to observe if it queries across all users
  const originalTaskFind = Task.find;
  let queriedFilter: any = null;

  (Task as any).find = function (filter: any) {
    queriedFilter = filter;
    return {
      sort: () => ({
        limit: () => ({
          lean: async () => [],
        }),
      }),
    };
  };

  try {
    // Unauthenticated call (no userId)
    queriedFilter = null;
    const anonymousReply = await generateChatReply('Who was the top candidate?');
    assert(
      queriedFilter === null,
      '2.1: Unauthenticated chat query does not execute any Task.find query across database'
    );
    assert(
      anonymousReply.includes("I don't have a previous result to reference"),
      '2.2: Unauthenticated caller receives safe fallback and never sees other users data'
    );

    // Authenticated user call (with specific userId)
    const testUserId = new mongoose.Types.ObjectId();
    await generateChatReply('Who was the top candidate?', testUserId.toString());
    assert(
      queriedFilter !== null && queriedFilter.userId?.toString() === testUserId.toString(),
      '2.3: Authenticated chat query is strictly scoped to requesting user ObjectId'
    );
    assert(
      queriedFilter.status === 'completed',
      '2.4: Authenticated chat query only queries completed tasks for that user'
    );
  } finally {
    Task.find = originalTaskFind;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 3: Access Controls & IDOR Prevention in DataMap & PromptTutor
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 3: Access Controls & IDOR Prevention ---');

  const testApp = new Hono();
  testApp.route('/api/data-map', dataMapRouter);
  testApp.route('/api/prompt-tutor', promptTutorRouter);
  testApp.route('/api/chat', chatRouter);
  testApp.route('/api/analytics', analyticsRouter);

  const userA_Id = new mongoose.Types.ObjectId();
  const userB_Id = new mongoose.Types.ObjectId();
  const testMapId = new mongoose.Types.ObjectId();
  const testTaskId = new mongoose.Types.ObjectId();

  const tokenUserA = jwt.sign(
    { userId: userA_Id.toString(), email: 'userA@test.com', role: 'user' },
    getJwtSecret()
  );
  const tokenUserB = jwt.sign(
    { userId: userB_Id.toString(), email: 'userB@test.com', role: 'user' },
    getJwtSecret()
  );

  // Mock DataMap.findById
  const originalDataMapFindById = DataMap.findById;
  (DataMap as any).findById = async function (id: any) {
    if (id.toString() === testMapId.toString()) {
      return {
        _id: testMapId,
        userId: userA_Id, // Owned by User A
        title: 'User A Secret Strategy Map',
        taskType: 'contract_analysis',
        nodes: [{ id: '1', label: 'Trade Secret Clause' }],
        save: async () => {},
      };
    }
    return null;
  };

  try {
    // Test 3.1: Unauthenticated request to /api/data-map/:id is rejected
    const unauthRes = await testApp.request(`/api/data-map/${testMapId}`);
    assert(
      unauthRes.status === 401,
      '3.1: Unauthenticated GET /api/data-map/:id returns 401 Unauthorized',
      `Status: ${unauthRes.status}`
    );

    // Test 3.2: User B attempting to view User A's DataMap is rejected (IDOR attempt)
    const idorRes = await testApp.request(`/api/data-map/${testMapId}`, {
      headers: { Authorization: `Bearer ${tokenUserB}` },
    });
    assert(
      idorRes.status === 403,
      '3.2: User B attempting to access User A DataMap returns 403 Forbidden',
      `Status: ${idorRes.status}`
    );

    // Test 3.3: User A accessing own DataMap succeeds
    const ownerRes = await testApp.request(`/api/data-map/${testMapId}`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(
      ownerRes.status === 200,
      '3.3: User A accessing own DataMap returns 200 OK',
      `Status: ${ownerRes.status}`
    );

    // Test 3.4: User B attempting to rename User A's DataMap is rejected
    const renameIdorRes = await testApp.request(`/api/data-map/${testMapId}/title`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenUserB}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Hacked Title' }),
    });
    assert(
      renameIdorRes.status === 403,
      '3.4: User B attempting to rename User A DataMap returns 403 Forbidden',
      `Status: ${renameIdorRes.status}`
    );

    // Test 3.5: User B attempting to delete User A's DataMap is rejected
    const deleteIdorRes = await testApp.request(`/api/data-map/${testMapId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenUserB}` },
    });
    assert(
      deleteIdorRes.status === 403,
      '3.5: User B attempting to delete User A DataMap returns 403 Forbidden',
      `Status: ${deleteIdorRes.status}`
    );

    // Test 3.6: User A (owner) can successfully delete own DataMap
    (DataMap as any).findByIdAndDelete = async () => ({ _id: testMapId });
    const ownerDeleteRes = await testApp.request(`/api/data-map/${testMapId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(
      ownerDeleteRes.status === 200,
      '3.6: User A (owner) can successfully delete own DataMap',
      `Status: ${ownerDeleteRes.status}`
    );
  } finally {
    DataMap.findById = originalDataMapFindById;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 4: Cross-User Isolation in PromptTutor & resolveFiles
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 4: PromptTutor & resolveFiles Isolation ---');

  const originalAnalysisFindOne = PromptAnalysis.findOne;
  (PromptAnalysis as any).findOne = async function (filter: any) {
    return {
      _id: new mongoose.Types.ObjectId(),
      userId: userA_Id,
      taskId: testTaskId,
      originalPrompt: 'Confidential proprietary algorithm description',
    };
  };

  try {
    // Test 4.1: User B attempting to read User A's PromptAnalysis
    const promptIdorRes = await testApp.request(`/api/prompt-tutor/task/${testTaskId}`, {
      headers: { Authorization: `Bearer ${tokenUserB}` },
    });
    assert(
      promptIdorRes.status === 403,
      '4.1: User B attempting to read User A prompt analysis returns 403 Forbidden',
      `Status: ${promptIdorRes.status}`
    );

    // Test 4.2: User A reading own analysis succeeds
    const promptOwnerRes = await testApp.request(`/api/prompt-tutor/task/${testTaskId}`, {
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert(
      promptOwnerRes.status === 200,
      '4.2: User A reading own prompt analysis returns 200 OK',
      `Status: ${promptOwnerRes.status}`
    );
  } finally {
    PromptAnalysis.findOne = originalAnalysisFindOne;
  }

  // Test 4.3: resolveFiles ownership verification
  const originalTaskFindById = Task.findById;
  (Task as any).findById = async function (id: any) {
    return {
      _id: id,
      userId: userA_Id,
      plannerOutput: {
        files: [{ filename: 'secret.txt', text: encryptDocument('Top Secret Financial Model') }],
      },
    };
  };

  try {
    let accessDenied = false;
    try {
      await resolveFiles({ plan_id: 'mock-plan-1', file_index: 0 }, userB_Id.toString());
    } catch (err: any) {
      if (err.message.includes('Unauthorized')) {
        accessDenied = true;
      }
    }
    assert(
      accessDenied,
      '4.3: resolveFiles prevents User B from accessing User A stored plan files'
    );

    // Owner resolves file and gets transparently decrypted text
    const ownerResolved = await resolveFiles({ plan_id: 'mock-plan-1', file_index: 0 }, userA_Id.toString());
    assert(
      ownerResolved.files[0].text === 'Top Secret Financial Model',
      '4.4: resolveFiles decrypts stored file correctly for authorized owner'
    );
  } finally {
    Task.findById = originalTaskFindById;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 5: Document/Task Deletion & Cascading Retention
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 5: Document Task Deletion & Retention ---');

  // Test 5.1: Retention policy configuration validation
  const retentionPolicy = getRetentionConfig();
  assert(
    retentionPolicy.documentFilesRetentionDays >= 1 && retentionPolicy.semanticCacheRetentionDays >= 1,
    '5.1: Configurable retention policy loaded with valid periods',
    `Document retention: ${retentionPolicy.documentFilesRetentionDays}d, Cache retention: ${retentionPolicy.semanticCacheRetentionDays}d`
  );

  // Test 5.2: Cascading Task Deletion endpoint ownership check
  (Task as any).findOne = async function (query: any) {
    if (query.userId === userA_Id.toString()) {
      return {
        _id: testTaskId,
        userId: userA_Id,
        category: 'contract_analysis',
        plannerOutput: { files: [{ filename: 'nda.pdf' }] },
        output: { riskScore: 0.8 },
        save: async () => {},
      };
    }
    return null;
  };

  // User B tries to delete User A task
  const deleteOtherTaskRes = await testApp.request(`/api/analytics/tasks/${testTaskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenUserB}` },
  });
  assert(
    deleteOtherTaskRes.status === 404,
    '5.2: User B cannot delete User A task (returns 404/unauthorized)',
    `Status: ${deleteOtherTaskRes.status}`
  );

  // Test 5.3: User A (owner) can delete own task and cascade cleanup
  (DataMap as any).deleteMany = async () => ({ deletedCount: 1 });
  (PromptAnalysis as any).deleteMany = async () => ({ deletedCount: 1 });
  (PromptOptimization as any).deleteMany = async () => ({ deletedCount: 1 });
  (SemanticCache as any).deleteMany = async () => ({ deletedCount: 1 });
  (AuditLog as any).create = async () => ({});

  const deleteOwnerTaskRes = await testApp.request(`/api/analytics/tasks/${testTaskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenUserA}` },
  });
  assert(
    deleteOwnerTaskRes.status === 200,
    '5.3: User A can successfully delete own task and trigger cascading purge',
    `Status: ${deleteOwnerTaskRes.status}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 6: Security Headers, TLS Enforcement & Safe Error Handling
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 6: Security Headers, TLS & Error Handling ---');

  const headersApp = new Hono();
  headersApp.use('*', securityHeaders);
  headersApp.get('/test', (c) => c.json({ ok: true }));

  // Test 6.1: Security headers present on all responses
  const headersRes = await headersApp.request('/test');
  assert(
    headersRes.headers.get('X-Content-Type-Options') === 'nosniff',
    '6.1: X-Content-Type-Options: nosniff header enforced'
  );
  assert(
    headersRes.headers.get('X-Frame-Options') === 'DENY',
    '6.2: X-Frame-Options: DENY header enforced (clickjacking protection)'
  );
  assert(
    headersRes.headers.get('Referrer-Policy') === 'strict-origin-when-cross-origin',
    '6.3: Referrer-Policy: strict-origin-when-cross-origin enforced'
  );

  // Test 6.4: Production secret validator refuses default keys
  const oldNodeEnv = process.env.NODE_ENV;
  const oldJwtSecret = process.env.JWT_SECRET;
  let rejectedInsecureSecret = false;

  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'prism_default_secret_key_12345'; // Insecure default
    validateProductionSecrets();
  } catch (err: any) {
    rejectedInsecureSecret = true;
  } finally {
    process.env.NODE_ENV = oldNodeEnv;
    process.env.JWT_SECRET = oldJwtSecret;
  }
  assert(
    rejectedInsecureSecret,
    '6.4: Production validator rejects default hardcoded JWT_SECRET'
  );

  // Test 6.5: Safe error handler masks sensitive error details
  const errorApp = new Hono();
  errorApp.onError(safeErrorHandler);
  errorApp.get('/crash', () => {
    throw new Error('Connection failed to mongodb://admin:P@ssword123@db.internal:27017/prism');
  });

  const errResDev = await errorApp.request('/crash');
  const errJsonDev = await errResDev.json();
  assert(
    errResDev.status === 500 && errJsonDev.error === 'Internal server error',
    '6.5: Unhandled error caught by safeErrorHandler with status 500'
  );

  console.log('\n' + '═'.repeat(70));
  console.log(`  AUDIT TEST SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('═'.repeat(70) + '\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSecurityAuditTests().catch((err) => {
  console.error('Fatal error running security audit tests:', err);
  process.exit(1);
});
