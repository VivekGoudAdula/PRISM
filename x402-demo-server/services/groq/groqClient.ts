import Groq from 'groq-sdk';
import { groqKeyManager } from './groqKeyManager';
import { groqRateLimiter } from './groqRateLimiter';

/**
 * Options for generating an AI response via Groq.
 */
export interface GenerateAIResponseOptions {
  /** System prompt defining the AI's role and output format */
  systemPrompt: string;
  /** User prompt containing the actual request/data */
  userPrompt: string;
  /** Groq model to use (defaults to GROQ_MODEL env or 'openai/gpt-oss-20b') */
  model?: string;
  /** Temperature for response creativity (0.0–2.0, default 0.2) */
  temperature?: number;
  /** Maximum tokens in the response (default 2500) */
  maxTokens?: number;
  /** Optional JSON response format hint */
  responseFormat?: { type: string };
  /** Endpoint name for logging purposes */
  endpointName?: string;
}

/**
 * Result from a successful Groq AI response.
 */
export interface GenerateAIResult {
  /** The raw text content returned by the model */
  content: string;
  /** Which key index was used (for analytics) */
  keyUsed: number;
  /** Latency of the Groq API call in milliseconds */
  latencyMs: number;
  /** The model actually used */
  model: string;
}

/** Default model from environment or hardcoded fallback */
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

/** Maximum retry attempts across all keys */
const MAX_TOTAL_ATTEMPTS = 6;

/** Per-attempt timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Centralized AI response generator using Groq.
 *
 * Handles:
 * - Key selection via GroqKeyManager
 * - Rate limiting via GroqRateLimiter
 * - Automatic key rotation on 429 errors
 * - Retry with exponential backoff for transient errors
 * - Structured error reporting
 * - Comprehensive logging
 *
 * All PRISM AI endpoints should call this function.
 *
 * @param options - Configuration for the AI request
 * @returns The AI-generated content and metadata
 * @throws Error if all keys fail and no response can be generated
 */
export async function generateAIResponse(
  options: GenerateAIResponseOptions
): Promise<GenerateAIResult> {
  const {
    systemPrompt,
    userPrompt,
    model = DEFAULT_MODEL,
    temperature = 0.2,
    maxTokens = 2500,
    responseFormat,
    endpointName = 'unknown',
  } = options;

  const startTime = Date.now();
  let lastError: Error | null = null;
  const triedKeys = new Set<number>();

  console.log(`[PRISM AI] Endpoint: ${endpointName}`);
  console.log(`[PRISM AI] Model: ${model}`);

  for (let attempt = 0; attempt < MAX_TOTAL_ATTEMPTS; attempt++) {
    // Get an available key, excluding already-failed keys for rate-limit errors
    let clientInfo = groqKeyManager.getClient();

    // If the current key was already tried and rate-limited, get the next one
    if (clientInfo && triedKeys.has(clientInfo.keyIndex)) {
      clientInfo = groqKeyManager.getNextClient(clientInfo.keyIndex);
    }

    if (!clientInfo) {
      // No healthy keys available
      if (attempt > 0) {
        // Wait with exponential backoff before checking again
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
        console.log(`[PRISM AI] All keys exhausted, waiting ${backoffMs}ms before retry`);
        await sleep(backoffMs);
        clientInfo = groqKeyManager.getClient();
        if (!clientInfo) break;
      } else {
        break;
      }
    }

    if (!clientInfo) break;

    const { client, keyIndex } = clientInfo;
    console.log(`[PRISM AI] Key: ${keyIndex} (attempt ${attempt + 1})`);

    // Acquire rate-limit slot
    let releaseSlot: (() => void) | null = null;
    try {
      releaseSlot = await groqRateLimiter.acquire(REQUEST_TIMEOUT_MS);
    } catch (rateLimitErr: any) {
      console.warn(`[PRISM AI] Rate limiter rejected request: ${rateLimitErr.message}`);
      lastError = rateLimitErr;
      continue;
    }

    try {
      const requestBody: any = {
        model,
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      };

      if (responseFormat) {
        requestBody.response_format = responseFormat;
      }

      const response = await client.chat.completions.create(requestBody);

      const content = response.choices?.[0]?.message?.content;
      if (!content || !content.trim()) {
        throw new Error('Groq returned empty response content');
      }

      // Success!
      groqKeyManager.reportSuccess(keyIndex);
      const latencyMs = Date.now() - startTime;

      console.log(`[PRISM AI] Result: success (${latencyMs}ms)`);

      return {
        content: content.trim(),
        keyUsed: keyIndex,
        latencyMs,
        model,
      };
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode || 0;
      const message = err?.message || 'Unknown error';

      if (status === 401 || status === 403) {
        // Authentication failure — permanently mark key invalid, don't retry this key
        groqKeyManager.reportAuthFailure(keyIndex);
        triedKeys.add(keyIndex);
        console.warn(`[PRISM AI] Key ${keyIndex} auth failure (${status}), trying next key`);
        continue;
      }

      if (status === 429) {
        // Rate limited — put key on cooldown, try another
        groqKeyManager.reportRateLimit(keyIndex);
        triedKeys.add(keyIndex);
        console.log(`[PRISM AI] Key ${keyIndex} rate limited, switching to next key`);
        continue;
      }

      if (status >= 500 || message.includes('network') || message.includes('timeout') || message.includes('ECONNREFUSED')) {
        // Transient/server error — can retry with backoff
        groqKeyManager.reportTransientError(keyIndex);
        const backoffMs = Math.min(500 * Math.pow(2, attempt), 8_000);
        console.warn(`[PRISM AI] Key ${keyIndex} transient error (${status || message}), retrying in ${backoffMs}ms`);
        await sleep(backoffMs);
        continue;
      }

      // Unknown error — log and try next
      groqKeyManager.reportTransientError(keyIndex);
      console.error(`[PRISM AI] Key ${keyIndex} unexpected error: ${message}`);
      continue;
    } finally {
      if (releaseSlot) releaseSlot();
    }
  }

  // All attempts exhausted
  const errorMessage = lastError?.message || 'All Groq API keys failed';
  console.error(`[PRISM AI] All attempts failed for ${endpointName}: ${errorMessage}`);
  throw new Error(`[PRISM AI] AI execution failed: ${sanitizeErrorMessage(errorMessage)}`);
}

/**
 * Sanitizes error messages to prevent leaking API keys or internal details.
 *
 * @param message - Raw error message
 * @returns Sanitized message safe for client-facing responses
 */
function sanitizeErrorMessage(message: string): string {
  // Remove any API key patterns
  let sanitized = message.replace(/gsk_[A-Za-z0-9_-]+/g, '[REDACTED]');
  sanitized = sanitized.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]');
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_-]+/g, 'Bearer [REDACTED]');

  // Remove stack trace information
  sanitized = sanitized.replace(/\n\s+at\s+.+/g, '');

  return sanitized;
}

/**
 * Promise-based sleep utility.
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
