import { describe, it, expect, vi } from "vitest";

vi.mock("razorpay", () => ({ default: class {} }));
vi.mock("@repo/database", () => ({ Payment: {}, User: {}, CreditLedger: {} }));

import { CREDIT_PACKS, getTopupPricePaise, TOPUP_MIN_CREDITS } from "../payment.service";
import { TRIAL_CREDITS, calculateGenerationCredits, RE_EDIT_CREDIT_COST } from "../credit.service";

/**
 * The landing page shows the first four packs from a client copy
 * (apps/web/lib/credit-packs.ts). This table MUST stay identical to the one in
 * apps/web/lib/credit-packs.test.ts so the landing page never advertises a price
 * different from what Razorpay charges.
 */
const EXPECTED_LANDING = [
  { id: "trial", credits: 15, priceRupees: 499, perCreditRupees: 33.27 },
  { id: "starter", credits: 40, priceRupees: 1199, perCreditRupees: 29.98 },
  { id: "standard", credits: 100, priceRupees: 2499, perCreditRupees: 24.99 },
  { id: "pro", credits: 250, priceRupees: 5499, perCreditRupees: 22.0 },
];

// Worst-case AI cost per used credit is ~₹18-19; no pack may sell a credit below this floor.
const MIN_PER_CREDIT_PAISE = 2000;

describe("credit packs", () => {
  it("keeps the stable pack ids (stored on Payment records and Razorpay notes)", () => {
    expect(CREDIT_PACKS.map((p) => p.id)).toEqual(["trial", "starter", "standard", "pro", "business_s", "business_l"]);
  });

  it("matches the landing-page copy for the first four packs", () => {
    expect(
      CREDIT_PACKS.slice(0, 4).map(({ id, credits, priceRupees, perCreditRupees }) => ({ id, credits, priceRupees, perCreditRupees }))
    ).toEqual(EXPECTED_LANDING);
  });

  for (const pack of CREDIT_PACKS) {
    it(`${pack.id}: charge, display price and per-credit figure agree`, () => {
      expect(pack.amountPaise).toBe(pack.priceRupees * 100);
      expect(Number.isInteger(pack.amountPaise)).toBe(true);
      expect(pack.perCreditRupees).toBe(Math.round((pack.priceRupees / pack.credits) * 100) / 100);
    });

    it(`${pack.id}: never sells a credit below the ₹20 cost floor`, () => {
      expect(pack.amountPaise / pack.credits).toBeGreaterThanOrEqual(MIN_PER_CREDIT_PAISE - 0.5);
    });

    it(`${pack.id}: is never more expensive than buying the same credits as a top-up`, () => {
      expect(pack.amountPaise).toBeLessThanOrEqual(getTopupPricePaise(pack.credits));
    });
  }

  it("bigger packs are cheaper per credit", () => {
    const perCredit = CREDIT_PACKS.map((p) => p.amountPaise / p.credits);
    for (let i = 1; i < perCredit.length; i++) expect(perCredit[i]!).toBeLessThan(perCredit[i - 1]!);
  });

  it("the smallest custom top-up costs at least as much as the entry pack", () => {
    expect(getTopupPricePaise(TOPUP_MIN_CREDITS)).toBeGreaterThanOrEqual(CREDIT_PACKS[0]!.amountPaise);
  });
});

describe("free trial", () => {
  it("gives 3 credits: exactly one Quick listing plus one re-edit", () => {
    expect(TRIAL_CREDITS).toBe(3);
    expect(calculateGenerationCredits("listing_product", 1) + RE_EDIT_CREDIT_COST).toBe(TRIAL_CREDITS);
  });
});
