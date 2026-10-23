import { describe, it, expect } from "vitest";
import {
  calculateGenerationCredits,
  calculateProQualitySurcharge,
  RE_EDIT_CREDIT_COST,
} from "../credit.service";

/**
 * These tests pin the credit pricing rules. The web app keeps a mirror of this
 * logic in apps/web/lib/pricing.ts; the EXPECTED table below is intentionally
 * duplicated in that package's test so the two can never silently drift (the
 * exact bug we fixed in Phase 0, where the client quoted 6 but the server
 * charged 7 for a 5-photo kit).
 */
const EXPECTED: Array<{
  type: "listing_product" | "listing_kit";
  photos: number;
  credits: number;
  proCredits: number;
}> = [
  { type: "listing_product", photos: 1, credits: 2, proCredits: 4 },
  { type: "listing_kit", photos: 1, credits: 5, proCredits: 6 },
  { type: "listing_kit", photos: 2, credits: 5, proCredits: 7 },
  { type: "listing_kit", photos: 3, credits: 6, proCredits: 9 },
  { type: "listing_kit", photos: 4, credits: 6, proCredits: 10 },
  { type: "listing_kit", photos: 5, credits: 7, proCredits: 12 },
];

describe("calculateGenerationCredits", () => {
  for (const row of EXPECTED) {
    it(`charges ${row.credits} for ${row.type} with ${row.photos} photo(s)`, () => {
      expect(calculateGenerationCredits(row.type, row.photos)).toBe(row.credits);
    });
  }

  it("quick product ignores photo count (always 2)", () => {
    expect(calculateGenerationCredits("listing_product", 99)).toBe(2);
  });

  for (const row of EXPECTED) {
    it(`charges ${row.proCredits} for ${row.type} with ${row.photos} photo(s) on Pro`, () => {
      expect(calculateGenerationCredits(row.type, row.photos, "pro")).toBe(row.proCredits);
    });

    it(`defaults to standard pricing for ${row.type} with ${row.photos} photo(s)`, () => {
      expect(calculateGenerationCredits(row.type, row.photos, "standard")).toBe(row.credits);
    });
  }

  it("Pro surcharge: Quick is 2, Kit is clamped to 1..5 main images", () => {
    expect(calculateProQualitySurcharge("listing_product", 4)).toBe(2);
    expect(calculateProQualitySurcharge("listing_kit", 0)).toBe(1);
    expect(calculateProQualitySurcharge("listing_kit", 3)).toBe(3);
    expect(calculateProQualitySurcharge("listing_kit", 9)).toBe(5);
  });

  it("re-edit costs exactly 1 credit", () => {
    expect(RE_EDIT_CREDIT_COST).toBe(1);
  });
});
