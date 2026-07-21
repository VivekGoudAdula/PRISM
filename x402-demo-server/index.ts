/**
 * X402 Hackathon Starter Kit - Main Server
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

import { config } from 'dotenv';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { paymentMiddleware } from '@x402/hono';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import { ALGORAND_TESTNET_CAIP2 } from '@x402/avm';
import mongoose from 'mongoose';

// Import handler functions
import { handleWeatherRequest } from './handlers/weather';
import { handleAnalyticsRequest, handleAnalyticsReportRequest } from './handlers/analytics';
import {
  handleAIAnalysisRequest,
  handleAIAnalysisBatchRequest,
} from './handlers/ai-analysis';
import {
  handleCreatorContentRequest,
  handleCreatorContentListRequest,
  handleCreatorPublishRequest,
  handleCreatorEarningsRequest,
} from './handlers/creator-content';

// Import endpoint configuration
import createPaymentConfig, { EndpointConfig } from './endpoints.config';

// Import Middlewares and Routers
import { requestLogger, rateLimiter, errorMiddleware } from './middleware/common';
import { requireAuth } from './middleware/auth';
import authRouter from './routes/auth';
import chatRouter from './routes/chat';
import waitlistRouter from './routes/waitlist';
import { analyticsRouter, adminRouter } from './routes/analytics';

// Load environment variables
config();

import bcrypt from 'bcryptjs';
import { User } from './models/User';

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
    
    // Seed Admin User
    try {
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
          credits: 999999,
        });
        console.log('✅ Default Admin user seeded successfully');
      }
    } catch (err) {
      console.error('Error seeding admin user:', err);
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
console.log(`  Receiver Address: ${avmAddress}`);
console.log(`  Facilitator: ${facilitatorUrl}`);
console.log(`  Port: ${port}`);
console.log('═'.repeat(60) + '\n');

// Initialize x402 Resource Server
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const x402Server = new x402ResourceServer(facilitatorClient);

// Register payment scheme for TestNet
const avmServerScheme = new ExactAvmScheme();
x402Server.register(ALGORAND_TESTNET_CAIP2, avmServerScheme);

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
    'Access-Control-Expose-Headers': '*', // Critical for x402
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

// Load standard middlewares
app.use('*', requestLogger);
app.use('*', rateLimiter);
app.onError(errorMiddleware);

// Mount API routes
app.route('/api/auth', authRouter);
app.route('/api/chat', chatRouter);
app.route('/api/waitlist', waitlistRouter);
app.route('/api/analytics', analyticsRouter);
app.route('/api/admin', adminRouter);

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

// Example 1: Weather Data - Pay $0.005
app.get('/weather', handleWeatherRequest);

// 6 new payment-protected endpoints
app.post('/resume-screen-fast', async (c) => {
  const { handleResumeScreenFastRequest } = await import('./handlers/resume-screen-fast');
  return handleResumeScreenFastRequest(c);
});
app.post('/resume-screen-accurate', async (c) => {
  const { handleResumeScreenAccurateRequest } = await import('./handlers/resume-screen-accurate');
  return handleResumeScreenAccurateRequest(c);
});
app.post('/contract-analyze-fast', async (c) => {
  const { handleContractAnalyzeFastRequest } = await import('./handlers/contract-analyze-fast');
  return handleContractAnalyzeFastRequest(c);
});
app.post('/contract-analyze-accurate', async (c) => {
  const { handleContractAnalyzeAccurateRequest } = await import('./handlers/contract-analyze-accurate');
  return handleContractAnalyzeAccurateRequest(c);
});
app.post('/invoice-extract-fast', async (c) => {
  const { handleInvoiceExtractFastRequest } = await import('./handlers/invoice-extract-fast');
  return handleInvoiceExtractFastRequest(c);
});
app.post('/invoice-extract-accurate', async (c) => {
  const { handleInvoiceExtractAccurateRequest } = await import('./handlers/invoice-extract-accurate');
  return handleInvoiceExtractAccurateRequest(c);
});

app.post('/run-task', requireAuth, async (c) => {
  const { handleRunTaskRequest } = await import('./handlers/run-task');
  return handleRunTaskRequest(c);
});

/**
 * POST /execute-task?planId=<id> — DYNAMIC PAYMENT PROTECTED
 *
 * Phase 2 of the new pipeline. The x402 paymentMiddleware enforces a
 * dynamic price resolved from the plan's totalCost (quantity × unitPrice
 * + platformFee). Called only after the user confirms the Execution Summary
 * and the blockchain payment is verified.
 */
app.post('/execute-task', requireAuth, async (c) => {
  const { handleExecuteTaskRequest } = await import('./handlers/execute-task');
  return handleExecuteTaskRequest(c);
});

// Example 2: Analytics - Uncomment to enable
// app.get('/analytics', handleAnalyticsRequest);
// app.post('/analytics/report', handleAnalyticsReportRequest);

// Example 3: AI Analysis - Uncomment to enable
// app.post('/ai-analysis', handleAIAnalysisRequest);
// app.post('/ai-analysis/batch', handleAIAnalysisBatchRequest);

// Example 4: Creator Content - Uncomment to enable
// app.get('/exclusive-content/:id', handleCreatorContentRequest);
// app.get('/creators/:wallet/content', handleCreatorContentListRequest);
// app.post('/creators/publish', handleCreatorPublishRequest);
// app.get('/creators/:wallet/earnings', handleCreatorEarningsRequest);

// ════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS - No payment required
// ════════════════════════════════════════════════════════════════════

/**
 * Health check - Use this to verify server is running
 * No payment required
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'x402-hackathon-starter',
    uptime: process.uptime(),
  });
});

app.post('/classify-task', async (c) => {
  const { handleClassifyTaskRequest } = await import('./handlers/classify-task');
  return handleClassifyTaskRequest(c);
});

app.post('/select-endpoint', async (c) => {
  const { handleSelectEndpointRequest } = await import('./handlers/select-endpoint');
  return handleSelectEndpointRequest(c);
});

/**
 * POST /plan-task — PUBLIC (no payment required)
 *
 * Phase 1 of the new pipeline. Classifies the task, discovers providers,
 * computes dynamic pricing (quantity × unitPrice + platform fee), and
 * returns a planId + full ExecutionPlan to the client.
 */
app.post('/plan-task', requireAuth, async (c) => {
  const { handlePlanTaskRequest } = await import('./handlers/plan-task');
  return handlePlanTaskRequest(c);
});

/**
 * Info endpoint - Shows configured endpoints
 * Helpful for debugging and integration
 */
app.get('/info', (c) => {
  return c.json({
    service: 'x402-hackathon-starter',
    version: '1.0.0',
    network: 'Algorand TestNet',
    receiver: avmAddress,
    endpoints: Object.keys(paymentConfig),
    documentation: 'See README.md in project root',
  });
});

// ════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ════════════════════════════════════════════════════════════════════

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

serve({ fetch: app.fetch, port }, () => {
  console.log('\n✅ x402 Resource Server is running!\n');
  console.log('═'.repeat(60));
  console.log('Endpoints:');
  console.log(`  API:     http://localhost:${port}`);
  console.log(`  Health:  http://localhost:${port}/health`);
  console.log(`  Info:    http://localhost:${port}/info`);
  console.log('═'.repeat(60));
  console.log('\n📚 QUICK COMMANDS:\n');
  console.log('Test health endpoint (no payment):');
  console.log(`  curl http://localhost:${port}/health\n`);
  console.log('Test payment endpoint (will request payment):');
  console.log(`  curl http://localhost:${port}/weather\n`);
  console.log('See handlers/ directory for examples');
  console.log('See endpoints.config.ts to add new endpoints');
  console.log('\n' + '═'.repeat(60) + '\n');
});