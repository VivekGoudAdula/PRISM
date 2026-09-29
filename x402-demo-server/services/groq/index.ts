/**
 * Centralized Groq AI Service for PRISM.
 *
 * Re-exports the key manager, rate limiter, and client for convenient imports.
 * Also provides an initialization function for server startup.
 */

export { groqKeyManager } from './groqKeyManager';
export { groqRateLimiter } from './groqRateLimiter';
export { generateAIResponse } from './groqClient';
export type { GenerateAIResponseOptions, GenerateAIResult } from './groqClient';

import { groqKeyManager } from './groqKeyManager';

/**
 * Initializes the Groq service during server startup.
 * Loads API keys and validates them.
 *
 * Should be called once after environment variables are loaded.
 */
export async function initializeGroqService(): Promise<void> {
  groqKeyManager.initialize();

  if (groqKeyManager.getKeyCount() === 0) {
    console.warn('[PRISM AI] No GROQ_API_KEY_* environment variables set. AI will use fallback behavior.');
    return;
  }

  await groqKeyManager.validateAllKeys();

  const healthSummary = groqKeyManager.getHealthSummary();
  console.log('[PRISM AI] Groq Service initialized:');
  for (const entry of healthSummary) {
    console.log(`  Key ${entry.key}: ${entry.health.toLowerCase()}`);
  }
}
