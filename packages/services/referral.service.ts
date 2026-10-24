import { User, CreditLedger } from "@repo/database";
import type { Types, ClientSession } from "mongoose";

/** Credits the REFERRER earns once an invited seller makes their first purchase. */
export const REFERRAL_BONUS_CREDITS = 3;
/**
 * Invites redeemed under the old "give 5, get 5" offer were promised 5 credits for the referrer.
 * Those invitees are recognisable by the old welcome-bonus ledger entry, so their referrer still gets 5.
 */
export const LEGACY_REFERRAL_BONUS_CREDITS = 5;
const LEGACY_WELCOME_BONUS_PREFIX = /^Referral welcome bonus/;
// A referrer can earn from at most this many successful invites. A hard cap
// limits the blast radius if someone finds a way around the other checks.
export const MAX_REWARDED_REFERRALS = 100;

/**
 * Pay the REFERRER for an invited user — but only after that invited user has
 * actually made a purchase, and only once.
 *
 * Why gate on purchase? If the referrer were paid the moment a code is redeemed,
 * an attacker could create N throwaway accounts, redeem their own code N times,
 * and mint free credits. Requiring the invited account to pay real money
 * before the referrer earns anything makes farming unprofitable.
 *
 * Called INSIDE the purchase transaction (pass its `session`), so "first purchase committed"
 * and "referrer paid" happen together or not at all. Every step is conditional:
 *  - the invited user's referralRewardGranted flag flips false -> true atomically (pays once);
 *  - the referrer is credited in ONE update whose filter also enforces the invite cap;
 *  - the ledger row carries a unique idempotency key, so the database rejects a second reward.
 *
 * Safe to call on every successful payment — it no-ops when there is nothing to
 * grant (no referrer, already granted, self-referral, or cap reached).
 */
export async function grantReferralRewardOnFirstPurchase(
  invitedUserId: Types.ObjectId | string,
  session: ClientSession | null = null
): Promise<void> {
  const claimed = await User.findOneAndUpdate(
    {
      _id: invitedUserId,
      referredBy: { $exists: true, $nin: [null, ""] },
      referralRewardGranted: { $ne: true },
    },
    { $set: { referralRewardGranted: true } },
    { new: true, session }
  );

  if (!claimed || !claimed.referredBy) return;

  const referrer = await User.findOne({ clerkId: claimed.referredBy }).session(session);
  // Guard against self-referral and a missing referrer account.
  if (!referrer || String(referrer._id) === String(claimed._id)) return;

  const redeemedUnderOldOffer = await CreditLedger.exists({
    userId: claimed._id,
    type: "BONUS",
    description: LEGACY_WELCOME_BONUS_PREFIX,
  }).session(session);
  const amount = redeemedUnderOldOffer ? LEGACY_REFERRAL_BONUS_CREDITS : REFERRAL_BONUS_CREDITS;

  // Cap check and credit in one atomic update: a referrer at the cap is simply not matched.
  const paid = await User.findOneAndUpdate(
    {
      _id: referrer._id,
      $or: [{ referralCount: { $lt: MAX_REWARDED_REFERRALS } }, { referralCount: { $exists: false } }],
    },
    {
      $inc: {
        creditBalance: amount,
        lifetimeCreditsEarned: amount,
        referralCount: 1,
        referralCreditsEarned: amount,
      },
    },
    { new: true, session }
  );
  if (!paid) return;

  await CreditLedger.create(
    [
      {
        userId: paid._id,
        type: "BONUS",
        amount,
        balanceAfter: paid.creditBalance,
        description: `Referral reward — ${claimed.fullName || "your invite"} made their first purchase`,
        referenceId: String(claimed._id),
        referenceType: "referral",
        idempotencyKey: `referral:${claimed._id}`,
        createdAt: new Date(),
      },
    ],
    { session }
  );
}
