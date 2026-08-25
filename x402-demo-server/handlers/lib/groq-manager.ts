import { parseRobustJson } from './parse-json-robust';

export interface GroqMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  unauthorizedRequests: number;
  badRequests: number;
  serverErrors: number;
  timeouts: number;
  emptyResponses: number;
  parseFailures: number;
}

export interface GroqKeyStatus {
  id: string;
  maskedKey: string;
  isUnhealthyAuth: boolean;
  rateLimitedUntil: number;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
}

interface KeyEntry {
  id: string;
  key: string;
  maskedKey: string;
  isUnhealthyAuth: boolean;
  rateLimitedUntil: number;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
}

class GroqManagerService {
  private keys: KeyEntry[] = [];
  private metrics: GroqMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    unauthorizedRequests: 0,
    badRequests: 0,
    serverErrors: 0,
    timeouts: 0,
    emptyResponses: 0,
    parseFailures: 0,
  };

  constructor() {
    this.reloadKeys();
  }

  /** Reload keys from environment variables safely */
  public reloadKeys(): void {
    const rawKeys: Array<{ id: string; key: string }> = [];

    if (process.env.GROQ_API_KEY) {
      rawKeys.push({ id: 'KEY_DEFAULT', key: process.env.GROQ_API_KEY.trim() });
    }

    for (let i = 1; i <= 10; i++) {
      const val = process.env[`GROQ_API_KEY_${i}`];
      if (val && val.trim()) {
        const id = `KEY_${i}`;
        if (!rawKeys.some((k) => k.key === val.trim())) {
          rawKeys.push({ id, key: val.trim() });
        }
      }
    }

    // Preserve previous metrics if key reloads
    this.keys = rawKeys.map((item) => {
      const existing = this.keys.find((k) => k.key === item.key);
      const maskedKey = item.key.length > 8
        ? `${item.key.slice(0, 7)}...${item.key.slice(-4)}`
        : '***';
      return (
        existing || {
          id: item.id,
          key: item.key,
          maskedKey,
          isUnhealthyAuth: false,
          rateLimitedUntil: 0,
          totalCalls: 0,
          successCalls: 0,
          failedCalls: 0,
        }
      );
    });
  }

  public getMetrics(): GroqMetrics {
    return { ...this.metrics };
  }

  public getKeyStatuses(): GroqKeyStatus[] {
    return this.keys.map(({ id, maskedKey, isUnhealthyAuth, rateLimitedUntil, totalCalls, successCalls, failedCalls }) => ({
      id,
      maskedKey,
      isUnhealthyAuth,
      rateLimitedUntil,
      totalCalls,
      successCalls,
      failedCalls,
    }));
  }

  private lastKeyIndex = 0;

  /** Select an available healthy key using Round-Robin distribution */
  private selectHealthyKey(): KeyEntry | null {
    const now = Date.now();
    const validKeys = this.keys.filter((k) => !k.isUnhealthyAuth);
    if (validKeys.length === 0) return null;

    const availableKeys = validKeys.filter((k) => k.rateLimitedUntil <= now);
    if (availableKeys.length > 0) {
      this.lastKeyIndex = (this.lastKeyIndex + 1) % availableKeys.length;
      return availableKeys[this.lastKeyIndex];
    }

    return null;
  }

  /**
   * Primary Chat Completion Request with rotation, retry, and strict response parsing.
   */
  public async chatCompletion<T = any>(options: {
    model?: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    responseFormatJson?: boolean;
    maxRetriesPerKey?: number;
  }): Promise<{
    data: T;
    rawContent: string;
    model: string;
    keyId: string;
    durationMs: number;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const model = options.model || 'openai/gpt-oss-20b';
    const temperature = options.temperature ?? 0.1;
    const maxRetries = options.maxRetriesPerKey ?? 2;
    const totalMaxAttempts = Math.max(3, this.keys.length * maxRetries);

    let attempts = 0;
    const rotationReasons: string[] = [];

    while (attempts < totalMaxAttempts) {
      attempts++;
      this.reloadKeys();

      let keyEntry = this.selectHealthyKey();
      if (!keyEntry) {
        const now = Date.now();
        const validKeys = this.keys.filter((k) => !k.isUnhealthyAuth);
        if (validKeys.length > 0) {
          const minWait = Math.min(...validKeys.map((k) => Math.max(0, k.rateLimitedUntil - now)));
          if (minWait > 0 && minWait <= 15000 && attempts < totalMaxAttempts) {
            console.warn(`⏳ All keys rate-limited. Pausing ${(minWait / 1000).toFixed(1)}s for key pool reset...`);
            await new Promise((r) => setTimeout(r, minWait + 500));
            keyEntry = this.selectHealthyKey();
          }
        }
      }

      if (!keyEntry) {
        this.metrics.failedRequests++;
        const authCount = this.keys.filter((k) => k.isUnhealthyAuth).length;
        if (authCount === this.keys.length && this.keys.length > 0) {
          throw {
            code: 'GROQ_AUTH_ERROR',
            message: 'All configured Groq API keys returned HTTP 401/403 (Unauthorized). Please check your API keys in .env.',
            status: 401,
            rotationReasons,
          };
        }
        throw {
          code: 'ALL_KEYS_RATE_LIMITED',
          message: 'All Groq API keys are currently rate-limited. Please retry in a few moments.',
          status: 429,
          rotationReasons,
        };
      }

      this.metrics.totalRequests++;
      keyEntry.totalCalls++;
      const startTime = Date.now();

      console.log(`\n========================================`);
      console.log(`AI REQUEST (Attempt ${attempts}/${totalMaxAttempts})`);
      console.log(`========================================`);
      console.log(`Key ID:     ${keyEntry.id} (${keyEntry.maskedKey})`);
      console.log(`Model:      ${model}`);
      console.log(`Prompt size:${options.messages.reduce((acc, m) => acc + m.content.length, 0)} chars`);

      try {
        const bodyPayload: any = {
          model,
          messages: options.messages,
          temperature,
        };
        if (options.responseFormatJson !== false) {
          bodyPayload.response_format = { type: 'json_object' };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keyEntry.key}`,
          },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        console.log(`========================================`);
        console.log(`AI RESPONSE`);
        console.log(`========================================`);
        console.log(`Status:     ${response.status} ${response.statusText}`);
        console.log(`Duration:   ${durationMs} ms`);

        // ── 1. HTTP 200 OK Case ──────────
        if (response.ok) {
          const resData: any = await response.json().catch(() => null);
          if (!resData) {
            this.metrics.emptyResponses++;
            this.metrics.failedRequests++;
            keyEntry.failedCalls++;
            throw {
              code: 'EMPTY_AI_RESPONSE',
              message: 'Groq API returned HTTP 200 but response body was unparseable JSON.',
              status: 200,
            };
          }

          const content = resData.choices?.[0]?.message?.content;
          const usage = resData.usage;

          if (content === undefined || content === null || (typeof content === 'string' && content.trim() === '')) {
            this.metrics.emptyResponses++;
            this.metrics.failedRequests++;
            keyEntry.failedCalls++;
            console.error(`❌ Empty response received from Groq model ${model}`);
            throw {
              code: 'EMPTY_AI_RESPONSE',
              message: 'Groq AI returned an empty response. Analysis could not be completed.',
              status: 200,
            };
          }

          const trimmedContent = String(content).trim();
          console.log(`Content len: ${trimmedContent.length}`);

          let parsedData: T;
          if (options.responseFormatJson === false) {
            parsedData = { reply: trimmedContent } as unknown as T;
          } else {
            try {
              parsedData = parseRobustJson<T>(trimmedContent);
              console.log(`JSON parsed: YES`);
            } catch (parseErr: any) {
              this.metrics.parseFailures++;
              this.metrics.failedRequests++;
              keyEntry.failedCalls++;
              console.error(`❌ JSON Parsing failed for content: "${trimmedContent.slice(0, 100)}..."`, parseErr.message);
              throw {
                code: 'JSON_PARSE_FAILED',
                message: `Failed to parse AI output into structured format: ${parseErr.message}`,
                status: 200,
                rawContent: trimmedContent,
              };
            }
          }

          this.metrics.successfulRequests++;
          keyEntry.successCalls++;

          return {
            data: parsedData,
            rawContent: trimmedContent,
            model,
            keyId: keyEntry.id,
            durationMs,
            usage,
          };
        }

        // ── 2. HTTP Error Handling ───────
        const status = response.status;
        keyEntry.failedCalls++;

        // 400 Bad Request — Invalid prompt / request body (DO NOT ROTATE KEYS)
        if (status === 400) {
          this.metrics.badRequests++;
          this.metrics.failedRequests++;
          const errBody = await response.text().catch(() => '');
          console.error(`❌ Bad Request (400) to Groq: ${errBody}`);
          throw {
            code: 'BAD_REQUEST',
            message: `Groq API bad request (HTTP 400): ${errBody || 'Malformed prompt or parameters'}`,
            status: 400,
          };
        }

        // 401 / 403 Unauthorized — Mark Key Unhealthy
        if (status === 401 || status === 403) {
          this.metrics.unauthorizedRequests++;
          keyEntry.isUnhealthyAuth = true;
          const msg = `Key ${keyEntry.id} returned HTTP ${status} (Unauthorized/Forbidden) — marking key unhealthy`;
          console.warn(`⚠️ ${msg}`);
          rotationReasons.push(msg);
          continue; // Rotate to next healthy key
        }

        // 429 Rate Limited — Temporary Cooldown
        if (status === 429) {
          this.metrics.rateLimitedRequests++;
          // Cooldown key for 15 seconds
          keyEntry.rateLimitedUntil = Date.now() + 15 * 1000;
          const msg = `Key ${keyEntry.id} hit rate limit (HTTP 429) — temporarily rotating to next available key`;
          console.warn(`⚠️ ${msg}`);
          rotationReasons.push(msg);
          continue; // Rotate to next healthy key
        }

        // 500 / 502 / 503 / 504 Server Errors — Temporary retry
        if (status >= 500) {
          this.metrics.serverErrors++;
          const msg = `Groq server error HTTP ${status} with key ${keyEntry.id}`;
          console.warn(`⚠️ ${msg}`);
          rotationReasons.push(msg);
          await new Promise((r) => setTimeout(r, 1000 * attempts)); // Backoff
          continue;
        }

        // Unhandled HTTP Status
        this.metrics.failedRequests++;
        const errText = await response.text().catch(() => '');
        throw {
          code: 'GROQ_HTTP_ERROR',
          message: `Groq API error (HTTP ${status}): ${errText}`,
          status,
        };

      } catch (err: any) {
        // If error is already structured (e.g. EMPTY_AI_RESPONSE, JSON_PARSE_FAILED, BAD_REQUEST, GROQ_AUTH_ERROR), rethrow immediately!
        if (err?.code) {
          throw err;
        }

        // Check for fetch timeout / network error
        if (err.name === 'AbortError') {
          this.metrics.timeouts++;
          keyEntry.failedCalls++;
          const msg = `Groq request timed out (45s) on key ${keyEntry.id}`;
          console.warn(`⚠️ ${msg}`);
          rotationReasons.push(msg);
          continue;
        }

        // Other network errors
        this.metrics.failedRequests++;
        keyEntry.failedCalls++;
        const msg = `Network error on Groq request with key ${keyEntry.id}: ${err.message}`;
        console.warn(`⚠️ ${msg}`);
        rotationReasons.push(msg);
      }
    }

    this.metrics.failedRequests++;
    throw {
      code: 'AI_ANALYSIS_FAILED',
      message: 'All Groq API key execution attempts exhausted or failed.',
      status: 500,
      rotationReasons,
    };
  }
}

export const groqManager = new GroqManagerService();
