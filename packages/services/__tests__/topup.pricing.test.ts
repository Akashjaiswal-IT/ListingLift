import { describe, it, expect, vi, beforeEach } from "vitest";

const { ordersCreate, paymentCreate } = vi.hoisted(() => ({
  ordersCreate: vi.fn(),
  paymentCreate: vi.fn(),
}));

vi.mock("razorpay", () => ({
  default: class {
    orders = { create: ordersCreate };
  },
}));
vi.mock("@repo/database", () => ({ Payment: { create: paymentCreate } }));

import {
  createOrder,
  getTopupPricePaise,
  getPackDisplayName,
  TOPUP_MIN_CREDITS,
  TOPUP_MAX_CREDITS,
} from "../payment.service";

/**
 * This EXPECTED table MUST stay identical to the one in the web test
 * (apps/web/lib/topup-pricing.test.ts). If the server tiers change and the web
 * mirror isn't updated, one of the two files fails - the drift we want to catch.
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

describe("getTopupPricePaise", () => {
  for (const row of EXPECTED) {
    it(`quotes ₹${row.rupees} for ${row.credits} credits`, () => {
      expect(getTopupPricePaise(row.credits)).toBe(row.rupees * 100);
    });
  }

  it("keeps the 15 - 2000 limits (15 so no top-up costs less than the ₹499 entry pack)", () => {
    expect(TOPUP_MIN_CREDITS).toBe(15);
    expect(TOPUP_MAX_CREDITS).toBe(2000);
  });
});

describe("createOrder (custom top-up)", () => {
  beforeEach(() => {
    ordersCreate.mockReset();
    paymentCreate.mockReset();
    ordersCreate.mockResolvedValue({ id: "order_test_1" });
    paymentCreate.mockResolvedValue({});
  });

  it("charges exactly qty x tier price and records the same credits", async () => {
    const order = await createOrder({ userId: "u1", packId: "topup", topupQuantity: 220 });

    expect(order.amountPaise).toBe(220 * 2500);
    expect(order.credits).toBe(220);
    expect(ordersCreate.mock.calls[0]![0].amount).toBe(220 * 2500);
    expect(paymentCreate.mock.calls[0]![0]).toMatchObject({
      packId: "topup",
      creditsPurchased: 220,
      topupQuantity: 220,
      amountPaise: 220 * 2500,
    });
  });

  it("accepts the 2000 maximum and the 15 minimum", async () => {
    expect((await createOrder({ userId: "u1", packId: "topup", topupQuantity: 2000 })).credits).toBe(2000);
    expect((await createOrder({ userId: "u1", packId: "topup", topupQuantity: 15 })).credits).toBe(15);
  });

  for (const bad of [2001, 14, 10, 15.5, 0, -5, NaN, undefined]) {
    it(`rejects ${String(bad)} without calling Razorpay or saving anything`, async () => {
      await expect(
        createOrder({ userId: "u1", packId: "topup", topupQuantity: bad as number })
      ).rejects.toThrow(/between 15 and 2000/);
      expect(ordersCreate).not.toHaveBeenCalled();
      expect(paymentCreate).not.toHaveBeenCalled();
    });
  }

  it("charges named packs from the pack table", async () => {
    const order = await createOrder({ userId: "u1", packId: "pro" });
    expect(order.amountPaise).toBe(549900);
    expect(order.credits).toBe(250);
    expect(paymentCreate.mock.calls[0]![0]).toMatchObject({ packId: "pro", creditsPurchased: 250, amountPaise: 549900 });
  });

  it("rejects an unknown pack without calling Razorpay", async () => {
    await expect(createOrder({ userId: "u1", packId: "business_m" })).rejects.toThrow(/Invalid pack/);
    expect(ordersCreate).not.toHaveBeenCalled();
  });
});

describe("getPackDisplayName", () => {
  it("names custom top-ups and keeps named packs", () => {
    expect(getPackDisplayName("topup", 220)).toBe("Custom top-up (220 credits)");
    expect(getPackDisplayName("pro", 200)).toBe("PRO pack (200 credits)");
  });
});
