import { config } from 'dotenv';
import { parseRobustJson } from './parse-json-robust';

config();

export interface OpenRouterKeyEntry {
  id: string;
  key: string;
  maskedKey: string;
  isUnhealthyAuth: boolean;
  rateLimitedUntil: number;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
}

export class OpenRouterManagerService {
  private keys: OpenRouterKeyEntry[] = [];
  private lastKeyIndex = 0;

  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    parseFailures: 0,
    emptyResponses: 0,
    rateLimitedRequests: 0,
    badRequests: 0,
  };

  constructor() {
    this.reloadKeys();
  }

  /** Reload keys dynamically from environment variables */
  public reloadKeys(): void {
    const rawKeys: string[] = [];

    if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) {
      rawKeys.push(process.env.OPENROUTER_API_KEY.trim());
    }

    for (let i = 1; i <= 20; i++) {
      const k = process.env[`OPENROUTER_API_KEY_${i}`];
      if (k && k.trim()) {
        rawKeys.push(k.trim());
      }
    }

    // Deduplicate keys
    const uniqueKeys = Array.from(new Set(rawKeys));

    // Preserve metrics for existing keys
    const existingMap = new Map<string, OpenRouterKeyEntry>();
    for (const entry of this.keys) {
      existingMap.set(entry.key, entry);
    }

    this.keys = uniqueKeys.map((key, index) => {
      const existing = existingMap.get(key);
      if (existing) return existing;

      const maskedKey = key.length > 12
        ? `${key.slice(0, 10)}...${key.slice(-4)}`
        : 'sk-or-v1-***';

      return {
        id: `KEY_${index + 1}`,
        key,
        maskedKey,
        isUnhealthyAuth: false,
        rateLimitedUntil: 0,
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
      };
    });

    if (this.keys.length === 0) {
      console.warn('⚠️ [OpenRouterManager] No OPENROUTER_API_KEY environment variables found.');
    }
  }

  /** Select an available healthy key using Round-Robin distribution */
  private selectHealthyKey(): OpenRouterKeyEntry | null {
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
   * Chat completion request via OpenRouter API with round-robin key rotation & robust parsing.
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
    // Default model: meta-llama/llama-3.3-70b-instruct:free or google/gemini-2.5-flash:free
    let model = options.model || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
    // Ensure model has :free suffix if no custom environment override is specified
    if (!process.env.OPENROUTER_MODEL && !model.endsWith(':free') && !model.includes('/')) {
      model = `${model}:free`;
    }

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
            console.warn(`⏳ All OpenRouter keys rate-limited. Pausing ${(minWait / 1000).toFixed(1)}s for window reset...`);
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
            code: 'OPENROUTER_AUTH_ERROR',
            message: 'All configured OpenRouter API keys returned HTTP 401/403 (Unauthorized). Please check your API keys in environment variables.',
            status: 401,
            rotationReasons,
          };
        }
        throw {
          code: 'ALL_KEYS_RATE_LIMITED',
          message: 'All OpenRouter API keys are currently rate-limited. Please retry in a few moments.',
          status: 429,
          rotationReasons,
        };
      }

      this.metrics.totalRequests++;
      keyEntry.totalCalls++;
      const startTime = Date.now();

      console.log(`\n========================================`);
      console.log(`OPENROUTER AI REQUEST (Attempt ${attempts}/${totalMaxAttempts})`);
      console.log(`========================================`);
      console.log(`Key ID:     ${keyEntry.id} (${keyEntry.maskedKey})`);
      console.log(`Model:      ${model}`);
      console.log(`Prompt size:${options.messages.reduce((acc, m) => acc + m.content.length, 0)} chars`);

      try {
        const bodyPayload: any = {
          model,
          messages: options.messages,
          temperature,
          max_tokens: 4096,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keyEntry.key}`,
            'HTTP-Referer': 'https://prism.ai',
            'X-OpenRouter-Title': 'PRISM Decentralized AI Router',
          },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        console.log(`========================================`);
        console.log(`OPENROUTER AI RESPONSE`);
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
              message: 'OpenRouter API returned HTTP 200 but response body was unparseable JSON.',
              status: 200,
            };
          }

          const content = resData.choices?.[0]?.message?.content;
          const usage = resData.usage;

          if (content === undefined || content === null || (typeof content === 'string' && content.trim() === '')) {
            this.metrics.emptyResponses++;
            this.metrics.failedRequests++;
            keyEntry.failedCalls++;
            console.error(`❌ Empty response received from OpenRouter model ${model}`);
            throw {
              code: 'EMPTY_AI_RESPONSE',
              message: 'OpenRouter AI returned an empty response. Analysis could not be completed.',
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

        if (status === 402) {
          const errText = await response.text().catch(() => '');
          const freeFallbackModel = model.endsWith(':free') ? 'openrouter/auto' : `${model}:free`;
          console.warn(`⚠️ OpenRouter HTTP 402 (Payment Required) on ${model}. Retrying with free model: ${freeFallbackModel}`);
          rotationReasons.push(`HTTP 402 on ${model} — switching to ${freeFallbackModel}`);
          model = freeFallbackModel;
          continue;
        }

        if (status === 400) {
          this.metrics.badRequests++;
          const errText = await response.text().catch(() => '');
          console.error(`❌ Bad Request (400) to OpenRouter: ${errText}`);
          throw {
            code: 'BAD_REQUEST',
            message: `OpenRouter API bad request (HTTP 400): ${errText}`,
            status: 400,
          };
        }

        if (status === 401 || status === 403) {
          keyEntry.isUnhealthyAuth = true;
          const msg = `Key ${keyEntry.id} (${keyEntry.maskedKey}) returned HTTP ${status} (Unauthorized/Forbidden) — marking key unhealthy`;
          console.warn(`⚠️ ${msg}`);
          rotationReasons.push(msg);
          continue;
        }

        if (status === 429) {
          this.metrics.rateLimitedRequests++;
          keyEntry.rateLimitedUntil = Date.now() + 15 * 1000;
          const msg = `Key ${keyEntry.id} hit rate limit (HTTP 429) — temporarily rotating key`;
          console.warn(`⚠️ ${msg}`);
          rotationReasons.push(msg);
          continue;
        }

        const errText = await response.text().catch(() => '');
        const msg = `Key ${keyEntry.id} failed with HTTP ${status}: ${errText.slice(0, 100)}`;
        console.warn(`⚠️ ${msg}`);
        rotationReasons.push(msg);
      } catch (err: any) {
        if (err?.code === 'BAD_REQUEST' || err?.code === 'JSON_PARSE_FAILED' || err?.code === 'EMPTY_AI_RESPONSE') {
          throw err;
        }
        console.warn(`⚠️ Request error on key ${keyEntry.id}: ${err?.message || err}`);
        rotationReasons.push(`Key ${keyEntry.id} error: ${err?.message || String(err)}`);
      }
    }

    this.metrics.failedRequests++;
    throw {
      code: 'OPENROUTER_ALL_RETRIES_EXHAUSTED',
      message: `OpenRouter execution failed after ${attempts} attempt(s) across configured keys.`,
      status: 502,
      rotationReasons,
    };
  }

  public getMetrics() {
    return {
      ...this.metrics,
      totalKeysConfigured: this.keys.length,
      healthyKeysAvailable: this.keys.filter((k) => !k.isUnhealthyAuth && k.rateLimitedUntil <= Date.now()).length,
    };
  }

  public getKeyStatuses() {
    const now = Date.now();
    return this.keys.map((k) => ({
      id: k.id,
      maskedKey: k.maskedKey,
      isUnhealthyAuth: k.isUnhealthyAuth,
      isRateLimited: k.rateLimitedUntil > now,
      rateLimitedSecondsRemaining: Math.max(0, Math.ceil((k.rateLimitedUntil - now) / 1000)),
      totalCalls: k.totalCalls,
      successCalls: k.successCalls,
      failedCalls: k.failedCalls,
    }));
  }
}

export const openrouterManager = new OpenRouterManagerService();
