/**
 * Local development without AI keys only (AI_OFFLINE_FALLBACK=1): generation may use offline
 * stand-ins (the seller's photo on a studio background, template text, a generic scene).
 * Never in production: a seller must not be charged for a stand-in, so there a failed AI call
 * fails the listing and the credits are refunded.
 */
export function aiOfflineFallbackAllowed(): boolean {
  return process.env.AI_OFFLINE_FALLBACK === "1" && process.env.NODE_ENV !== "production";
}
