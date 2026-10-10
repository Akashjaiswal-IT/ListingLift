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

describe("getTopupPricePaise", () => {
  for (const row of EXPECTED) {
    it(`quotes ₹${row.rupees} for ${row.credits} credits`, () => {
      expect(getTopupPricePaise(row.credits)).toBe(row.rupees * 100);
    });
  }

  it("keeps the 10 - 2000 limits", () => {
    expect(TOPUP_MIN_CREDITS).toBe(10);
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

    expect(order.amountPaise).toBe(220 * 1400);
    expect(order.credits).toBe(220);
    expect(ordersCreate.mock.calls[0]![0].amount).toBe(220 * 1400);
    expect(paymentCreate.mock.calls[0]![0]).toMatchObject({
      packId: "topup",
      creditsPurchased: 220,
      topupQuantity: 220,
      amountPaise: 220 * 1400,
    });
  });

  it("accepts the 2000 maximum and the 10 minimum", async () => {
    expect((await createOrder({ userId: "u1", packId: "topup", topupQuantity: 2000 })).credits).toBe(2000);
    expect((await createOrder({ userId: "u1", packId: "topup", topupQuantity: 10 })).credits).toBe(10);
  });

  for (const bad of [2001, 9, 12.5, 0, -5, NaN, undefined]) {
    it(`rejects ${String(bad)} without calling Razorpay or saving anything`, async () => {
      await expect(
        createOrder({ userId: "u1", packId: "topup", topupQuantity: bad as number })
      ).rejects.toThrow(/between 10 and 2000/);
      expect(ordersCreate).not.toHaveBeenCalled();
      expect(paymentCreate).not.toHaveBeenCalled();
    });
  }

  it("leaves named packs unchanged", async () => {
    const order = await createOrder({ userId: "u1", packId: "pro" });
    expect(order.amountPaise).toBe(279900);
    expect(order.credits).toBe(200);
  });
});

describe("getPackDisplayName", () => {
  it("names custom top-ups and keeps named packs", () => {
    expect(getPackDisplayName("topup", 220)).toBe("Custom top-up (220 credits)");
    expect(getPackDisplayName("pro", 200)).toBe("PRO pack (200 credits)");
  });
});
