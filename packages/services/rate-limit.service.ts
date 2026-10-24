import { getRedisConnection } from "./queue/queue.service";

export type RateLimitAction =
  | "generate"
  | "re_edit"
  | "upload"
  | "create_listing"
  | "create_order"
  | "verify_payment"
  | "apply_referral"
  | "regenerate_cards"
  | "regenerate_text"
  | "export"
  | "api_ip";

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

const RATE_LIMITS: Record<RateLimitAction, RateLimitConfig> = {
  generate: {
    limit: 10,
    windowSeconds: 3600, // 10 generations per hour
  },
  re_edit: {
    limit: 5,
    windowSeconds: 3600, // 5 re-edits per hour
  },
  upload: {
    limit: 100,
    windowSeconds: 86400, // 100 uploads per day
  },
  create_listing: { limit: 100, windowSeconds: 86400 }, // new listings per day
  create_order: { limit: 10, windowSeconds: 600 }, // Razorpay orders per 10 minutes
  verify_payment: { limit: 20, windowSeconds: 600 },
  apply_referral: { limit: 5, windowSeconds: 3600 },
  regenerate_cards: { limit: 30, windowSeconds: 3600 }, // CPU-heavy card rendering
  regenerate_text: { limit: 20, windowSeconds: 3600 }, // paid OpenAI call
  export: { limit: 20, windowSeconds: 3600 }, // ZIP bundles and Excel exports (CPU/memory heavy)
  // Per client IP across the whole API (see apps/api ipRateLimit); override with API_IP_RATE_LIMIT_PER_MIN.
  api_ip: { limit: Number(process.env.API_IP_RATE_LIMIT_PER_MIN) || 600, windowSeconds: 60 },
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

// Circuit breaker: after Redis fails, skip it for a few seconds instead of making every request
// wait for the timeout again (the limiter fails open anyway).
const BREAKER_MS = 10_000;
let redisFailedAt = 0;

export async function checkRateLimit(
  userId: string,
  action: RateLimitAction
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const key = `ratelimit:${action}:${userId}`;

  if (Date.now() - redisFailedAt < BREAKER_MS) {
    return { allowed: true, limit: config.limit, remaining: config.limit, resetInSeconds: config.windowSeconds };
  }

  try {
    const redis = getRedisConnection();

    // Atomic increment-and-expire via a Lua script. Previously this was two
    // separate calls (INCR then EXPIRE): if the process died in between, the key
    // would live forever with no TTL and the user would be rate-limited
    // permanently. A Lua script runs atomically on the Redis server, so the
    // EXPIRE is guaranteed to be set the first time the key is created.
    // The Redis client waits forever while disconnected; never let that hang a request.
    const withTimeout = <T>(p: Promise<T>) =>
      Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("rate limiter timeout")), 1000))]);

    const current = (await withTimeout(redis.eval(
      `local c = redis.call('INCR', KEYS[1])
       if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
       return c`,
      1,
      key,
      String(config.windowSeconds)
    ))) as number;

    const ttl = await withTimeout(redis.ttl(key));

    if (current > config.limit) {
      return {
        allowed: false,
        limit: config.limit,
        remaining: 0,
        resetInSeconds: ttl > 0 ? ttl : config.windowSeconds,
      };
    }

    return {
      allowed: true,
      limit: config.limit,
      remaining: Math.max(0, config.limit - current),
      resetInSeconds: ttl > 0 ? ttl : config.windowSeconds,
    };
  } catch (err) {
    // If Redis is temporarily unreachable, log and allow traffic to avoid hard outages
    redisFailedAt = Date.now();
    console.warn(`Rate limiter check error for ${key}, bypassing for ${BREAKER_MS / 1000}s:`, err);
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit,
      resetInSeconds: config.windowSeconds,
    };
  }
}
