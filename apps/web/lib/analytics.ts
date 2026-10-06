import posthog from "posthog-js";

export type AnalyticsEvent =
  | "photos_uploaded"
  | "listing_generation_started"
  | "listing_generation_completed"
  | "listing_generation_failed"
  | "listing_downloaded"
  | "listing_copied"
  | "listing_text_regenerated"
  | "checkout_opened"
  | "checkout_completed"
  | "checkout_failed";

/**
 * Type-safe analytics tracking helper for PostHog.
 * Safely executes in client-side code and does nothing if PostHog isn't initialized or placeholder keys are used.
 */
export function trackEvent(
  event: AnalyticsEvent | (string & {}),
  properties?: Record<string, unknown>
) {
  if (typeof window !== "undefined" && posthog && posthog.__loaded) {
    posthog.capture(event, properties);
  }
}

/**
 * Report a caught error to PostHog's error tracking.
 *
 * PostHog is initialised with `capture_exceptions: true`, so UNHANDLED errors
 * are already captured automatically. Use this for errors you CATCH (and
 * therefore swallow) but still want visibility into — e.g. a failed upload the
 * user retried, or a non-fatal fallback path. `context` is attached as extra
 * properties so you can see what the user was doing when it happened.
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (typeof window === "undefined" || !posthog || !posthog.__loaded) return;
  const err = error instanceof Error ? error : new Error(String(error));
  posthog.captureException(err, context);
}
