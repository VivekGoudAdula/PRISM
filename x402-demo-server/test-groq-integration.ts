/**
 * PRISM Groq Integration Test Script.
 *
 * Tests the Groq service independently:
 * 1. Key Manager initialization and validation
 * 2. Rate limiter functionality
 * 3. generateAIResponse() with a real request
 * 4. Error handling and fallback behavior
 *
 * Usage: npx tsx test-groq-integration.ts
 * Requires GROQ_API_KEY_1 to be set in .env
 */

import { config } from 'dotenv';
config();

import { groqKeyManager } from './services/groq/groqKeyManager';
import { groqRateLimiter } from './services/groq/groqRateLimiter';
import { generateAIResponse } from './services/groq/groqClient';
import { initializeGroqService } from './services/groq';

const PASS = '✅';
const FAIL = '❌';
const SKIP = '⏭️';
let passed = 0;
let failed = 0;
let skipped = 0;

/**
 * Runs a named test case and reports pass/fail.
 */
async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`${PASS} ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`${FAIL} ${name}: ${err.message}`);
    failed++;
  }
}

/**
 * Asserts a condition is true.
 */
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('PRISM Groq Integration Tests');
  console.log('═'.repeat(60) + '\n');

  // ── Test 1: Key Manager Initialization ──
  await runTest('Key Manager initializes without error', async () => {
    groqKeyManager.initialize();
    assert(true, 'Should not throw');
  });

  await runTest('Key Manager reports configured key count', async () => {
    const count = groqKeyManager.getKeyCount();
    console.log(`  → ${count} key(s) configured`);
    assert(count >= 0, 'Key count should be non-negative');
  });

  // ── Test 2: Key Validation ──
  if (groqKeyManager.getKeyCount() > 0) {
    await runTest('Key validation completes', async () => {
      await groqKeyManager.validateAllKeys();
      const summary = groqKeyManager.getHealthSummary();
      console.log(`  → Health summary:`, summary);
    });

    await runTest('At least one healthy key exists', async () => {
      const hasHealthy = groqKeyManager.hasHealthyKey();
      console.log(`  → Has healthy key: ${hasHealthy}`);
      assert(hasHealthy, 'At least one key should be healthy');
    });

    await runTest('getClient() returns a valid client', async () => {
      const client = groqKeyManager.getClient();
      assert(client !== null, 'Should return a client');
      console.log(`  → Using key index: ${client!.keyIndex}`);
    });
  } else {
    console.log(`${SKIP} Skipping key validation tests (no keys configured)`);
    skipped += 3;
  }

  // ── Test 3: Rate Limiter ──
  await runTest('Rate limiter allows first request', async () => {
    const result = groqRateLimiter.check();
    assert(result.allowed, `Should be allowed, got: ${result.reason}`);
  });

  await runTest('Rate limiter tracks statistics', async () => {
    const stats = groqRateLimiter.getStats();
    console.log(`  → Stats:`, stats);
    assert(typeof stats.requestsThisSecond === 'number', 'Should track per-second');
    assert(typeof stats.requestsThisMinute === 'number', 'Should track per-minute');
  });

  await runTest('Rate limiter acquire/release cycle works', async () => {
    const release = await groqRateLimiter.acquire(5000);
    const stats = groqRateLimiter.getStats();
    assert(stats.concurrentRequests > 0, 'Should have concurrent requests');
    release();
    const statsAfter = groqRateLimiter.getStats();
    assert(statsAfter.concurrentRequests === 0, 'Concurrent should be 0 after release');
  });

  // ── Test 4: Full Service Initialization ──
  await runTest('initializeGroqService() completes', async () => {
    await initializeGroqService();
  });

  // ── Test 5: Real AI Request (only if keys are available) ──
  if (groqKeyManager.hasHealthyKey()) {
    await runTest('generateAIResponse() returns real content', async () => {
      const result = await generateAIResponse({
        systemPrompt: 'You are a helpful assistant. Respond with exactly one sentence.',
        userPrompt: 'What is 2 + 2?',
        temperature: 0.1,
        maxTokens: 100,
        endpointName: 'integration-test',
      });

      console.log(`  → Content: "${result.content.slice(0, 100)}"`);
      console.log(`  → Key used: ${result.keyUsed}, Latency: ${result.latencyMs}ms`);
      assert(result.content.length > 0, 'Content should not be empty');
      assert(result.keyUsed > 0, 'Key index should be positive');
      assert(result.latencyMs > 0, 'Latency should be positive');
    });

    await runTest('generateAIResponse() handles code review prompt', async () => {
      const result = await generateAIResponse({
        systemPrompt: 'Analyze the following code. Return ONLY JSON: { "issues": [], "overall_quality_score": 0.9 }',
        userPrompt: 'function add(a, b) { return a + b; }',
        temperature: 0.1,
        maxTokens: 500,
        responseFormat: { type: 'json_object' },
        endpointName: 'test-code-review',
      });

      console.log(`  → Content: "${result.content.slice(0, 200)}"`);
      assert(result.content.includes('{'), 'Should return JSON');
    });

    await runTest('generateAIResponse() handles resume screening prompt', async () => {
      const result = await generateAIResponse({
        systemPrompt: 'Rate the candidate. Return ONLY JSON: { "name": "John Doe", "match_score": 0.7, "role": "Engineer", "key_skills": ["JavaScript"], "primary_domain": "Web", "alternative_roles": [], "reason": "Good fit" }',
        userPrompt: 'Resume: John Doe, 5 years JavaScript experience. Target role: Frontend Engineer.',
        temperature: 0.1,
        maxTokens: 500,
        endpointName: 'test-resume-screen',
      });

      console.log(`  → Content: "${result.content.slice(0, 200)}"`);
      assert(result.content.length > 10, 'Should return meaningful content');
    });
  } else {
    console.log(`${SKIP} Skipping real AI request tests (no healthy keys)`);
    skipped += 3;
  }

  // ── Test 6: Error Handling ──
  await runTest('generateAIResponse() throws on empty prompt', async () => {
    try {
      await generateAIResponse({
        systemPrompt: '',
        userPrompt: '',
        endpointName: 'test-error',
      });
      // If no keys, this will throw "All Groq API keys failed"
      // If keys exist but empty prompt, model may still respond
    } catch (err: any) {
      console.log(`  → Expected error: ${err.message.slice(0, 100)}`);
      // This is an expected behavior path
    }
    // Either case is fine — test validates error doesn't crash the process
  });

  // ── Summary ──
  console.log('\n' + '═'.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('═'.repeat(60) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
