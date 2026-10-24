import { describe, it, expect, vi, beforeEach } from "vitest";

const { userFindOneAndUpdate, userFindOne, ledgerExists, ledgerCreate } = vi.hoisted(() => ({
  userFindOneAndUpdate: vi.fn(),
  userFindOne: vi.fn(),
  ledgerExists: vi.fn(),
  ledgerCreate: vi.fn(),
}));

// Mongoose queries are chainable with .session(); the mocks resolve to the stubbed value either way.
const chain = (value: unknown) => {
  const p: any = Promise.resolve(value);
  p.session = () => Promise.resolve(value);
  return p;
};

vi.mock("@repo/database", () => ({
  User: {
    findOneAndUpdate: (...a: unknown[]) => userFindOneAndUpdate(...a),
    findOne: (...a: unknown[]) => chain(userFindOne(...a)),
  },
  CreditLedger: {
    exists: (...a: unknown[]) => chain(ledgerExists(...a)),
    create: (...a: unknown[]) => ledgerCreate(...a),
  },
}));

import {
  grantReferralRewardOnFirstPurchase,
  REFERRAL_BONUS_CREDITS,
  LEGACY_REFERRAL_BONUS_CREDITS,
  MAX_REWARDED_REFERRALS,
} from "../referral.service";

const invited = { _id: "invited1", referredBy: "clerk_referrer", fullName: "Asha" };
const SESSION = { id: "txn" } as any;

describe("grantReferralRewardOnFirstPurchase", () => {
  beforeEach(() => {
    for (const fn of [userFindOneAndUpdate, userFindOne, ledgerExists, ledgerCreate]) fn.mockReset();
    // 1st findOneAndUpdate = claim on the invited user; 2nd = paying the referrer.
    userFindOneAndUpdate
      .mockResolvedValueOnce(invited)
      .mockResolvedValueOnce({ _id: "referrer1", creditBalance: 13 });
    userFindOne.mockReturnValue({ _id: "referrer1" });
    ledgerExists.mockReturnValue(null);
    ledgerCreate.mockResolvedValue([{}]);
  });

  it("pays the referrer 3 credits in one atomic update that also enforces the cap", async () => {
    expect(REFERRAL_BONUS_CREDITS).toBe(3);
    await grantReferralRewardOnFirstPurchase("invited1", SESSION);

    const [filter, update, opts] = userFindOneAndUpdate.mock.calls[1]!;
    expect(filter).toMatchObject({ _id: "referrer1" });
    expect(JSON.stringify(filter)).toContain(`"$lt":${MAX_REWARDED_REFERRALS}`);
    expect(update).toEqual({
      $inc: { creditBalance: 3, lifetimeCreditsEarned: 3, referralCount: 1, referralCreditsEarned: 3 },
    });
    expect(opts).toMatchObject({ session: SESSION });
  });

  it("writes one ledger row with a unique per-invite key, in the same transaction", async () => {
    await grantReferralRewardOnFirstPurchase("invited1", SESSION);
    const [[row], opts] = ledgerCreate.mock.calls[0]!;
    expect(row).toMatchObject({
      userId: "referrer1",
      type: "BONUS",
      amount: 3,
      balanceAfter: 13,
      referenceType: "referral",
      idempotencyKey: "referral:invited1",
    });
    expect(opts).toEqual({ session: SESSION });
  });

  it("honours the old 5-credit promise for invites redeemed under the old offer", async () => {
    ledgerExists.mockReturnValue({ _id: "ledger1" });
    await grantReferralRewardOnFirstPurchase("invited1", SESSION);
    expect(ledgerExists).toHaveBeenCalledWith({ userId: "invited1", type: "BONUS", description: expect.any(RegExp) });
    expect(userFindOneAndUpdate.mock.calls[1]![1].$inc.creditBalance).toBe(LEGACY_REFERRAL_BONUS_CREDITS);
  });

  it("claims the reward atomically so it is paid at most once", async () => {
    await grantReferralRewardOnFirstPurchase("invited1", SESSION);
    expect(userFindOneAndUpdate.mock.calls[0]).toEqual([
      expect.objectContaining({ _id: "invited1", referralRewardGranted: { $ne: true } }),
      { $set: { referralRewardGranted: true } },
      { new: true, session: SESSION },
    ]);
  });

  it("does nothing when the reward was already claimed or there is no referrer", async () => {
    userFindOneAndUpdate.mockReset().mockResolvedValueOnce(null);
    await grantReferralRewardOnFirstPurchase("invited1", SESSION);
    expect(ledgerCreate).not.toHaveBeenCalled();
    expect(userFindOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a self-referral or a missing referrer account", async () => {
    userFindOne.mockReturnValue({ _id: "invited1" });
    await grantReferralRewardOnFirstPurchase("invited1", SESSION);
    userFindOneAndUpdate.mockResolvedValueOnce(invited);
    userFindOne.mockReturnValue(null);
    await grantReferralRewardOnFirstPurchase("invited1", SESSION);
    expect(ledgerCreate).not.toHaveBeenCalled();
  });

  it("pays nothing (and writes no row) when the referrer is already at the cap", async () => {
    userFindOneAndUpdate.mockReset().mockResolvedValueOnce(invited).mockResolvedValueOnce(null);
    await grantReferralRewardOnFirstPurchase("invited1", SESSION);
    expect(ledgerCreate).not.toHaveBeenCalled();
  });
});
