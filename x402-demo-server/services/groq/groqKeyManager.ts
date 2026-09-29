import Groq from 'groq-sdk';

/**
 * Health status for a single Groq API key.
 */
export type KeyHealth = 'HEALTHY' | 'RATE_LIMITED' | 'INVALID' | 'ERROR' | 'UNCHECKED';

/**
 * Internal state for a managed Groq API key.
 */
interface ManagedKey {
  /** Positional index (1-based) for logging */
  index: number;
  /** Groq SDK client instance */
  client: Groq;
  /** Current health status */
  health: KeyHealth;
  /** Timestamp when key was rate-limited (for cooldown calculation) */
  rateLimitedAt: number | null;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Last successful request timestamp */
  lastSuccessAt: number | null;
}

/** Cooldown duration for rate-limited keys (60 seconds) */
const RATE_LIMIT_COOLDOWN_MS = 60_000;

/** Maximum consecutive failures before marking key as ERROR */
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Centralized manager for up to 3 Groq API keys.
 * Handles key validation, health tracking, rotation, and failover.
 */
class GroqKeyManager {
  private keys: ManagedKey[] = [];
  private currentKeyIndex = 0;
  private initialized = false;

  /**
   * Loads API keys from environment variables and creates Groq client instances.
   * Call this once during server startup.
   */
  initialize(): void {
    if (this.initialized) return;

    const envKeys = [
      process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
    ];

    this.keys = envKeys
      .map((apiKey, idx) => {
        if (!apiKey || !apiKey.trim()) return null;
        return {
          index: idx + 1,
          client: new Groq({ apiKey: apiKey.trim() }),
          health: 'UNCHECKED' as KeyHealth,
          rateLimitedAt: null,
          consecutiveFailures: 0,
          lastSuccessAt: null,
        };
      })
      .filter(Boolean) as ManagedKey[];

    this.initialized = true;
    console.log(`[PRISM AI] Groq Key Manager initialized with ${this.keys.length} key(s)`);
  }

  /**
   * Validates all configured keys by sending a minimal test request.
   * Logs health status for each key without exposing the actual key values.
   */
  async validateAllKeys(): Promise<void> {
    if (this.keys.length === 0) {
      console.warn('[PRISM AI] No Groq API keys configured');
      return;
    }

    console.log('[PRISM AI] Validating Groq API keys...');

    for (const key of this.keys) {
      try {
        await key.client.chat.completions.create({
          model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        });

        key.health = 'HEALTHY';
        key.consecutiveFailures = 0;
        key.lastSuccessAt = Date.now();
        console.log(`[PRISM AI] Key ${key.index}: healthy`);
      } catch (err: any) {
        const status = err?.status || err?.statusCode || 0;

        if (status === 401 || status === 403) {
          key.health = 'INVALID';
          console.warn(`[PRISM AI] Key ${key.index}: invalid (auth error ${status})`);
        } else if (status === 429) {
          key.health = 'RATE_LIMITED';
          key.rateLimitedAt = Date.now();
          console.warn(`[PRISM AI] Key ${key.index}: rate limited`);
        } else {
          key.health = 'ERROR';
          console.warn(`[PRISM AI] Key ${key.index}: unavailable (${err?.message || 'unknown error'})`);
        }
      }
    }

    const healthyCount = this.keys.filter((k) => k.health === 'HEALTHY').length;
    if (healthyCount === 0) {
      console.error('[PRISM AI] ⚠ No healthy Groq API keys available');
    } else {
      console.log(`[PRISM AI] ${healthyCount}/${this.keys.length} Groq key(s) healthy`);
    }
  }

  /**
   * Returns the number of configured keys.
   */
  getKeyCount(): number {
    return this.keys.length;
  }

  /**
   * Returns a summary of key health states for diagnostics.
   */
  getHealthSummary(): Array<{ key: number; health: KeyHealth }> {
    return this.keys.map((k) => ({ key: k.index, health: k.health }));
  }

  /**
   * Checks if any healthy key is available for requests.
   */
  hasHealthyKey(): boolean {
    this.refreshCooldowns();
    return this.keys.some((k) => k.health === 'HEALTHY');
  }

  /**
   * Gets the next available Groq client, preferring the currently healthy key.
   * Implements sticky key selection with failover on rate-limit.
   *
   * @returns The Groq client and key index, or null if no key is available
   */
  getClient(): { client: Groq; keyIndex: number } | null {
    if (this.keys.length === 0) return null;

    this.refreshCooldowns();

    // First: try the current preferred key
    const current = this.keys[this.currentKeyIndex];
    if (current && current.health === 'HEALTHY') {
      return { client: current.client, keyIndex: current.index };
    }

    // Second: find any healthy key
    for (let i = 0; i < this.keys.length; i++) {
      if (this.keys[i].health === 'HEALTHY') {
        this.currentKeyIndex = i;
        return { client: this.keys[i].client, keyIndex: this.keys[i].index };
      }
    }

    return null;
  }

  /**
   * Gets the next available client, excluding the specified key index.
   * Used during failover when the primary key fails.
   *
   * @param excludeKeyIndex - The 1-based key index to skip
   */
  getNextClient(excludeKeyIndex: number): { client: Groq; keyIndex: number } | null {
    if (this.keys.length === 0) return null;

    this.refreshCooldowns();

    for (const key of this.keys) {
      if (key.index !== excludeKeyIndex && key.health === 'HEALTHY') {
        this.currentKeyIndex = this.keys.indexOf(key);
        return { client: key.client, keyIndex: key.index };
      }
    }

    return null;
  }

  /**
   * Reports a successful request for a specific key.
   *
   * @param keyIndex - The 1-based key index
   */
  reportSuccess(keyIndex: number): void {
    const key = this.keys.find((k) => k.index === keyIndex);
    if (key) {
      key.health = 'HEALTHY';
      key.consecutiveFailures = 0;
      key.lastSuccessAt = Date.now();
      key.rateLimitedAt = null;
    }
  }

  /**
   * Reports a rate-limit error (HTTP 429) for a specific key.
   * Places the key on cooldown.
   *
   * @param keyIndex - The 1-based key index
   */
  reportRateLimit(keyIndex: number): void {
    const key = this.keys.find((k) => k.index === keyIndex);
    if (key) {
      key.health = 'RATE_LIMITED';
      key.rateLimitedAt = Date.now();
      key.consecutiveFailures++;
      console.log(`[PRISM AI] Key ${keyIndex} rate limited, cooldown ${RATE_LIMIT_COOLDOWN_MS / 1000}s`);
    }
  }

  /**
   * Reports an authentication failure for a specific key.
   * Permanently marks the key as invalid.
   *
   * @param keyIndex - The 1-based key index
   */
  reportAuthFailure(keyIndex: number): void {
    const key = this.keys.find((k) => k.index === keyIndex);
    if (key) {
      key.health = 'INVALID';
      console.warn(`[PRISM AI] Key ${keyIndex} marked as invalid (auth failure)`);
    }
  }

  /**
   * Reports a transient/network error for a specific key.
   * Increments failure counter and may mark key as error if threshold exceeded.
   *
   * @param keyIndex - The 1-based key index
   */
  reportTransientError(keyIndex: number): void {
    const key = this.keys.find((k) => k.index === keyIndex);
    if (key) {
      key.consecutiveFailures++;
      if (key.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        key.health = 'ERROR';
        console.warn(`[PRISM AI] Key ${keyIndex} marked as ERROR after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`);
      }
    }
  }

  /**
   * Re-checks rate-limited keys and restores them if cooldown has elapsed.
   */
  private refreshCooldowns(): void {
    const now = Date.now();
    for (const key of this.keys) {
      if (
        key.health === 'RATE_LIMITED' &&
        key.rateLimitedAt &&
        now - key.rateLimitedAt >= RATE_LIMIT_COOLDOWN_MS
      ) {
        key.health = 'HEALTHY';
        key.rateLimitedAt = null;
        key.consecutiveFailures = 0;
        console.log(`[PRISM AI] Key ${key.index} cooldown expired, restored to HEALTHY`);
      }
    }
  }
}

/** Singleton instance of the Groq Key Manager */
export const groqKeyManager = new GroqKeyManager();
