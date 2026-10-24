import { describe, it, expect, vi, beforeEach } from "vitest";

const SESSION = { id: "txn" } as any;
const m = vi.hoisted(() => ({
  listingFindOneAndUpdate: vi.fn(),
  listingUpdateOne: vi.fn(),
  ledgerExists: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
  runInTransaction: vi.fn(),
}));

vi.mock("@repo/database", async () => {
  const { Types } = await vi.importActual<any>("../../database/node_modules/mongoose");
  return {
    Types,
    ListingObject: {
      findOneAndUpdate: (...a: unknown[]) => m.listingFindOneAndUpdate(...a),
      updateOne: (...a: unknown[]) => m.listingUpdateOne(...a),
    },
    CreditLedger: {
      exists: (...a: unknown[]) => ({ session: () => Promise.resolve(m.ledgerExists(...a)) }),
    },
    runInTransaction: (fn: (s: unknown) => unknown) => m.runInTransaction(fn),
    isDuplicateKeyError: (e: any) => e?.code === 11000,
  };
});
vi.mock("../credit.service", () => ({
  deductCredits: (...a: unknown[]) => m.deductCredits(...a),
  refundCredits: (...a: unknown[]) => m.refundCredits(...a),
}));

import {
  chargeAndClaimListing,
  refundListingCharge,
  chargeAndClaimReEdit,
  refundReEditCharge,
  ListingBusyError,
} from "../charges.service";

const IMAGE_ID = "665f1f77bcf86cd799439011";

describe("charges (one transaction per flow)", () => {
  beforeEach(() => {
    for (const fn of Object.values(m)) fn.mockReset();
    m.runInTransaction.mockImplementation((fn: (s: unknown) => unknown) => fn(SESSION));
    m.deductCredits.mockResolvedValue({ success: true, newBalance: 7 });
    m.refundCredits.mockResolvedValue({ success: true, newBalance: 13 });
    m.listingUpdateOne.mockResolvedValue({ matchedCount: 1 });
    m.ledgerExists.mockReturnValue(null);
  });

  it("start generation: deduction and listing claim run in the SAME transaction", async () => {
    m.listingFindOneAndUpdate.mockResolvedValue({ _id: "l1" });
    const res = await chargeAndClaimListing({
      listingObjectId: "l1",
      userId: "u1",
      claimFilter: { status: "uploaded" },
      set: { userTitle: "Bag", userDescription: undefined },
      credits: 6,
      description: "Generation",
    });
    expect(res.newBalance).toBe(7);
    expect(m.runInTransaction).toHaveBeenCalledTimes(1);
    expect(m.deductCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 6, session: SESSION }));
    const [filter, update, opts] = m.listingFindOneAndUpdate.mock.calls[0]!;
    expect(filter).toEqual({ _id: "l1", userId: "u1", status: "uploaded" });
    expect(update.$set).toMatchObject({ userTitle: "Bag", status: "queued", creditsCharged: 6, creditsRefunded: false });
    // An omitted field is cleared, exactly like assigning undefined and saving did before
    expect(update.$unset).toMatchObject({ userDescription: 1, generationStage: 1, errorMessage: 1 });
    expect(opts).toEqual({ new: true, session: SESSION });
  });

  it("start generation: if the claim doesn't match, it throws so the transaction rolls the deduction back", async () => {
    m.listingFindOneAndUpdate.mockResolvedValue(null);
    await expect(
      chargeAndClaimListing({ listingObjectId: "l1", userId: "u1", claimFilter: {}, set: {}, credits: 6, description: "x" })
    ).rejects.toBeInstanceOf(ListingBusyError);
    expect(m.refundCredits).not.toHaveBeenCalled(); // rollback, not a compensating refund
  });

  it("without a transaction (dev only) a failed claim refunds the deduction explicitly", async () => {
    m.runInTransaction.mockImplementation((fn: (s: unknown) => unknown) => fn(null));
    m.listingFindOneAndUpdate.mockResolvedValue(null);
    await expect(
      chargeAndClaimListing({ listingObjectId: "l1", userId: "u1", claimFilter: {}, set: {}, credits: 6, description: "x" })
    ).rejects.toBeInstanceOf(ListingBusyError);
    expect(m.refundCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 6 }));
  });

  it("free retry (credits 0) claims without charging", async () => {
    m.listingFindOneAndUpdate.mockResolvedValue({ _id: "l1" });
    await chargeAndClaimListing({ listingObjectId: "l1", userId: "u1", claimFilter: {}, set: {}, credits: 0, description: "x" });
    expect(m.deductCredits).not.toHaveBeenCalled();
    expect(m.listingFindOneAndUpdate.mock.calls[0]![1].$set).not.toHaveProperty("creditsCharged");
  });

  it("refund: flips creditsRefunded and refunds in one transaction, exactly once", async () => {
    m.listingFindOneAndUpdate.mockResolvedValueOnce({ _id: "l1", userId: "u1", creditsCharged: 6, userTitle: "Bag" });
    const first = await refundListingCharge({ listingObjectId: "l1", reason: "failed", errorMessage: "boom", retryCount: 2 });
    expect(first).toEqual({ refunded: true, amount: 6 });
    const [filter, update, opts] = m.listingFindOneAndUpdate.mock.calls[0]!;
    expect(filter).toEqual({ _id: "l1", creditsRefunded: { $ne: true }, creditsCharged: { $gt: 0 } });
    expect(update.$set).toEqual({ creditsRefunded: true, status: "failed", errorMessage: "boom", retryCount: 2 });
    expect(opts).toEqual({ new: true, session: SESSION });
    expect(m.refundCredits).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", amount: 6, session: SESSION }));

    // A second call (job re-run, reconciler) matches nothing and refunds nothing
    m.listingFindOneAndUpdate.mockResolvedValueOnce(null);
    expect(await refundListingCharge({ listingObjectId: "l1", reason: "failed" })).toEqual({ refunded: false, amount: 0 });
    expect(m.refundCredits).toHaveBeenCalledTimes(1);
  });

  it("re-edit: one in-flight re-edit per listing, charged in the same transaction as the claim", async () => {
    m.listingFindOneAndUpdate.mockResolvedValue({ _id: "l1" });
    const res = await chargeAndClaimReEdit({
      listingObjectId: "l1",
      userId: "u1",
      generatedImageId: IMAGE_ID,
      credits: 1,
      description: "Re-edit",
    });
    expect(res.chargeId).toMatch(/^[a-f0-9]{24}$/);
    const [filter, update, opts] = m.listingFindOneAndUpdate.mock.calls[0]!;
    expect(JSON.stringify(filter.$or)).toContain('"reEditStatus.status":{"$ne":"processing"}');
    expect(update.$set.reEditStatus).toMatchObject({ status: "processing", chargeId: res.chargeId });
    expect(opts).toEqual({ new: true, session: SESSION });
    expect(m.deductCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 1, session: SESSION }));

    m.listingFindOneAndUpdate.mockResolvedValue(null);
    await expect(
      chargeAndClaimReEdit({ listingObjectId: "l1", userId: "u1", generatedImageId: IMAGE_ID, credits: 1, description: "x" })
    ).rejects.toBeInstanceOf(ListingBusyError);
  });

  it("re-edit refund: keyed per charge; a duplicate is rejected and reported as not refunded", async () => {
    const res = await refundReEditCharge({
      listingObjectId: "l1",
      userId: "u1",
      credits: 1,
      chargeId: "c1",
      errorMessage: "failed",
      description: "Refund",
    });
    expect(res).toEqual({ refunded: true });
    expect(m.refundCredits).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "reedit-refund:c1", session: SESSION })
    );
    expect(m.listingUpdateOne).toHaveBeenCalledWith(
      { _id: "l1", "reEditStatus.chargeId": "c1" },
      expect.anything(),
      { session: SESSION }
    );

    // Already refunded: fast path
    m.ledgerExists.mockReturnValue({ _id: "row" });
    expect((await refundReEditCharge({ listingObjectId: "l1", userId: "u1", credits: 1, chargeId: "c1", errorMessage: "x", description: "x" })).refunded).toBe(false);

    // Concurrent duplicate: the unique index rejects it
    m.ledgerExists.mockReturnValue(null);
    m.refundCredits.mockRejectedValueOnce(Object.assign(new Error("E11000"), { code: 11000 }));
    expect((await refundReEditCharge({ listingObjectId: "l1", userId: "u1", credits: 1, chargeId: "c1", errorMessage: "x", description: "x" })).refunded).toBe(false);
  });
});
