/**
 * Centralized rate limiter for Groq API requests.
 * Prevents excessive API calls and respects Groq's rate limits.
 *
 * Uses a sliding-window token bucket approach:
 * - Tracks requests per second and per minute
 * - Queues or rejects requests when limits are exceeded
 * - Works correctly with multiple API keys
 */

/** Configuration for rate limit windows */
interface RateLimitConfig {
  /** Maximum requests per second (across all keys) */
  maxRequestsPerSecond: number;
  /** Maximum requests per minute (across all keys) */
  maxRequestsPerMinute: number;
  /** Maximum concurrent in-flight requests */
  maxConcurrent: number;
  /** Maximum queue depth before rejecting new requests */
  maxQueueDepth: number;
}

/** Internal tracking for a rate limit window */
interface WindowTracker {
  timestamps: number[];
  windowMs: number;
  maxRequests: number;
}

/** Result of a rate limit check */
export interface RateLimitResult {
  allowed: boolean;
  waitMs: number;
  reason?: string;
  queuePosition?: number;
}

/** Default configuration — conservative limits for Groq free tier */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequestsPerSecond: 5,
  maxRequestsPerMinute: 25,
  maxConcurrent: 8,
  maxQueueDepth: 20,
};

/**
 * Centralized rate limiter for all Groq API requests.
 * Ensures the server doesn't exceed Groq rate limits.
 */
class GroqRateLimiter {
  private config: RateLimitConfig;
  private secondWindow: WindowTracker;
  private minuteWindow: WindowTracker;
  private concurrentCount = 0;
  private queue: Array<{ resolve: (value: void) => void; reject: (reason: any) => void; timestamp: number }> = [];

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.secondWindow = {
      timestamps: [],
      windowMs: 1000,
      maxRequests: this.config.maxRequestsPerSecond,
    };

    this.minuteWindow = {
      timestamps: [],
      windowMs: 60_000,
      maxRequests: this.config.maxRequestsPerMinute,
    };
  }

  /**
   * Checks if a new request is allowed under current rate limits.
   * Does NOT consume a slot — call `acquire()` for that.
   */
  check(): RateLimitResult {
    this.pruneWindows();

    if (this.concurrentCount >= this.config.maxConcurrent) {
      return {
        allowed: false,
        waitMs: 500,
        reason: `Concurrent limit reached (${this.concurrentCount}/${this.config.maxConcurrent})`,
      };
    }

    if (this.secondWindow.timestamps.length >= this.secondWindow.maxRequests) {
      const oldestInWindow = this.secondWindow.timestamps[0];
      const waitMs = Math.max(0, oldestInWindow + this.secondWindow.windowMs - Date.now());
      return {
        allowed: false,
        waitMs,
        reason: `Per-second limit reached (${this.secondWindow.timestamps.length}/${this.secondWindow.maxRequests})`,
      };
    }

    if (this.minuteWindow.timestamps.length >= this.minuteWindow.maxRequests) {
      const oldestInWindow = this.minuteWindow.timestamps[0];
      const waitMs = Math.max(0, oldestInWindow + this.minuteWindow.windowMs - Date.now());
      return {
        allowed: false,
        waitMs,
        reason: `Per-minute limit reached (${this.minuteWindow.timestamps.length}/${this.minuteWindow.maxRequests})`,
      };
    }

    return { allowed: true, waitMs: 0 };
  }

  /**
   * Acquires a rate-limit slot. If the limit is hit, waits up to a timeout
   * before rejecting. Returns a release function to call when the request completes.
   *
   * @param timeoutMs - Maximum milliseconds to wait for a slot (default: 30s)
   * @returns A release function to call when the Groq request finishes
   * @throws If the queue is full or the timeout is exceeded
   */
  async acquire(timeoutMs = 30_000): Promise<() => void> {
    const checkResult = this.check();

    if (checkResult.allowed) {
      return this.consumeSlot();
    }

    // Queue the request if there's room
    if (this.queue.length >= this.config.maxQueueDepth) {
      throw new Error(
        `[PRISM AI] Rate limiter queue full (${this.queue.length}/${this.config.maxQueueDepth}). ` +
        `Try again later. ${checkResult.reason}`
      );
    }

    // Wait for a slot
    return new Promise<() => void>((resolve, reject) => {
      const entry = {
        resolve: () => resolve(this.consumeSlot()),
        reject,
        timestamp: Date.now(),
      };
      this.queue.push(entry);

      // Timeout: reject if we wait too long
      const timer = setTimeout(() => {
        const idx = this.queue.indexOf(entry);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          reject(new Error(`[PRISM AI] Rate limiter timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      // Schedule a drain attempt after the recommended wait
      setTimeout(() => this.drainQueue(), Math.max(100, checkResult.waitMs));

      // Clean up the timeout if resolved
      const origResolve = entry.resolve;
      entry.resolve = () => {
        clearTimeout(timer);
        origResolve();
      };
    });
  }

  /**
   * Returns current rate limiter statistics for diagnostics.
   */
  getStats(): {
    requestsThisSecond: number;
    requestsThisMinute: number;
    concurrentRequests: number;
    queueDepth: number;
  } {
    this.pruneWindows();
    return {
      requestsThisSecond: this.secondWindow.timestamps.length,
      requestsThisMinute: this.minuteWindow.timestamps.length,
      concurrentRequests: this.concurrentCount,
      queueDepth: this.queue.length,
    };
  }

  /**
   * Consumes a rate-limit slot and returns a release function.
   */
  private consumeSlot(): () => void {
    const now = Date.now();
    this.secondWindow.timestamps.push(now);
    this.minuteWindow.timestamps.push(now);
    this.concurrentCount++;

    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.concurrentCount = Math.max(0, this.concurrentCount - 1);
        // Try to drain waiting requests
        this.drainQueue();
      }
    };
  }

  /**
   * Processes queued requests when slots become available.
   */
  private drainQueue(): void {
    while (this.queue.length > 0) {
      const checkResult = this.check();
      if (!checkResult.allowed) break;

      const entry = this.queue.shift();
      if (entry) {
        entry.resolve();
      }
    }
  }

  /**
   * Removes expired timestamps from sliding windows.
   */
  private pruneWindows(): void {
    const now = Date.now();

    this.secondWindow.timestamps = this.secondWindow.timestamps.filter(
      (t) => now - t < this.secondWindow.windowMs
    );

    this.minuteWindow.timestamps = this.minuteWindow.timestamps.filter(
      (t) => now - t < this.minuteWindow.windowMs
    );
  }
}

/** Singleton instance of the Groq Rate Limiter */
export const groqRateLimiter = new GroqRateLimiter();
