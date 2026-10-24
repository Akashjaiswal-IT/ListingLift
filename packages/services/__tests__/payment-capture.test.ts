import { describe, it, expect, vi, beforeEach } from "vitest";

const SESSION = { id: "txn" } as any;
const m = vi.hoisted(() => ({
  paymentFindOne: vi.fn(),
  paymentFindOneAndUpdate: vi.fn(),
  ledgerExists: vi.fn(),
  addCredits: vi.fn(),
  grantReferral: vi.fn(),
  runInTransaction: vi.fn(),
}));

const chain = (value: unknown) => {
  const p: any = Promise.resolve(value);
  p.session = () => Promise.resolve(value);
  return p;
};

vi.mock("@repo/database", () => ({
  Payment: {
    findOne: (...a: unknown[]) => chain(m.paymentFindOne(...a)),
    findOneAndUpdate: (...a: unknown[]) => m.paymentFindOneAndUpdate(...a),
  },
  User: { findById: () => ({ select: () => Promise.resolve({ creditBalance: 99 }) }) },
  CreditLedger: { exists: (...a: unknown[]) => chain(m.ledgerExists(...a)) },
  runInTransaction: (fn: (s: unknown) => unknown) => m.runInTransaction(fn),
  isDuplicateKeyError: (e: any) => e?.code === 11000,
}));
vi.mock("../credit.service", () => ({ addCredits: (...a: unknown[]) => m.addCredits(...a) }));
vi.mock("../referral.service", () => ({ grantReferralRewardOnFirstPurchase: (...a: unknown[]) => m.grantReferral(...a) }));
vi.mock("../payment.service", () => ({ getPackDisplayName: (id: string, n: number) => `${id} (${n})` }));

import { capturePaymentAndGrantCredits } from "../payment-capture.service";

const payment = (over: Record<string, unknown> = {}) => ({
  _id: "pay1",
  userId: "u1",
  status: "created",
  packId: "trial",
  creditsPurchased: 15,
  ...over,
});

describe("capturePaymentAndGrantCredits", () => {
  beforeEach(() => {
    for (const fn of Object.values(m)) fn.mockReset();
    m.runInTransaction.mockImplementation((fn: (s: unknown) => unknown) => fn(SESSION));
    m.addCredits.mockResolvedValue(18);
    m.grantReferral.mockResolvedValue(undefined);
    m.ledgerExists.mockReturnValue(null);
  });

  it("captures, credits and pays the referral in ONE transaction", async () => {
    m.paymentFindOne.mockReturnValue(payment());
    m.paymentFindOneAndUpdate.mockResolvedValue(payment({ status: "captured" }));

    const res = await capturePaymentAndGrantCredits({ razorpayOrderId: "order_1", razorpayPaymentId: "pay_x", userId: "u1" });

    expect(res).toEqual({ outcome: "captured", creditsAdded: 15, newBalance: 18, userId: "u1" });
    expect(m.runInTransaction).toHaveBeenCalledTimes(1);
    expect(m.paymentFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "pay1", status: { $ne: "captured" } },
      { $set: { status: "captured", razorpayPaymentId: "pay_x" } },
      { new: true, session: SESSION }
    );
    expect(m.addCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        amount: 15,
        type: "PURCHASE",
        idempotencyKey: "purchase:pay1",
        session: SESSION,
      })
    );
    expect(m.grantReferral).toHaveBeenCalledWith("u1", SESSION);
  });

  it("an already captured and credited payment is never credited again", async () => {
    m.paymentFindOne.mockReturnValue(payment({ status: "captured" }));
    m.ledgerExists.mockReturnValue({ _id: "row" });

    const res = await capturePaymentAndGrantCredits({ razorpayOrderId: "order_1" });

    expect(res.outcome).toBe("already_captured");
    expect(m.addCredits).not.toHaveBeenCalled();
    expect(m.grantReferral).not.toHaveBeenCalled();
  });

  it("repairs a payment captured earlier but never credited (the old bug)", async () => {
    m.paymentFindOne.mockReturnValue(payment({ status: "captured" }));
    m.ledgerExists.mockReturnValue(null); // neither a keyed nor a legacy purchase row

    const res = await capturePaymentAndGrantCredits({ razorpayOrderId: "order_1" });

    expect(res.outcome).toBe("captured");
    expect(m.paymentFindOneAndUpdate).not.toHaveBeenCalled();
    expect(m.addCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 15, idempotencyKey: "purchase:pay1" }));
  });

  it("checks legacy purchase rows (no idempotency key) by reference before repairing", async () => {
    m.paymentFindOne.mockReturnValue(payment({ status: "captured" }));
    m.ledgerExists.mockReturnValueOnce(null).mockReturnValueOnce({ _id: "legacy-row" });

    const res = await capturePaymentAndGrantCredits({ razorpayOrderId: "order_1" });

    expect(res.outcome).toBe("already_captured");
    expect(m.ledgerExists).toHaveBeenLastCalledWith({
      userId: "u1",
      referenceId: "pay1",
      referenceType: "payment",
      type: "PURCHASE",
    });
    expect(m.addCredits).not.toHaveBeenCalled();
  });

  it("a concurrent double credit is rejected by the unique purchase key", async () => {
    m.paymentFindOne.mockReturnValue(payment());
    m.paymentFindOneAndUpdate.mockResolvedValue(payment({ status: "captured" }));
    m.addCredits.mockRejectedValue(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }));

    const res = await capturePaymentAndGrantCredits({ razorpayOrderId: "order_1" });
    expect(res.outcome).toBe("already_captured");
  });

  it("only the owner's payment can be captured from the browser path", async () => {
    m.paymentFindOne.mockReturnValue(null);
    const res = await capturePaymentAndGrantCredits({ razorpayOrderId: "order_1", userId: "someone-else" });
    expect(m.paymentFindOne).toHaveBeenCalledWith({ razorpayOrderId: "order_1", userId: "someone-else" });
    expect(res.outcome).toBe("not_found");
  });

  it("any other failure propagates, so the whole transaction rolls back and Razorpay retries", async () => {
    m.paymentFindOne.mockReturnValue(payment());
    m.paymentFindOneAndUpdate.mockResolvedValue(payment({ status: "captured" }));
    m.grantReferral.mockRejectedValue(new Error("db down"));
    await expect(capturePaymentAndGrantCredits({ razorpayOrderId: "order_1" })).rejects.toThrow("db down");
  });
});
