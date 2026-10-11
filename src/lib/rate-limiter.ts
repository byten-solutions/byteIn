/**
 * In-memory sliding-window rate limiter for brute-force abuse protection.
 *
 * NOTE ON DEPLOYMENT ARCHITECTURE:
 * This rate limiter maintains state within the active Node.js process memory.
 * For byteInn V1 (a single-process modular monolith reception PMS deployment),
 * this effectively throttles credential-stuffing and brute-force attacks.
 * In a future multi-instance or serverless clustered deployment behind a round-robin
 * load balancer without sticky sessions, rate-limit state should be externalized
 * (e.g. to Redis or PostgreSQL token-bucket table).
 */

interface RateLimitRecord {
  attempts: number[];
}

export class InMemoryRateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically clean up stale entries every 5 minutes to prevent memory leaks
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Evaluates whether an action is permitted under the specified rate limit.
   *
   * @param key Unique identifier (e.g. `login:ip:${ip}` or `login:account:${email}`)
   * @param maxAttempts Maximum allowed attempts within the window
   * @param windowSeconds Duration of the rolling window in seconds
   * @returns Object with allowed status, remaining attempts, and retry delay in seconds
   */
  check(
    key: string,
    maxAttempts = 5,
    windowSeconds = 60
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    let record = this.records.get(key);
    if (!record) {
      record = { attempts: [] };
      this.records.set(key, record);
    }

    // Filter attempts to only those within the rolling window
    record.attempts = record.attempts.filter((timestamp) => timestamp > windowStart);

    if (record.attempts.length >= maxAttempts) {
      const oldestAttempt = record.attempts[0] || now;
      const retryAfterMs = oldestAttempt + windowMs - now;
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      remaining: maxAttempts - record.attempts.length,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Records an attempt for the specified key.
   */
  recordAttempt(key: string): void {
    const now = Date.now();
    let record = this.records.get(key);
    if (!record) {
      record = { attempts: [] };
      this.records.set(key, record);
    }
    record.attempts.push(now);
  }

  /**
   * Resets rate-limiting record for a key (e.g. after a successful login).
   */
  reset(key: string): void {
    this.records.delete(key);
  }

  /**
   * Clears all stale entries from the store.
   */
  private cleanup(): void {
    const now = Date.now();
    // Default max window: 10 minutes
    const maxWindowMs = 10 * 60 * 1000;

    for (const [key, record] of this.records.entries()) {
      record.attempts = record.attempts.filter((timestamp) => timestamp > now - maxWindowMs);
      if (record.attempts.length === 0) {
        this.records.delete(key);
      }
    }
  }

  /**
   * Testing helper to reset all in-memory records.
   */
  clearAll(): void {
    this.records.clear();
  }
}

export const loginRateLimiter = new InMemoryRateLimiter();
export { InMemoryRateLimiter as RateLimiter };
