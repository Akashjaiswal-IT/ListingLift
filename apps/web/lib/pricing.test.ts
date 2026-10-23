import { describe, it, expect } from "vitest";
import {
  calculateGenerationCredits,
  calculateProQualitySurcharge,
  RE_EDIT_CREDIT_COST,
} from "./pricing";

/**
 * This EXPECTED table MUST stay identical to the one in the backend test
 * (packages/services/__tests__/credit.pricing.test.ts). If the server pricing
 * changes and someone forgets to update lib/pricing.ts, one of these two test
 * files fails — which is exactly the drift we want to catch.
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

describe("web pricing mirror", () => {
  for (const row of EXPECTED) {
    it(`quotes ${row.credits} for ${row.type} with ${row.photos} photo(s)`, () => {
      expect(calculateGenerationCredits(row.type, row.photos)).toBe(row.credits);
    });
  }

  for (const row of EXPECTED) {
    it(`quotes ${row.proCredits} for ${row.type} with ${row.photos} photo(s) on Pro`, () => {
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

  it("re-edit cost matches the backend (1)", () => {
    expect(RE_EDIT_CREDIT_COST).toBe(1);
  });
});
