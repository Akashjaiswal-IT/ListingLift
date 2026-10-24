import { TRPCError } from "@trpc/server";
import { checkRateLimit, type RateLimitAction } from "@repo/services";

/** Throws TOO_MANY_REQUESTS when the caller is over the limit for `action`. */
export async function enforceRateLimit(userId: unknown, action: RateLimitAction, what: string): Promise<void> {
  const result = await checkRateLimit(String(userId), action);
  if (result && !result.allowed) {
    const minutes = Math.max(1, Math.ceil(result.resetInSeconds / 60));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many ${what} requests. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    });
  }
}
