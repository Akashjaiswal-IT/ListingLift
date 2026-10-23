import { describe, it, expect, vi, beforeEach } from "vitest";

const findById = vi.fn();
const findOne = vi.fn();
const findOneAndUpdate = vi.fn();
const addCredits = vi.fn();

vi.mock("@repo/database", () => ({
  User: {
    findById: (...a: unknown[]) => findById(...a),
    findOne: (...a: unknown[]) => findOne(...a),
    findOneAndUpdate: (...a: unknown[]) => findOneAndUpdate(...a),
  },
  CreditLedger: {},
  DEFAULT_CARD_SETTINGS: { language: "en", cod: false, freeDelivery: false, easyReturns: false, madeInIndia: false },
}));

vi.mock("@repo/services", () => ({
  getPresignedUploadUrl: vi.fn(),
  addCredits: (...a: unknown[]) => addCredits(...a),
  REFERRAL_BONUS_CREDITS: 3,
}));

import { userRouter } from "../server/routes/user/route";

const caller = () =>
  userRouter.createCaller({ clerkUserId: "clerk_new", user: { _id: "new1", clerkId: "clerk_new" }, auth: null } as any);

const newUser = (over: Record<string, unknown> = {}) => ({
  _id: "new1",
  clerkId: "clerk_new",
  referralCode: "PESH-NEW111",
  createdAt: new Date(),
  ...over,
});

describe("user.applyReferralCode", () => {
  beforeEach(() => {
    for (const fn of [findById, findOne, findOneAndUpdate, addCredits]) fn.mockReset();
    findById.mockResolvedValue(newUser());
    findOne.mockResolvedValue({ _id: "ref1", clerkId: "clerk_ref", fullName: "Ravi", referredBy: null });
    findOneAndUpdate.mockResolvedValue({ _id: "new1" });
  });

  it("links the referrer but gives the invited seller no extra credits", async () => {
    const res = await caller().applyReferralCode({ code: "pesh-ref111" });
    expect(res).toEqual({ success: true, creditsAwarded: 0, referrerName: "Ravi" });
    expect(findOne).toHaveBeenCalledWith({ referralCode: "PESH-REF111" });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "new1" }),
      { $set: { referredBy: "clerk_ref" } },
      { new: true }
    );
    expect(addCredits).not.toHaveBeenCalled();
  });

  it("still rejects an own code, a second code and accounts older than 48 hours", async () => {
    await expect(caller().applyReferralCode({ code: "PESH-NEW111" })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    findById.mockResolvedValue(newUser({ referredBy: "clerk_other" }));
    await expect(caller().applyReferralCode({ code: "PESH-REF111" })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    findById.mockResolvedValue(newUser({ createdAt: new Date(Date.now() - 49 * 3600 * 1000) }));
    await expect(caller().applyReferralCode({ code: "PESH-REF111" })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(findOneAndUpdate).not.toHaveBeenCalled();
    expect(addCredits).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for an unknown code", async () => {
    findOne.mockResolvedValue(null);
    await expect(caller().applyReferralCode({ code: "PESH-NOPE00" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
