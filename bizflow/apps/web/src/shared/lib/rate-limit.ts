import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// ── Fallback: no-op limiter when Redis is not configured ──────────────────────
const dummyLimiter = {
  limit: async (_id: string) => ({ success: true, pending: Promise.resolve(), limit: 999, remaining: 999, reset: 0 }),
};

let authLimiter: any = dummyLimiter;
let apiLimiter: any = dummyLimiter;
let emailLimiter: any = dummyLimiter;   // Per-email brute-force protection
let registerLimiter: any = dummyLimiter; // Registration throttle (per IP)

// A-1 FIX: Warn when rate limiting is disabled so operators notice immediately
if (!url || !token) {
  console.warn('[RateLimit] ⚠ UPSTASH_REDIS_REST_URL or TOKEN not set — ALL rate limits are DISABLED. Auth brute-force protection is inactive.');
}

if (url && token) {
  const redis = new Redis({ url, token });

  /**
   * IP-based auth rate limit.
   * 10 attempts per 15 minutes per IP address.
   */
  authLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "15 m"),
    analytics: true,
    prefix: "@bizflow/ratelimit/auth-ip",
  });

  /**
   * Per-email brute-force rate limit.
   * 5 login attempts per 15 minutes per email address.
   * This catches attackers rotating IPs to hit the same account.
   */
  emailLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    analytics: true,
    prefix: "@bizflow/ratelimit/auth-email",
  });

  /**
   * Registration rate limit (per IP).
   * Max 5 new accounts per hour from a single IP.
   */
  registerLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    analytics: true,
    prefix: "@bizflow/ratelimit/register",
  });

  /**
   * General API rate limit (per IP).
   * Now uses an in-memory Map instead of Upstash to eliminate HTTPS overhead
   * on every single authenticated request. (120 requests per minute)
   */
  class InMemoryRateLimiter {
    private hits = new Map<string, { count: number, resetTime: number }>();
    private maxLimit = 120;
    private windowMs = 60 * 1000;

    async limit(id: string) {
      const now = Date.now();
      let record = this.hits.get(id);

      if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + this.windowMs };
      }

      record.count += 1;
      this.hits.set(id, record);

      // Clean up old entries occasionally (rough garbage collection)
      if (this.hits.size > 1000) {
        for (const [key, val] of this.hits) {
          if (now > val.resetTime) this.hits.delete(key);
        }
      }

      return {
        success: record.count <= this.maxLimit,
        pending: Promise.resolve(),
        limit: this.maxLimit,
        remaining: Math.max(0, this.maxLimit - record.count),
        reset: record.resetTime,
      };
    }
  }
  apiLimiter = new InMemoryRateLimiter();
}

export const authRateLimit = authLimiter;
export const emailRateLimit = emailLimiter;
export const registerRateLimit = registerLimiter;
export const apiRateLimit = apiLimiter;
