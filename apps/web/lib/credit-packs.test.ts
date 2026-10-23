import { describe, it, expect } from "vitest";
import { LANDING_PACKS, formatPackPrice } from "./credit-packs";

/**
 * This table MUST stay identical to EXPECTED_LANDING in the backend test
 * (packages/services/__tests__/credit-packs.test.ts). If the server packs change and
 * this copy isn't updated, one of the two fails - so the landing page can never
 * advertise a price different from what is charged.
 */
const EXPECTED_LANDING = [
  { id: "trial", credits: 15, priceRupees: 499, perCreditRupees: 33.27 },
  { id: "starter", credits: 40, priceRupees: 1199, perCreditRupees: 29.98 },
  { id: "standard", credits: 100, priceRupees: 2499, perCreditRupees: 24.99 },
  { id: "pro", credits: 250, priceRupees: 5499, perCreditRupees: 22.0 },
];

describe("landing page pack copy", () => {
  it("matches the server packs", () => {
    expect(LANDING_PACKS).toEqual(EXPECTED_LANDING);
  });

  it("formats prices the Indian way", () => {
    expect(formatPackPrice(LANDING_PACKS[0])).toBe("₹499");
    expect(formatPackPrice(LANDING_PACKS[3])).toBe("₹5,499");
  });
});
