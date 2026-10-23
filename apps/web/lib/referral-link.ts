/**
 * Referral links: /signup?ref=PESH-XXXXXX
 *
 * The code from the link is remembered in this browser (localStorage) so it
 * survives the Clerk sign-up steps and Google sign-in redirects, then applied
 * once the new seller is signed in. The server still enforces every rule
 * (48-hour window, no self-referral, one referrer per account), so a stale or
 * bad code is simply rejected and forgotten.
 */

export const REFERRAL_PARAM = "ref";
const STORAGE_KEY = "peshkar_ref";
// A code from a link is kept for 30 days; after that the visitor is treated as un-referred.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Codes look like "PESH-AB12CD" (generated server-side).
const CODE_RE = /^PESH-[A-Z0-9]{1,12}$/;

/** Returns the code in canonical form, or null when it isn't a valid-looking referral code. */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** The link a seller shares: signing up through it applies their code automatically. */
export function buildReferralLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/signup?${REFERRAL_PARAM}=${encodeURIComponent(code)}`;
}

/** Reads a referral code from a URL query string ("?ref=..."), or null. */
export function referralCodeFromSearch(search: string): string | null {
  try {
    return normalizeReferralCode(new URLSearchParams(search).get(REFERRAL_PARAM));
  } catch {
    return null;
  }
}

export function saveReferralCode(code: string, now = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, savedAt: now }));
  } catch {
    // Storage blocked (private mode etc.) - the seller can still type the code by hand.
  }
}

/** The remembered code, or null when there is none, it is malformed, or it has expired. */
export function readReferralCode(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown; savedAt?: unknown };
    const code = normalizeReferralCode(typeof parsed.code === "string" ? parsed.code : null);
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : NaN;
    if (!code || !Number.isFinite(savedAt) || now - savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearReferralCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Server rejections that will never succeed on retry (already referred, own code, outside the
 * 48-hour window, unknown code): forget the code. Anything else (network, auth still loading,
 * server error) keeps it for the next page load.
 */
export function isPermanentReferralError(code: string | undefined): boolean {
  return code === "BAD_REQUEST" || code === "NOT_FOUND";
}
