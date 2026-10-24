import { getRedisConnection } from "../queue/queue.service";

/**
 * One shared limiter for every Gemini image call (generation and re-edit queues, all worker
 * replicas), kept in Redis.
 *
 * Gemini limits are per Google Cloud PROJECT, not per key, and Tier 1 adds a spend cap of $10 per
 * rolling 10 minutes on top of requests-per-minute. Going over returns 429 RESOURCE_EXHAUSTED and
 * failed requests still count, so we stay just under the limits instead of hitting them:
 *   - GEMINI_MAX_RPM                     requests per rolling minute (set from AI Studio > rate limits)
 *   - GEMINI_SPEND_LIMIT_USD_PER_10_MIN  estimated spend per rolling 10 minutes (Tier 1 cap is $10)
 * After a 429 every caller also pauses (cooldown) before the next call.
 *
 * Fails open: if Redis can't be reached, calls are not blocked (credits still gate paid work).
 */

export const GEMINI_MAX_RPM = Number(process.env.GEMINI_MAX_RPM) || 20;
export const GEMINI_SPEND_LIMIT_USD = Number(process.env.GEMINI_SPEND_LIMIT_USD_PER_10_MIN) || 8;
/** Per-attempt timeout for a Gemini call, so a hung request can't hold a worker forever. */
export const GEMINI_CALL_TIMEOUT_MS = Number(process.env.GEMINI_CALL_TIMEOUT_MS) || 150_000;
const DEFAULT_COOLDOWN_MS = 60_000;

const RPM_KEY = "gemini:rl:requests";
const SPEND_KEY = "gemini:rl:spend";
const COOLDOWN_KEY = "gemini:rl:cooldown";

export class GeminiCapacityError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super("The image model is at its rate limit right now. Please try again shortly.");
    this.name = "GeminiCapacityError";
  }
}

/**
 * Estimated cost of one image call in USD (official prices: $0.067 per 1K image, $0.101 per 2K
 * image, plus a little for reference-image input and, for Pro, thinking tokens).
 */
export function estimateGeminiCallUsd(imageSize: "1K" | "2K"): number {
  return imageSize === "2K" ? 0.11 : 0.07;
}

// Atomically: drop entries older than their window, then either reserve this call (returns 0) or
// return how many ms to wait. Spend entries are stored as "<cost>:<unique>" members scored by time.
const RESERVE_SCRIPT = `
local now = tonumber(ARGV[1])
local maxRpm = tonumber(ARGV[2])
local budget = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local member = ARGV[5]
local reserve = ARGV[6] == "1"

local cooldown = redis.call('PTTL', KEYS[3])
if cooldown and cooldown > 0 then return cooldown end

redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - 60000)
redis.call('ZREMRANGEBYSCORE', KEYS[2], 0, now - 600000)

local count = redis.call('ZCARD', KEYS[1])
if count >= maxRpm then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return math.max(1, tonumber(oldest[2]) + 60000 - now)
end

local spent = 0
local entries = redis.call('ZRANGE', KEYS[2], 0, -1, 'WITHSCORES')
for i = 1, #entries, 2 do
  spent = spent + tonumber(string.match(entries[i], '^([^:]+)'))
end
if spent + cost > budget then
  local oldest = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
  if oldest[2] then return math.max(1, tonumber(oldest[2]) + 600000 - now) end
  return 1000
end

if reserve then
  redis.call('ZADD', KEYS[1], now, member)
  redis.call('ZADD', KEYS[2], now, cost .. ':' .. member)
  redis.call('PEXPIRE', KEYS[1], 120000)
  redis.call('PEXPIRE', KEYS[2], 1200000)
end
return 0
`;

async function runReserve(costUsd: number, reserve: boolean): Promise<number> {
  try {
    const redis = getRedisConnection();
    const member = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const result = await Promise.race([
      redis.eval(
        RESERVE_SCRIPT,
        3,
        RPM_KEY,
        SPEND_KEY,
        COOLDOWN_KEY,
        String(Date.now()),
        String(GEMINI_MAX_RPM),
        String(GEMINI_SPEND_LIMIT_USD),
        String(costUsd),
        member,
        reserve ? "1" : "0"
      ),
      new Promise<number>((resolve) => setTimeout(() => resolve(0), 2000)), // Redis unreachable: fail open
    ]);
    return Number(result) || 0;
  } catch (err) {
    console.warn("[gemini-rate-limiter] Redis unavailable, not limiting:", err);
    return 0;
  }
}

/** Milliseconds until one call of this cost could start (0 = now). Reserves nothing. */
export async function geminiCapacityWaitMs(costUsd: number): Promise<number> {
  return runReserve(costUsd, false);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits (up to maxWaitMs) until this call fits under the limits, then reserves it.
 * Throws GeminiCapacityError if it still doesn't fit in time.
 */
export async function acquireGeminiCapacity(costUsd: number, maxWaitMs = 240_000): Promise<void> {
  const started = Date.now();
  for (;;) {
    const waitMs = await runReserve(costUsd, true);
    if (waitMs <= 0) return;
    const elapsed = Date.now() - started;
    if (elapsed + waitMs > maxWaitMs) throw new GeminiCapacityError(waitMs);
    // Jitter so waiting workers don't all retry in the same instant.
    await sleep(Math.min(waitMs, 5000) + Math.floor(Math.random() * 500));
  }
}

/** After a 429 from Gemini: pause every caller for a while before the next call. */
export async function noteGeminiRateLimited(cooldownMs = DEFAULT_COOLDOWN_MS): Promise<void> {
  try {
    await getRedisConnection().set(COOLDOWN_KEY, "1", "PX", cooldownMs);
  } catch {
    // ignore: limiter is best-effort
  }
}

/** True for a Gemini "too many requests / quota exhausted" error. */
export function isGeminiRateLimitError(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number | string; message?: string } | null;
  return (
    e?.statusCode === 429 ||
    e?.status === 429 ||
    e?.status === "RESOURCE_EXHAUSTED" ||
    /RESOURCE_EXHAUSTED|\b429\b/.test(String(e?.message ?? ""))
  );
}
