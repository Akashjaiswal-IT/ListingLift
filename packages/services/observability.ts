/**
 * Server-side error capture to PostHog.
 *
 * The browser uses posthog-js (capture_exceptions), but the API and worker run
 * in Node. Rather than add the posthog-node SDK, we reuse the same fire-and-
 * forget HTTP pattern as ai-observability.ts: POST an `$exception` event to
 * PostHog's capture endpoint. Fully non-blocking and fail-safe — observability
 * must never crash or slow down the thing it's observing.
 */
export function captureServerException(
  error: unknown,
  context?: {
    distinctId?: string;
    [key: string]: unknown;
  }
): void {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_API_KEY;
  if (!apiKey || apiKey.includes("placeholder") || apiKey.includes("YOUR_POSTHOG_KEY")) {
    return;
  }

  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ||
    process.env.POSTHOG_HOST ||
    "https://us.i.posthog.com";

  const err = error instanceof Error ? error : new Error(String(error));
  const { distinctId, ...extra } = context || {};

  try {
    fetch(`${host.replace(/\/$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event: "$exception",
        distinct_id: distinctId || "system",
        timestamp: new Date().toISOString(),
        properties: {
          // Shape PostHog's error tracking understands.
          $exception_list: [
            {
              type: err.name,
              value: err.message,
              stacktrace: { type: "raw", frames: [] },
            },
          ],
          $exception_message: err.message,
          $exception_type: err.name,
          $exception_stack_trace_raw: err.stack,
          ...extra,
        },
      }),
    }).catch(() => {});
  } catch {
    // never throw from telemetry
  }
}
