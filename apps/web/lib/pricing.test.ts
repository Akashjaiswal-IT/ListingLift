import { describe, it, expect } from "vitest";
import { calculateGenerationCredits, RE_EDIT_CREDIT_COST } from "./pricing";

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
}> = [
  { type: "listing_product", photos: 1, credits: 2 },
  { type: "listing_kit", photos: 1, credits: 5 },
  { type: "listing_kit", photos: 2, credits: 5 },
  { type: "listing_kit", photos: 3, credits: 5 },
  { type: "listing_kit", photos: 4, credits: 6 },
  { type: "listing_kit", photos: 5, credits: 7 },
];

describe("web pricing mirror", () => {
  for (const row of EXPECTED) {
    it(`quotes ${row.credits} for ${row.type} with ${row.photos} photo(s)`, () => {
      expect(calculateGenerationCredits(row.type, row.photos)).toBe(row.credits);
    });
  }

  it("re-edit cost matches the backend (1)", () => {
    expect(RE_EDIT_CREDIT_COST).toBe(1);
  });
});
