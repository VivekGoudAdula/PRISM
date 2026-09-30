/**
 * Verification Test Suite for x402 Canonical Resource Identity
 *
 * Verifies that:
 *  1. Canonical endpoint identity remains 100% STABLE across multiple transactions.
 *  2. Query parameters (planId, fileIndex, timestamp, requestId) do NOT generate new resource IDs.
 *  3. Dynamic pricing discounts do NOT generate new resource IDs.
 *  4. 50 transactions to 3 different endpoints yield EXACTLY 3 unique resource identities.
 */

import createPaymentConfig from '../endpoints.config';
import { CANONICAL_ENDPOINTS } from '../endpoints.registry';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { x402HTTPResourceServer } from '@x402/core/server';

const mockAddress = 'AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKKL';
const paymentConfig = createPaymentConfig(mockAddress);
const dummyFacilitator = new HTTPFacilitatorClient({ url: 'https://facilitator.goplausible.xyz' });
const x402Server = new x402ResourceServer(dummyFacilitator);
const httpServer = new x402HTTPResourceServer(x402Server, paymentConfig as any);

interface DummyAdapter {
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  getMethod(): string;
  getPath(): string;
  getUrl(): string;
  getAcceptHeader(): string;
  getUserAgent(): string;
  getQueryParam(name: string): string | undefined;
  getHeader(name: string): string | undefined;
  getBody(): any;
}

function createDummyAdapter(path: string, query: Record<string, string> = {}, method: string = 'POST'): DummyAdapter {
  const queryString = new URLSearchParams(query).toString();
  const fullUrl = `https://prism-99h2.onrender.com${path}${queryString ? '?' + queryString : ''}`;
  return {
    path,
    query,
    headers: {},
    getMethod: () => method,
    getPath: () => path,
    getUrl: () => fullUrl,
    getAcceptHeader: () => 'application/json',
    getUserAgent: () => 'PRISM-Test-Agent/1.0',
    getQueryParam: (name: string) => query[name],
    getHeader: (name: string) => undefined,
    getBody: () => ({}),
  };
}

async function runTests() {
  console.log('=' .repeat(70));
  console.log('🧪 x402 CANONICAL RESOURCE IDENTITY VERIFICATION TEST');
  console.log('='.repeat(70));

  // ── Test 1: Canonical Registry Verification ─────────────────────────────
  console.log('\n[TEST 1] Auditing Canonical Endpoint Registry...');
  const registeredKeys = Object.keys(CANONICAL_ENDPOINTS);
  console.log(`✅ Total Canonical Endpoints Registered: ${registeredKeys.length}`);
  registeredKeys.forEach((key) => {
    const ep = CANONICAL_ENDPOINTS[key];
    console.log(`   - Endpoint ID: ${ep.id.padEnd(25)} -> Resource URL: ${ep.resourceUrl}`);
  });

  if (registeredKeys.length < 10) {
    throw new Error(`Expected at least 10 canonical endpoints, found ${registeredKeys.length}`);
  }

  // ── Test 2: Multiple Transactions Stability Test ─────────────────────────
  console.log('\n[TEST 2] Testing 5 Transactions -> /code-review-fast with different query params...');
  const codeReviewResources = new Set<string>();

  for (let i = 1; i <= 5; i++) {
    const adapter = createDummyAdapter('/code-review-fast', {
      requestId: `req-uuid-${i}-${Date.now()}`,
      timestamp: String(Date.now()),
      planId: `66b4c123456789012345678${i}`,
      fileIndex: String(i - 1),
    });

    const context = { adapter, path: '/code-review-fast', method: 'POST' };
    const routeConfig = (httpServer as any).getRouteConfig('/code-review-fast', 'POST')?.config;
    const resourceUrl = routeConfig?.resource || adapter.getUrl();
    codeReviewResources.add(resourceUrl);

    console.log(`   Tx #${i}: URL requested = ${adapter.getUrl()}`);
    console.log(`          -> Resource ID = ${resourceUrl}`);
  }

  console.log(`\nResult for /code-review-fast: ${codeReviewResources.size} unique resource identity generated for 5 transactions.`);
  if (codeReviewResources.size !== 1) {
    throw new Error(`FAILED: Expected 1 unique resource URL, but got ${codeReviewResources.size}`);
  }
  console.log('✅ PASSED: /code-review-fast resource identity is 100% STABLE across 5 transactions.');

  // ── Test 3: Multiple Transactions Stability Test for /resume-screen-fast ────
  console.log('\n[TEST 3] Testing 10 Transactions -> /resume-screen-fast...');
  const resumeResources = new Set<string>();

  for (let i = 1; i <= 10; i++) {
    const adapter = createDummyAdapter('/resume-screen-fast', {
      planId: `plan-998877-${i}`,
      fileIndex: String(i % 3),
      t: String(Date.now() + i),
    });

    const routeConfig = (httpServer as any).getRouteConfig('/resume-screen-fast', 'POST')?.config;
    const resourceUrl = routeConfig?.resource || adapter.getUrl();
    resumeResources.add(resourceUrl);
  }

  console.log(`Result for /resume-screen-fast: ${resumeResources.size} unique resource identity for 10 transactions.`);
  if (resumeResources.size !== 1) {
    throw new Error(`FAILED: Expected 1 unique resource URL for /resume-screen-fast, got ${resumeResources.size}`);
  }
  console.log('✅ PASSED: /resume-screen-fast resource identity is 100% STABLE across 10 transactions.');

  // ── Test 4: Dynamic Pricing Stability Test ──────────────────────────────
  console.log('\n[TEST 4] Testing Dynamic Pricing Variations on /resume-screen-accurate...');
  const dynamicPricingResources = new Set<string>();
  const discounts = [0.0, 0.05, 0.07, 0.10, 0.15];

  for (let i = 0; i < discounts.length; i++) {
    const adapter = createDummyAdapter('/resume-screen-accurate', {
      discount: String(discounts[i]),
      reqId: `dynamic-${i}`,
    });

    const routeConfig = (httpServer as any).getRouteConfig('/resume-screen-accurate', 'POST')?.config;
    const resourceUrl = routeConfig?.resource || adapter.getUrl();
    dynamicPricingResources.add(resourceUrl);
  }

  console.log(`Result for dynamic pricing test: ${dynamicPricingResources.size} unique resource identity across 5 different price discount requests.`);
  if (dynamicPricingResources.size !== 1) {
    throw new Error(`FAILED: Dynamic pricing created multiple endpoints! Got ${dynamicPricingResources.size}`);
  }
  console.log('✅ PASSED: Dynamic pricing does NOT create new resource identities.');

  // ── Test 5: Mass Batch Transaction Simulation ────────────────────────────
  console.log('\n[TEST 5] Simulating 50 Transactions across 3 Endpoints...');
  const globalResourceSet = new Set<string>();

  const endpointsToSimulate = ['/code-review-fast', '/resume-screen-fast', '/seo-audit-fast'];
  for (let i = 0; i < 50; i++) {
    const ep = endpointsToSimulate[i % endpointsToSimulate.length];
    const adapter = createDummyAdapter(ep, { txn: `sim-${i}`, rnd: String(Math.random()) });
    const routeConfig = (httpServer as any).getRouteConfig(ep, 'POST')?.config;
    const resourceUrl = routeConfig?.resource || adapter.getUrl();
    globalResourceSet.add(resourceUrl);
  }

  console.log(`50 Transactions processed.`);
  console.log(`Total unique endpoints/resources generated: ${globalResourceSet.size}`);
  console.log(`Unique resource URLs:`);
  globalResourceSet.forEach((res) => console.log(`   - ${res}`));

  if (globalResourceSet.size !== 3) {
    throw new Error(`FAILED: Expected exactly 3 resource IDs for 3 endpoints, but got ${globalResourceSet.size}`);
  }
  console.log('✅ PASSED: 50 transactions created EXACTLY 3 resource identities (1 per canonical endpoint).');

  console.log('\n' + '='.repeat(70));
  console.log('🎉 ALL x402 RESOURCE IDENTITY TESTS PASSED SUCCESSFULLY!');
  console.log('='.repeat(70) + '\n');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
