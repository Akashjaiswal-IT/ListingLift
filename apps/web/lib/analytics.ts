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
