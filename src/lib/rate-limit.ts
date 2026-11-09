/**
 * In-memory rate limiter for public-facing actions.
 *
 * Tracks request counts per identifier (IP address, username, etc.) within a
 * sliding time window. When the limit is exceeded, the identifier is blocked
 * until the window resets.
 *
 * This is intentionally simple: no external dependencies, no persistence
 * (limits reset on restart), and per-process memory only. It's suitable for
 * a single Node.js process serving a modest number of shops. A durable,
 * distributed rate limiter (e.g. Redis-backed) can replace this later.
 */
interface WindowRecord {
  count: number;
  windowStart: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAfterMs: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, WindowRecord>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Check whether an identifier is allowed to make a request right now.
   * Returns whether the request is allowed, how many requests remain in the
   * current window, and how many milliseconds until the window resets.
   */
  check(identifier: string): RateLimitResult {
    const now = Date.now();
    const record = this.windows.get(identifier);

    if (!record || now >= record.windowStart + this.windowMs) {
      // Start a new window.
      this.windows.set(identifier, {
        count: 1,
        windowStart: now,
      });

      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAfterMs: this.windowMs,
      };
    }

    // Within the current window.
    if (record.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAfterMs: record.windowStart + this.windowMs - now,
      };
    }

    record.count += 1;

    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      resetAfterMs: record.windowStart + this.windowMs - now,
    };
  }

  /** Reset the rate limit for an identifier (e.g. after a successful sign-in). */
  reset(identifier: string): void {
    this.windows.delete(identifier);
  }

  /** Current number of tracked identifiers (for debugging / metrics). */
  size(): number {
    return this.windows.size;
  }
}

/**
 * Rate limiters for public-facing actions. Shared across requests within a
 * single Node.js process.
 *
 * Limits are intentionally conservative: they block abusive repetition while
 * allowing normal shop use. Identifiers are usernames/IDs rather than IP
 * addresses, since Next.js server actions don't reliably expose the client IP.
 */
export const loginRateLimiter = new RateLimiter(10, 60 * 1000); // 10 per minute
export const signupRateLimiter = new RateLimiter(5, 60 * 1000); // 5 per minute
export const joinRequestRateLimiter = new RateLimiter(10, 60 * 1000); // 10 per minute
export const shopSearchRateLimiter = new RateLimiter(30, 60 * 1000); // 30 per minute
