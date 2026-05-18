import { config } from 'dotenv';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { paymentMiddleware } from '@x402/hono';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from '@x402/avm';

config();

const avmAddress = process.env.AVM_ADDRESS;
const facilitatorUrl = process.env.FACILITATOR_URL;

if (!avmAddress || !facilitatorUrl) {
  console.error('Missing environment variables: AVM_ADDRESS or FACILITATOR_URL');
  process.exit(1);
}

console.log('Initializing x402 Resource Server');
console.log('AVM Address:', avmAddress);
console.log('Facilitator URL:', facilitatorUrl);

// Initialize the Resource Server
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const x402Server = new x402ResourceServer(facilitatorClient);

// Register Network Schemes
const avmServerScheme = new ExactAvmScheme();
x402Server.register(ALGORAND_TESTNET_CAIP2, avmServerScheme);

const app = new Hono();

// Custom CORS handling - must be first middleware
app.use('*', async (c, next) => {
  // Set CORS headers on all responses - allow everything for x402
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers': '*', // Allow any header
    'Access-Control-Expose-Headers': '*', // Expose any header
    'Access-Control-Max-Age': '86400',
  }
  
  // Handle preflight OPTIONS requests
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  
  // For all other requests, set headers and continue
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.header(key, value)
  })
  
  await next()
});

// Add logging middleware
app.use('*', async (c, next) => {
  console.log(`\n[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`);
  const requestHeaders: Record<string, string> = {}
  c.req.raw.headers.forEach((value, key) => {
    requestHeaders[key] = value
  })
  console.log('Request Headers:', JSON.stringify(requestHeaders, null, 2))
  await next()
  console.log('Response Status:', c.res.status)
});

// Apply payment middleware globally with configuration
const weatherConfig = {
  'GET /weather': {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.005',
        network: ALGORAND_TESTNET_CAIP2,
        payTo: avmAddress,
        extra: { asset: USDC_TESTNET_ASA_ID },
      },
    ],
    description: 'Weather data access',
  },
}

console.log('Registering payment middleware with config:', JSON.stringify(weatherConfig, null, 2))
app.use(paymentMiddleware(weatherConfig, x402Server));

// Resource Handler - this will only be reached after payment is verified
app.get('/weather', (c) => {
  console.log('✓✓✓ PAYMENT VERIFIED - GET /weather handler reached!')
  return c.json({
    report: {
      weather: 'sunny',
      temperature: 70,
      timestamp: new Date().toISOString(),
    },
  });
});

// Health check endpoint (no payment required)
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// 404 handler
app.notFound((c) => {
  console.log('404 - Not found:', c.req.path);
  return c.json({ error: 'Not found' }, 404);
});

serve({ fetch: app.fetch, port: 4021 }, () => {
  console.log(`✓ x402 Resource Server listening at http://localhost:4021`);
});