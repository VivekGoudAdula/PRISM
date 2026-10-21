/**
 * X402 Hackathon Starter Kit - Main Server (PRISM Backend AI Engine v1.0.2 - Render Deployment)
 *
 * This server demonstrates how to build payment-protected API endpoints
 * using the x402 protocol on Algorand TestNet.
 *
 * TEAM QUICK START:
 * 1. Import handlers from ./handlers/ directory
 * 2. Enable endpoints in endpoints.config.ts
 * 3. Register routes below
 * 4. Start server: npm start
 * 5. Test: curl http://localhost:4021/your-endpoint
 */
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { paymentMiddleware } from '@x402/hono';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import { ALGORAND_MAINNET_CAIP2, ALGORAND_TESTNET_CAIP2 } from '@x402/avm';
import mongoose from 'mongoose';

// Import handler functions
import { handleAnalyticsRequest, handleAnalyticsReportRequest } from './handlers/analytics';
import { handleAIAnalysisRequest, handleAIAnalysisBatchRequest } from './handlers/ai-analysis';
import { handleCreatorContentRequest, handleCreatorContentListRequest, handleCreatorPublishRequest, handleCreatorEarningsRequest } from './handlers/creator-content';
import { handleResumeScreenFastRequest } from './handlers/resume-screen-fast';
import { handleResumeScreenAccurateRequest } from './handlers/resume-screen-accurate';
import { handleContractAnalyzeFastRequest } from './handlers/contract-analyze-fast';
import { handleContractAnalyzeAccurateRequest } from './handlers/contract-analyze-accurate';
import { handleInvoiceExtractFastRequest } from './handlers/invoice-extract-fast';
import { handleInvoiceExtractAccurateRequest } from './handlers/invoice-extract-accurate';
import { handleCodeReviewFastRequest } from './handlers/code-review-fast';
import { handleCodeReviewAccurateRequest } from './handlers/code-review-accurate';
import { handleSeoAuditFastRequest } from './handlers/seo-audit-fast';
import { handleSeoAuditAccurateRequest } from './handlers/seo-audit-accurate';
import { handleClaimExtractFastRequest } from './handlers/claim-extract-fast';
import { handleClaimExtractAccurateRequest } from './handlers/claim-extract-accurate';
import { handleClaimVerifyFastRequest } from './handlers/claim-verify-fast';
import { handleClaimVerifyAccurateRequest } from './handlers/claim-verify-accurate';
import { handleSourceCompareFastRequest } from './handlers/source-compare-fast';
import { handleSourceCompareAccurateRequest } from './handlers/source-compare-accurate';
import { handleNewsResearchFastRequest } from './handlers/news-research-fast';
import { handleNewsResearchAccurateRequest } from './handlers/news-research-accurate';
import { handleRunTaskRequest } from './handlers/run-task';
import { handlePlanTaskRequest } from './handlers/plan-task';
import { handleExecuteTaskRequest } from './handlers/execute-task';
import { handleClassifyTaskRequest } from './handlers/classify-task';
import { handleSelectEndpointRequest } from './handlers/select-endpoint';
import { handleChatReplyRequest } from './handlers/chat-reply';
import { handleSavingsSummaryRequest } from './handlers/savings-summary';

import { bazaarResourceServerExtension } from '@x402-avm/extensions';
import type { ResourceServerExtension } from '@x402/core/types';
import createPaymentConfig, { EndpointConfig, NETWORK_CONFIG, NETWORK_MODE } from './endpoints.config';
import { getCanonicalResourceUrl } from './endpoints.registry';

// Import Middlewares and Routers
import { requestLogger, rateLimiter, errorMiddleware } from './middleware/common';
import { securityHeaders, validateProductionSecrets, safeErrorHandler } from './middleware/security';
import { initializeGroqService } from './services/groq';
import { requireAuth, optionalAuth } from './middleware/auth';
import authRouter from './routes/auth';
import chatRouter from './routes/chat';
import waitlistRouter from './routes/waitlist';
import semanticCacheRouter from './routes/semanticCache';
import { analyticsRouter, adminRouter } from './routes/analytics';
import promptTutorRouter from './routes/promptTutor';
import dataMapRouter from './routes/dataMap';
import promptOptimizerRouter from './routes/promptOptimizer';
import legalRouter from './routes/legal';

// Load environment variables
config();

// Enforce production security hygiene (reject default/missing secrets)
validateProductionSecrets();

import bcrypt from 'bcryptjs';
import { User } from './models/User';
import { Organization } from './models/Organization';

// Connect to MongoDB
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
  if (mongoUri.endsWith('/')) {
    connectionString = mongoUri + mongoDbName;
  } else {
    connectionString = mongoUri + '/' + mongoDbName;
  }
}

console.log(`Connecting to MongoDB at: ${connectionString.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`); // Hide credentials in log
mongoose.connect(connectionString)
  .then(async () => {
    console.log('✅ MongoDB connected successfully');
    
    // Seed B2B Organizations & Admin User
    try {
      const defaultOrgs = [
        { name: 'Nirvaha Wellness', code: 'NIRVAHA', contactPerson: 'Abhinav Rao', contactEmail: 'abhinav@nirvahawellness.com', industry: 'Healthcare & Wellness' },
        { name: 'Aurora University', code: 'AURORA', contactPerson: 'Placement Coordinator', contactEmail: 'placement@aurora.edu', industry: 'Education' },
        { name: 'Acme Enterprise', code: 'ACME', contactPerson: 'Jane Doe', contactEmail: 'jane@acme.com', industry: 'Software & Cloud' },
        { name: 'PRISM Labs', code: 'PRISM', contactPerson: 'System Admin', contactEmail: 'admin@prism.com', industry: 'AI & Infrastructure' },
      ];

      for (const orgData of defaultOrgs) {
        await Organization.findOneAndUpdate(
          { name: orgData.name },
          { $setOnInsert: orgData },
          { upsert: true, new: true }
        );
      }

      const prismOrg = await Organization.findOne({ name: 'PRISM Labs' });
      const nirvahaOrg = await Organization.findOne({ name: 'Nirvaha Wellness' });

      const adminEmail = 'admin@prism.com';
      const existingAdmin = await User.findOne({ email: adminEmail });
      if (!existingAdmin) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('Admin@123!', salt);
        await User.create({
          fullName: 'System Admin',
          email: adminEmail,
          passwordHash,
          role: 'admin',
          subscriptionPlan: 'enterprise',
          organizationId: prismOrg?._id,
          organizationName: prismOrg?.name || 'PRISM Labs',
          credits: 999999,
        });
        console.log('✅ Default Admin user seeded successfully');
      }

      // Link any users without organization to an organization
      const usersWithoutOrg = await User.find({ $or: [{ organizationName: { $exists: false } }, { organizationName: '' }, { organizationName: 'Individual / Default Org' }] });
      for (const user of usersWithoutOrg) {
        const targetOrg = user.email.includes('aurora') ? await Organization.findOne({ name: 'Aurora University' })
          : user.email.includes('nirvaha') ? nirvahaOrg
          : nirvahaOrg;
        if (targetOrg) {
          user.organizationId = targetOrg._id;
          user.organizationName = targetOrg.name;
          await user.save();
        }
      }
    } catch (err) {
      console.error('Error seeding admin/organizations:', err);
    }
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ════════════════════════════════════════════════════════════════════
// CONFIGURATION & SETUP
// ════════════════════════════════════════════════════════════════════


const avmAddress = process.env.AVM_ADDRESS;
const facilitatorUrl = process.env.FACILITATOR_URL;
const port = parseInt(process.env.PORT || '4021', 10);

// Validate required environment
if (!avmAddress || !facilitatorUrl) {
  console.error(
    '❌ Missing required environment variables:\n' +
    '   - AVM_ADDRESS (your Algorand wallet receiving payments)\n' +
    '   - FACILITATOR_URL (x402 facilitator service)'
  );
  process.exit(1);
}

console.log('\n' + '═'.repeat(60));
console.log('x402 HACKATHON STARTER KIT');
console.log('═'.repeat(60));
console.log('Configuration:');
console.log(`  NETWORK MODE: ${NETWORK_CONFIG.name}`);
console.log(`  CAIP-2 Network: ${NETWORK_CONFIG.caip2}`);
console.log(`  USDC Asset ID: ${NETWORK_CONFIG.usdcAssetId}`);
console.log(`  PayTo Address: ${avmAddress}`);
console.log(`  Facilitator: ${facilitatorUrl}`);
console.log(`  Port: ${port}`);
console.log('═'.repeat(60));
console.log('\n' + '█'.repeat(60));
console.log(`███  NETWORK MODE: ${NETWORK_CONFIG.name}  ███`);
console.log(`███  PayTo: ${avmAddress}  ███`);
console.log(`███  Asset ID: ${NETWORK_CONFIG.usdcAssetId}  ███`);
console.log('█'.repeat(60) + '\n');

// Initialize x402 Resource Server & Register Bazaar Discovery Extension
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const x402Server = new x402ResourceServer(facilitatorClient);
x402Server.registerExtension(bazaarResourceServerExtension as unknown as ResourceServerExtension);

// Register payment scheme for both Mainnet and TestNet networks
const avmServerScheme = new ExactAvmScheme();
x402Server.register(ALGORAND_MAINNET_CAIP2, avmServerScheme);
x402Server.register(ALGORAND_TESTNET_CAIP2, avmServerScheme);

// Add x402 Debug Logging Hooks
x402Server.onBeforeVerify(async (context) => {
  const reqPath = (context.transportContext as any)?.request?.path || (context.transportContext as any)?.request?.routePattern || '';
  const canonicalResourceUrl = context.paymentPayload?.resource?.url || getCanonicalResourceUrl(reqPath);
  let endpointPath = reqPath;
  try {
    endpointPath = new URL(canonicalResourceUrl).pathname;
  } catch {
    endpointPath = reqPath;
  }
  const resourceId = endpointPath.replace(/^\//, '');
  const rawAmount = context.requirements.amount;
  const paymentAmount = parseFloat((Number(rawAmount) / 1e6).toFixed(4));

  console.log('[x402 DIAGNOSTIC VERIFY]', {
    endpointPath,
    canonicalResourceUrl,
    resourceId,
    transactionId: 'verifying',
    paymentAmount,
  });
});

x402Server.onAfterSettle(async (context) => {
  const reqPath = (context.transportContext as any)?.request?.path || (context.transportContext as any)?.request?.routePattern || '';
  const canonicalResourceUrl = context.paymentPayload?.resource?.url || getCanonicalResourceUrl(reqPath);
  let endpointPath = reqPath;
  try {
    endpointPath = new URL(canonicalResourceUrl).pathname;
  } catch {
    endpointPath = reqPath;
  }
  const resourceId = endpointPath.replace(/^\//, '');
  const transactionId = context.result.transaction || 'unknown';
  const rawAmount = context.result.amount || context.requirements.amount;
  const paymentAmount = parseFloat((Number(rawAmount) / 1e6).toFixed(4));

  console.log('[x402 DIAGNOSTIC SETTLED]', {
    network: NETWORK_CONFIG.name,
    endpointPath,
    canonicalResourceUrl,
    resourceId,
    transactionId,
    paymentAmount,
  });
});

// Create Hono app
const app = new Hono();

// ════════════════════════════════════════════════════════════════════
// MIDDLEWARE STACK
// ════════════════════════════════════════════════════════════════════

/**
 * CORS Middleware - MUST be first!
 *
 * Handles browser preflight requests and exposes payment headers
 * x402 requires wildcard CORS to expose Payment-Signature headers
 */
app.use('*', async (c, next) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers': '*', // Critical for x402
    'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, Payment-Required, Payment-Response, X-Payment-Response, *', // Critical for x402 & x402 Doctor
    'Access-Control-Max-Age': '86400',
  };

  // Handle OPTIONS preflight
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Add headers to response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.header(key, value);
  });

  await next();
});

// Load standard security & observability middlewares
app.use('*', securityHeaders);
app.use('*', requestLogger);
app.use('*', rateLimiter);
// Serve public brand icons/logos for x402 Challenge Leaderboard and Bazaar discovery
const servePublicImage = (filename: string) => (c: any) => {
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), 'public', filename),
      path.resolve(__dirname, 'public', filename),
      path.resolve(__dirname, '..', 'public', filename),
      path.resolve(process.cwd(), filename),
    ];
    for (const targetPath of candidatePaths) {
      if (fs.existsSync(targetPath)) {
        const imageBuffer = fs.readFileSync(targetPath);
        return c.body(imageBuffer, 200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'Access-Control-Allow-Origin': '*',
        });
      }
    }
  } catch (err) {
    console.error(`Failed to serve static image ${filename}:`, err);
  }
  return c.notFound();
};

app.get('/icon.png', servePublicImage('icon.png'));
app.get('/iconpng', servePublicImage('icon.png'));
app.get('/icon', servePublicImage('icon.png'));
app.get('/logo.png', servePublicImage('logo.png'));
app.get('/logopng', servePublicImage('logo.png'));
app.get('/logo', servePublicImage('logo.png'));
app.get('/favicon.ico', servePublicImage('icon.png'));
app.get('/apple-touch-icon.png', servePublicImage('icon.png'));
app.get('/public/icon.png', servePublicImage('icon.png'));
app.get('/public/iconpng', servePublicImage('icon.png'));
app.get('/public/logo.png', servePublicImage('logo.png'));
app.get('/public/logopng', servePublicImage('logo.png'));

// Mount API routes
app.route('/api/auth', authRouter);
app.route('/api/chat', chatRouter);
app.route('/api/waitlist', waitlistRouter);
app.route('/api/analytics', analyticsRouter);
app.route('/api/admin', adminRouter);
app.route('/api/prompt-tutor', promptTutorRouter);
app.route('/api/data-map', dataMapRouter);
app.route('/api/semantic-cache', semanticCacheRouter);
app.route('/api/prompt-optimizer', promptOptimizerRouter);
app.route('/api/legal', legalRouter);

/**
 * X402 Payment Middleware
 *
 * Applies payment protection to configured endpoints
 * Intercepts requests and enforces x402 protocol
 */
const paymentConfig: EndpointConfig = createPaymentConfig(avmAddress);
console.log('📋 Registered Payment-Protected Endpoints:');
Object.entries(paymentConfig).forEach(([route, config]) => {
  const price = config.accepts[0]?.price || 'unknown';
  console.log(`   ${route} - ${price} USDC - ${config.description}`);
});
console.log();

app.use(paymentMiddleware(paymentConfig as any, x402Server));



// ════════════════════════════════════════════════════════════════════
// ROUTE HANDLERS - Payment-Protected Endpoints
// ════════════════════════════════════════════════════════════════════

/**
 * These handlers are only called AFTER payment is verified
 * by the x402 middleware
 */

// Payment-protected endpoints
app.on(['GET', 'POST'], '/resume-screen-fast', (c) => handleResumeScreenFastRequest(c));
app.on(['GET', 'POST'], '/resume-screen-accurate', (c) => handleResumeScreenAccurateRequest(c));
app.on(['GET', 'POST'], '/contract-analyze-fast', (c) => handleContractAnalyzeFastRequest(c));
app.on(['GET', 'POST'], '/contract-analyze-accurate', (c) => handleContractAnalyzeAccurateRequest(c));
app.on(['GET', 'POST'], '/invoice-extract-fast', (c) => handleInvoiceExtractFastRequest(c));
app.on(['GET', 'POST'], '/invoice-extract-accurate', (c) => handleInvoiceExtractAccurateRequest(c));
app.on(['GET', 'POST'], '/code-review-fast', (c) => handleCodeReviewFastRequest(c));
app.on(['GET', 'POST'], '/code-review-accurate', (c) => handleCodeReviewAccurateRequest(c));
app.on(['GET', 'POST'], '/seo-audit-fast', (c) => handleSeoAuditFastRequest(c));
app.on(['GET', 'POST'], '/seo-audit-accurate', (c) => handleSeoAuditAccurateRequest(c));
app.on(['GET', 'POST'], '/claim-extract-fast', (c) => handleClaimExtractFastRequest(c));
app.on(['GET', 'POST'], '/claim-extract-accurate', (c) => handleClaimExtractAccurateRequest(c));
app.on(['GET', 'POST'], '/claim-extract', (c) => handleClaimExtractFastRequest(c));
app.on(['GET', 'POST'], '/api/claim-extract', (c) => handleClaimExtractFastRequest(c));
app.on(['GET', 'POST'], '/claim-verify-fast', (c) => handleClaimVerifyFastRequest(c));
app.on(['GET', 'POST'], '/claim-verify-accurate', (c) => handleClaimVerifyAccurateRequest(c));
app.on(['GET', 'POST'], '/claim-verify', (c) => handleClaimVerifyFastRequest(c));
app.on(['GET', 'POST'], '/api/claim-verify', (c) => handleClaimVerifyFastRequest(c));
app.on(['GET', 'POST'], '/source-compare-fast', (c) => handleSourceCompareFastRequest(c));
app.on(['GET', 'POST'], '/source-compare-accurate', (c) => handleSourceCompareAccurateRequest(c));
app.on(['GET', 'POST'], '/source-compare', (c) => handleSourceCompareFastRequest(c));
app.on(['GET', 'POST'], '/api/source-compare', (c) => handleSourceCompareFastRequest(c));
app.on(['GET', 'POST'], '/news-research-fast', (c) => handleNewsResearchFastRequest(c));
app.on(['GET', 'POST'], '/news-research-accurate', (c) => handleNewsResearchAccurateRequest(c));
app.on(['GET', 'POST'], '/news-research', (c) => handleNewsResearchFastRequest(c));
app.on(['GET', 'POST'], '/api/news-research', (c) => handleNewsResearchFastRequest(c));

app.on(['GET', 'POST'], '/run-task', requireAuth, (c) => handleRunTaskRequest(c));
app.get('/savings-summary', optionalAuth, (c) => handleSavingsSummaryRequest(c));
app.post('/chat-reply', optionalAuth, (c) => handleChatReplyRequest(c));

app.post('/execute-task', optionalAuth, (c) => handleExecuteTaskRequest(c));

app.post('/classify-task', (c) => handleClassifyTaskRequest(c));
app.post('/select-endpoint', (c) => handleSelectEndpointRequest(c));
app.post('/plan-task', optionalAuth, (c) => handlePlanTaskRequest(c));

/**
 * Info endpoint - Shows configured endpoints
 * Helpful for debugging and integration
 */
app.get('/info', (c) => {
  // Sanitize payTo — show first 8 + last 4 chars only
  const payToFull = avmAddress || '';
  const payToShort = payToFull.length > 12
    ? `${payToFull.slice(0, 8)}...${payToFull.slice(-4)}`
    : payToFull;

  // Mask USDC asset ID middle digits
  const assetStr = String(NETWORK_CONFIG.usdcAssetId);
  const assetMasked = assetStr.length > 4
    ? `${assetStr.slice(0, 2)}${'*'.repeat(assetStr.length - 4)}${assetStr.slice(-2)}`
    : assetStr;

  return c.json({
    service: 'PRISM x402 Resource Server',
    version: '1.0.0',
    // ── Sanitized x402 Config Summary (no secrets) ──
    x402Network: NETWORK_CONFIG.name,         // 'MAINNET' or 'TESTNET'
    x402UsdcAsset: assetMasked,               // e.g. '31****04'
    x402PayTo: payToShort,                    // e.g. 'FL7U7GHU...RLBE'
    x402Facilitator: facilitatorUrl,          // public URL, safe to expose
    // ── Endpoint info ──
    endpoints: Object.keys(paymentConfig),
    documentation: 'See README.md in project root',
  });
});

// ════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ════════════════════════════════════════════════════════════════════

app.onError(safeErrorHandler);

/**
 * 404 Handler
 *
 * Called when no route matches
 */
app.notFound((c) => {
  return c.json(
    {
      error: 'Endpoint not found',
      path: c.req.path,
      hint: 'Try GET /health or GET /info for diagnostics',
    },
    404
  );
});

// ════════════════════════════════════════════════════════════════════
// SERVER STARTUP
// ════════════════════════════════════════════════════════════════════

serve({ fetch: app.fetch, port }, async () => {
  console.log('\n✅ x402 Resource Server is running!\n');
  console.log('═'.repeat(60));
  console.log('Endpoints:');
  console.log(`  API:     http://localhost:${port}`);
  console.log(`  Health:  http://localhost:${port}/health`);
  console.log(`  Info:    http://localhost:${port}/info`);
  console.log('═'.repeat(60));

  // Initialize Groq AI Service (validate API keys)
  try {
    await initializeGroqService();
    console.log('✅ Groq AI Service initialized');
  } catch (err) {
    console.warn('⚠ Groq AI Service initialization warning:', err);
    console.warn('   AI endpoints will use fallback behavior');
  }

  // Initialize Automated Data Retention & Lifecycle Scheduler
  try {
    const { startRetentionScheduler } = await import('./services/retention');
    startRetentionScheduler(24);
    console.log('✅ Automated Data Retention Scheduler started');
  } catch (retentionErr: any) {
    console.warn('⚠ Data Retention Scheduler initialization warning:', retentionErr?.message || retentionErr);
  }

  console.log('\n📚 QUICK COMMANDS:\n');
  console.log('Test health endpoint (no payment):');
  console.log(`  curl http://localhost:${port}/health\n`);
  console.log('Test payment endpoint (will request payment):');
  console.log(`  curl http://localhost:${port}/seo-audit-fast\n`);
  console.log('See handlers/ directory for capability implementations');
  console.log('See endpoints.config.ts for pricing configuration');
  console.log('\n' + '═'.repeat(60) + '\n');
});