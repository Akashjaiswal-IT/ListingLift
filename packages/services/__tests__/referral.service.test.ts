import { describe, it, expect, vi, beforeEach } from "vitest";

const { userFindOneAndUpdate, userFindOne, userFindByIdAndUpdate, ledgerExists, addCredits } = vi.hoisted(() => ({
  userFindOneAndUpdate: vi.fn(),
  userFindOne: vi.fn(),
  userFindByIdAndUpdate: vi.fn(),
  ledgerExists: vi.fn(),
  addCredits: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  User: {
    findOneAndUpdate: (...a: unknown[]) => userFindOneAndUpdate(...a),
    findOne: (...a: unknown[]) => userFindOne(...a),
    findByIdAndUpdate: (...a: unknown[]) => userFindByIdAndUpdate(...a),
  },
  CreditLedger: { exists: (...a: unknown[]) => ledgerExists(...a) },
}));
vi.mock("../credit.service", () => ({ addCredits: (...a: unknown[]) => addCredits(...a) }));

import {
  grantReferralRewardOnFirstPurchase,
  REFERRAL_BONUS_CREDITS,
  LEGACY_REFERRAL_BONUS_CREDITS,
  MAX_REWARDED_REFERRALS,
} from "../referral.service";

const invited = { _id: "invited1", referredBy: "clerk_referrer", fullName: "Asha" };
const referrer = (over: Record<string, unknown> = {}) => ({ _id: "referrer1", referralCount: 0, ...over });

describe("grantReferralRewardOnFirstPurchase", () => {
  beforeEach(() => {
    for (const fn of [userFindOneAndUpdate, userFindOne, userFindByIdAndUpdate, ledgerExists, addCredits]) fn.mockReset();
    userFindOneAndUpdate.mockResolvedValue(invited);
    userFindOne.mockResolvedValue(referrer());
    userFindByIdAndUpdate.mockResolvedValue({});
    ledgerExists.mockResolvedValue(null);
    addCredits.mockResolvedValue(10);
  });

  it("pays the referrer 3 credits for a new invite", async () => {
    expect(REFERRAL_BONUS_CREDITS).toBe(3);
    await grantReferralRewardOnFirstPurchase("invited1");
    expect(addCredits).toHaveBeenCalledWith(expect.objectContaining({ userId: "referrer1", amount: 3, type: "BONUS" }));
    expect(userFindByIdAndUpdate).toHaveBeenCalledWith("referrer1", { $inc: { referralCount: 1, referralCreditsEarned: 3 } });
  });

  it("honours the old 5-credit promise for invites redeemed under the old offer", async () => {
    ledgerExists.mockResolvedValue({ _id: "ledger1" });
    await grantReferralRewardOnFirstPurchase("invited1");
    expect(ledgerExists).toHaveBeenCalledWith({ userId: "invited1", type: "BONUS", description: expect.any(RegExp) });
    expect(addCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: LEGACY_REFERRAL_BONUS_CREDITS }));
    expect(userFindByIdAndUpdate).toHaveBeenCalledWith("referrer1", { $inc: { referralCount: 1, referralCreditsEarned: 5 } });
  });

  it("claims the reward atomically so it is paid at most once", async () => {
    await grantReferralRewardOnFirstPurchase("invited1");
    expect(userFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "invited1", referralRewardGranted: { $ne: true } }),
      { $set: { referralRewardGranted: true } },
      { new: true }
    );
  });

  it("does nothing when the reward was already claimed or there is no referrer", async () => {
    userFindOneAndUpdate.mockResolvedValue(null);
    await grantReferralRewardOnFirstPurchase("invited1");
    expect(addCredits).not.toHaveBeenCalled();
  });

  it("does nothing for a self-referral or a missing referrer account", async () => {
    userFindOne.mockResolvedValue(referrer({ _id: "invited1" }));
    await grantReferralRewardOnFirstPurchase("invited1");
    userFindOne.mockResolvedValue(null);
    await grantReferralRewardOnFirstPurchase("invited1");
    expect(addCredits).not.toHaveBeenCalled();
  });

  it("stops paying once the referrer reaches the cap of rewarded invites", async () => {
    userFindOne.mockResolvedValue(referrer({ referralCount: MAX_REWARDED_REFERRALS }));
    await grantReferralRewardOnFirstPurchase("invited1");
    expect(addCredits).not.toHaveBeenCalled();

    userFindOne.mockResolvedValue(referrer({ referralCount: MAX_REWARDED_REFERRALS - 1 }));
    await grantReferralRewardOnFirstPurchase("invited1");
    expect(addCredits).toHaveBeenCalledTimes(1);
  });
});
