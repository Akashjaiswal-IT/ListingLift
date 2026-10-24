import { Payment, User, CreditLedger, runInTransaction, isDuplicateKeyError } from "@repo/database";
import type { Types } from "mongoose";
import { addCredits } from "./credit.service";
import { getPackDisplayName } from "./payment.service";
import { grantReferralRewardOnFirstPurchase } from "./referral.service";

export interface CaptureResult {
  outcome: "captured" | "already_captured" | "not_found";
  creditsAdded: number;
  newBalance?: number;
  userId?: string;
}

/**
 * The ONE place a Razorpay payment becomes credits. Used by both the browser verification
 * (after its signature check) and the Razorpay webhook (after its signature check).
 *
 * Everything happens in a single transaction:
 *   payment status -> "captured"  +  user's credits  +  PURCHASE ledger row
 *   +  (first purchase of a referred user) the referrer's reward and its ledger row.
 * Either all of it commits or none of it does, so a crash or DB error can no longer leave a
 * payment "captured" without its credits (the old bug: every retry then skipped it).
 *
 * Exactly-once: the PURCHASE ledger row carries the unique key "purchase:<paymentId>", so even
 * concurrent or repeated calls can credit a payment only once. A payment found captured but
 * never credited (possible before this fix) is credited now.
 */
export async function capturePaymentAndGrantCredits(params: {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  razorpayMetadata?: Record<string, unknown>;
  /** When set, only this user's payment can be captured (browser verification path). */
  userId?: Types.ObjectId | string;
}): Promise<CaptureResult> {
  const ownerFilter = params.userId ? { userId: params.userId } : {};

  try {
    return await runInTransaction(async (session) => {
      const payment = await Payment.findOne({ razorpayOrderId: params.razorpayOrderId, ...ownerFilter }).session(session);
      if (!payment) return { outcome: "not_found", creditsAdded: 0 } satisfies CaptureResult;

      const paymentId = String(payment._id);
      const purchaseKey = `purchase:${paymentId}`;
      const already: CaptureResult = {
        outcome: "already_captured",
        creditsAdded: payment.creditsPurchased,
        userId: String(payment.userId),
      };

      if (payment.status === "captured") {
        // Older purchase rows have no idempotency key, so also match them by reference.
        const credited =
          (await CreditLedger.exists({ idempotencyKey: purchaseKey }).session(session)) ||
          (await CreditLedger.exists({
            userId: payment.userId,
            referenceId: paymentId,
            referenceType: "payment",
            type: "PURCHASE",
          }).session(session));
        if (credited) return already;
        // Captured but never credited: fall through and credit it now.
      } else {
        const updated = await Payment.findOneAndUpdate(
          { _id: payment._id, status: { $ne: "captured" } },
          {
            $set: {
              status: "captured",
              ...(params.razorpayPaymentId ? { razorpayPaymentId: params.razorpayPaymentId } : {}),
              ...(params.razorpaySignature ? { razorpaySignature: params.razorpaySignature } : {}),
              ...(params.razorpayMetadata ? { razorpayMetadata: params.razorpayMetadata } : {}),
            },
          },
          { new: true, session }
        );
        // Someone else captured it between our read and write (only possible without a transaction).
        if (!updated) return already;
      }

      const newBalance = await addCredits({
        userId: payment.userId,
        amount: payment.creditsPurchased,
        type: "PURCHASE",
        description: `Purchased ${getPackDisplayName(payment.packId, payment.creditsPurchased)}`,
        referenceId: paymentId,
        referenceType: "payment",
        idempotencyKey: purchaseKey,
        session,
      });

      // Same transaction: a referred user's first purchase pays their referrer exactly once.
      await grantReferralRewardOnFirstPurchase(payment.userId, session);

      return {
        outcome: "captured",
        creditsAdded: payment.creditsPurchased,
        newBalance,
        userId: String(payment.userId),
      } satisfies CaptureResult;
    });
  } catch (err) {
    // A concurrent call already credited this payment (its unique purchase key won).
    if (isDuplicateKeyError(err)) {
      const payment = await Payment.findOne({ razorpayOrderId: params.razorpayOrderId, ...ownerFilter });
      return {
        outcome: "already_captured",
        creditsAdded: payment?.creditsPurchased ?? 0,
        userId: payment ? String(payment.userId) : undefined,
      };
    }
    throw err;
  }
}

/** Current balance, for responses that report it after an "already captured" result. */
export async function getCreditBalance(userId: Types.ObjectId | string): Promise<number> {
  const user = await User.findById(userId).select("creditBalance");
  return user?.creditBalance ?? 0;
}
