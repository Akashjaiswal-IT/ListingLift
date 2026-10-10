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
  { credits: 10, rupees: 250 },
  { credits: 29, rupees: 725 },
  { credits: 30, rupees: 600 },
  { credits: 79, rupees: 1580 },
  { credits: 80, rupees: 1360 },
  { credits: 199, rupees: 3383 },
  { credits: 200, rupees: 2800 },
  { credits: 499, rupees: 6986 },
  { credits: 500, rupees: 5500 },
  { credits: 1000, rupees: 11000 },
];

describe("web top-up pricing mirror", () => {
  for (const row of EXPECTED) {
    it(`quotes ₹${row.rupees} for ${row.credits} credits`, () => {
      expect(getTopupPriceRupees(row.credits)).toBe(row.rupees);
    });
  }

  it("keeps the slider at 10 - 1,000 in steps of 10", () => {
    expect(CUSTOM_SLIDER_MIN).toBe(10);
    expect(CUSTOM_SLIDER_MAX).toBe(1000);
    expect(CUSTOM_SLIDER_STEP).toBe(10);
  });

  it("quotes the example from the bug report: 220 credits = ₹3,080", () => {
    expect(getTopupPriceRupees(220)).toBe(3080);
  });
});
