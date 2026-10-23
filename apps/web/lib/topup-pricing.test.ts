import { describe, it, expect } from "vitest";
import {
  getTopupPriceRupees,
  CUSTOM_SLIDER_MIN,
  CUSTOM_SLIDER_MAX,
  CUSTOM_SLIDER_STEP,
} from "./topup-pricing";

/**
 * This EXPECTED table MUST stay identical to the one in the backend test
 * (packages/services/__tests__/topup.pricing.test.ts). If the server tiers
 * change and lib/topup-pricing.ts isn't updated, one of the two fails.
 */
const EXPECTED: Array<{ credits: number; rupees: number }> = [
  { credits: 15, rupees: 510 },
  { credits: 39, rupees: 1326 },
  { credits: 40, rupees: 1200 },
  { credits: 99, rupees: 2970 },
  { credits: 100, rupees: 2500 },
  { credits: 249, rupees: 6225 },
  { credits: 250, rupees: 5500 },
  { credits: 499, rupees: 10978 },
  { credits: 500, rupees: 10500 },
  { credits: 999, rupees: 20979 },
  { credits: 1000, rupees: 20000 },
];

describe("web top-up pricing mirror", () => {
  for (const row of EXPECTED) {
    it(`quotes ₹${row.rupees} for ${row.credits} credits`, () => {
      expect(getTopupPriceRupees(row.credits)).toBe(row.rupees);
    });
  }

  it("keeps the slider at 15 - 1,000 in steps of 5", () => {
    expect(CUSTOM_SLIDER_MIN).toBe(15);
    expect(CUSTOM_SLIDER_MAX).toBe(1000);
    expect(CUSTOM_SLIDER_STEP).toBe(5);
  });

  it("the slider can reach every tier boundary and its default of 220", () => {
    for (const qty of [40, 100, 250, 500, 1000, 220]) {
      expect((qty - CUSTOM_SLIDER_MIN) % CUSTOM_SLIDER_STEP).toBe(0);
    }
  });

  it("quotes 220 credits (the slider default) at ₹5,500", () => {
    expect(getTopupPriceRupees(220)).toBe(5500);
  });
});
