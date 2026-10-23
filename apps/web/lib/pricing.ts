/**
 * Credit pricing — CLIENT COPY.
 *
 * The authoritative version lives in the backend:
 *   packages/services/credit.service.ts -> calculateGenerationCredits()
 *
 * The server is always the one that actually charges, so it is the source of
 * truth. This mirror exists only so the UI can show the correct number BEFORE
 * calling the server. If you change the rules, change BOTH places. (We can't
 * import the server function directly because @repo/services pulls in Mongoose
 * and other Node-only code that must not end up in the browser bundle.)
 *
 * Previously the UI hard-coded "5 photos = 6 credits" while the server charged
 * 7, so users were quoted the wrong price. Keeping the formula here, in one
 * named function, prevents that drift.
 */
export const RE_EDIT_CREDIT_COST = 1;

export type QualityMode = "standard" | "pro";

// Pro upgrades each main white image (2K + extra attempt + extra thinking); a 2+ photo kit gets one per photo, otherwise exactly one.
export function calculateProQualitySurcharge(
  type: "listing_product" | "listing_kit",
  imageCount: number
): number {
  if (type === "listing_product") return 1;
  return Math.min(5, Math.max(1, imageCount));
}

export function calculateGenerationCredits(
  type: "listing_product" | "listing_kit",
  imageCount: number,
  qualityMode: QualityMode = "standard"
): number {
  const surcharge = qualityMode === "pro" ? calculateProQualitySurcharge(type, imageCount) : 0;
  if (type === "listing_product") return 2 + surcharge; // Quick Generate
  if (imageCount <= 3) return 5 + surcharge;
  if (imageCount === 4) return 6 + surcharge;
  return 7 + surcharge; // 5 photos
}
