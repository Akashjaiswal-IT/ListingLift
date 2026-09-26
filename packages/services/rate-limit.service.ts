import { getRedisConnection } from "./queue/queue.service";

export type RateLimitAction = "generate" | "re_edit" | "upload";

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
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

export async function checkRateLimit(
  userId: string,
  action: RateLimitAction
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const key = `ratelimit:${action}:${userId}`;

  try {
    const redis = getRedisConnection();
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, config.windowSeconds);
    }

    const ttl = await redis.ttl(key);

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
    console.warn(`Rate limiter check error for ${key}, bypassing:`, err);
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit,
      resetInSeconds: config.windowSeconds,
    };
  }
}
