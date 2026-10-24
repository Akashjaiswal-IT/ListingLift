import { User, CreditLedger } from "@repo/database";
import type { Types, ClientSession } from "mongoose";

export class InsufficientCreditsError extends Error {
  constructor(message = "Insufficient credit balance") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

type QualityMode = "standard" | "pro";

/** Credits every new account starts with: enough for one Quick listing (2) plus one re-edit (1). */
export const TRIAL_CREDITS = 3;

// Pro upgrades each main white image (2K + up to 3 attempts + extra thinking). Quick Pro is +2 because
// its single Pro slot can use 3 attempts at the 2K price; a Kit adds one per photo (one Pro image each), clamped 1..5.
export function calculateProQualitySurcharge(
  type: "listing_product" | "listing_kit",
  imageCount: number
): number {
  if (type === "listing_product") return 2;
  return Math.min(5, Math.max(1, imageCount));
}

export function calculateGenerationCredits(
  type: "listing_product" | "listing_kit",
  imageCount: number,
  qualityMode: QualityMode = "standard"
): number {
  const surcharge = qualityMode === "pro" ? calculateProQualitySurcharge(type, imageCount) : 0;

  if (type === "listing_product") {
    return 2 + surcharge; // Quick Generate: 2 credits
  }

  // Listing Kit: 1-2 photos = 5, 3-4 photos = 6 (6 studio images), 5 photos = 7
  if (imageCount <= 2) return 5 + surcharge;
  if (imageCount <= 4) return 6 + surcharge;
  return 7 + surcharge;
}

export const RE_EDIT_CREDIT_COST = 1;

type ReferenceType = "payment" | "listing_object" | "re_edit" | "referral";

/**
 * Insert one immutable ledger row. Called AFTER the user's balance has been
 * updated atomically, with the post-update balance passed in as `balanceAfter`.
 * Pass the same `session` as the balance update so both commit together (or neither does).
 */
async function recordLedgerEntry(params: {
  userId: Types.ObjectId | string;
  type: "PURCHASE" | "DEBIT" | "REFUND" | "BONUS" | "TRIAL";
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  referenceType?: ReferenceType;
  idempotencyKey?: string;
  session?: ClientSession | null;
}): Promise<void> {
  await CreditLedger.create(
    [
      {
        userId: params.userId,
        type: params.type,
        amount: params.amount,
        balanceAfter: params.balanceAfter,
        description: params.description,
        referenceId: params.referenceId,
        referenceType: params.referenceType,
        ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
        createdAt: new Date(),
      },
    ],
    { session: params.session ?? null }
  );
}

interface CreditOpParams {
  userId: Types.ObjectId | string;
  amount: number;
  description: string;
  referenceId?: string;
  referenceType?: ReferenceType;
  /** Makes the ledger row exactly-once: a second write with the same key is rejected by a unique index. */
  idempotencyKey?: string;
  /** Run inside this transaction (see runInTransaction). */
  session?: ClientSession | null;
}

export async function deductCredits(params: CreditOpParams): Promise<{ success: boolean; newBalance: number }> {
  const { userId, amount, description, referenceId, referenceType, idempotencyKey, session = null } = params;

  if (amount <= 0) {
    const user = await User.findById(userId).session(session);
    return { success: true, newBalance: user?.creditBalance ?? 0 };
  }

  // Atomically check balance and deduct. The `creditBalance >= amount` filter
  // means two concurrent requests can never both overdraw the same balance.
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, creditBalance: { $gte: amount } },
    { $inc: { creditBalance: -amount, lifetimeCreditsSpent: amount } },
    { new: true, session }
  );

  if (!updatedUser) {
    throw new InsufficientCreditsError(
      `Insufficient credits. Required: ${amount}. Please purchase a credit pack.`
    );
  }

  await recordLedgerEntry({
    userId,
    type: "DEBIT",
    amount: -amount,
    balanceAfter: updatedUser.creditBalance,
    description,
    referenceId,
    referenceType,
    idempotencyKey,
    session,
  });

  return { success: true, newBalance: updatedUser.creditBalance };
}

export async function refundCredits(params: CreditOpParams): Promise<{ success: boolean; newBalance: number }> {
  const { userId, amount, description, referenceId, referenceType, idempotencyKey, session = null } = params;

  if (amount <= 0) {
    const user = await User.findById(userId).session(session);
    return { success: true, newBalance: user?.creditBalance ?? 0 };
  }

  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { creditBalance: amount, lifetimeCreditsSpent: -amount } },
    { new: true, session }
  );

  if (!user) throw new Error("User not found for refund");

  await recordLedgerEntry({
    userId,
    type: "REFUND",
    amount,
    balanceAfter: user.creditBalance,
    description,
    referenceId,
    referenceType,
    idempotencyKey,
    session,
  });

  return { success: true, newBalance: user.creditBalance };
}

export async function addCredits(
  params: CreditOpParams & { type: "PURCHASE" | "BONUS" | "TRIAL" }
): Promise<number> {
  const { userId, amount, type, description, referenceId, referenceType, idempotencyKey, session = null } = params;

  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { creditBalance: amount, lifetimeCreditsEarned: amount } },
    { new: true, session }
  );

  if (!user) throw new Error("User not found to add credits");

  await recordLedgerEntry({
    userId,
    type,
    amount,
    balanceAfter: user.creditBalance,
    description,
    referenceId,
    referenceType,
    idempotencyKey,
    session,
  });

  return user.creditBalance;
}
