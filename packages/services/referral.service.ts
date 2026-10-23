import { User, CreditLedger } from "@repo/database";
import { Types } from "mongoose";
import { addCredits } from "./credit.service";

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
 * The "claim" below is atomic: findOneAndUpdate only matches while
 * referralRewardGranted is still false and flips it true in one operation, so
 * concurrent purchase webhooks can't double-pay the referrer.
 *
 * Safe to call on every successful payment — it no-ops when there is nothing to
 * grant (no referrer, already granted, self-referral, or cap reached).
 */
export async function grantReferralRewardOnFirstPurchase(
  invitedUserId: Types.ObjectId | string
): Promise<void> {
  const claimed = await User.findOneAndUpdate(
    {
      _id: invitedUserId,
      referredBy: { $exists: true, $nin: [null, ""] },
      referralRewardGranted: { $ne: true },
    },
    { $set: { referralRewardGranted: true } },
    { new: true }
  );

  if (!claimed || !claimed.referredBy) return;

  const referrer = await User.findOne({ clerkId: claimed.referredBy });
  // Guard against self-referral and a missing referrer account.
  if (!referrer || String(referrer._id) === String(claimed._id)) return;
  // Cap by number of rewarded invites (not credits), so old 5-credit and new 3-credit rewards count the same.
  if ((referrer.referralCount || 0) >= MAX_REWARDED_REFERRALS) return;

  const redeemedUnderOldOffer = await CreditLedger.exists({
    userId: claimed._id,
    type: "BONUS",
    description: LEGACY_WELCOME_BONUS_PREFIX,
  });
  const amount = redeemedUnderOldOffer ? LEGACY_REFERRAL_BONUS_CREDITS : REFERRAL_BONUS_CREDITS;

  await Promise.all([
    addCredits({
      userId: String(referrer._id),
      amount,
      type: "BONUS",
      description: `Referral reward — ${claimed.fullName || "your invite"} made their first purchase`,
    }),
    User.findByIdAndUpdate(referrer._id, {
      $inc: { referralCount: 1, referralCreditsEarned: amount },
    }),
  ]);
}
