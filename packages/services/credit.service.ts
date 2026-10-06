import { User, CreditLedger } from "@repo/database";
import { Types } from "mongoose";

export class InsufficientCreditsError extends Error {
  constructor(message = "Insufficient credit balance") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export function calculateGenerationCredits(
  type: "listing_product" | "listing_kit",
  imageCount: number
): number {
  if (type === "listing_product") {
    return 2; // Quick Generate: 2 credits
  }

  // Listing Kit: 3 photos = 5, 4 photos = 6, 5 photos = 7
  if (imageCount <= 3) return 5;
  if (imageCount === 4) return 6;
  return 7;
}

export const RE_EDIT_CREDIT_COST = 1;

/**
 * Insert one immutable ledger row. Called AFTER the user's balance has been
 * updated atomically, with the post-update balance passed in as `balanceAfter`.
 * Because each row is its own document, there is no second save() on the user
 * and no race on a running-balance field.
 */
async function recordLedgerEntry(params: {
  userId: Types.ObjectId | string;
  type: "PURCHASE" | "DEBIT" | "REFUND" | "BONUS" | "TRIAL";
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  referenceType?: "payment" | "listing_object" | "re_edit";
}): Promise<void> {
  await CreditLedger.create({
    userId: params.userId,
    type: params.type,
    amount: params.amount,
    balanceAfter: params.balanceAfter,
    description: params.description,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    createdAt: new Date(),
  });
}

export async function deductCredits(params: {
  userId: Types.ObjectId | string;
  amount: number;
  description: string;
  referenceId?: string;
  referenceType?: "payment" | "listing_object" | "re_edit";
}): Promise<{ success: boolean; newBalance: number }> {
  const { userId, amount, description, referenceId, referenceType } = params;

  if (amount <= 0) {
    const user = await User.findById(userId);
    return { success: true, newBalance: user?.creditBalance ?? 0 };
  }

  // Atomically check balance and deduct. The `creditBalance >= amount` filter
  // means two concurrent requests can never both overdraw the same balance.
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, creditBalance: { $gte: amount } },
    { $inc: { creditBalance: -amount, lifetimeCreditsSpent: amount } },
    { new: true }
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
  });

  return { success: true, newBalance: updatedUser.creditBalance };
}

export async function refundCredits(params: {
  userId: Types.ObjectId | string;
  amount: number;
  description: string;
  referenceId?: string;
  referenceType?: "payment" | "listing_object" | "re_edit";
}): Promise<{ success: boolean; newBalance: number }> {
  const { userId, amount, description, referenceId, referenceType } = params;

  if (amount <= 0) {
    const user = await User.findById(userId);
    return { success: true, newBalance: user?.creditBalance ?? 0 };
  }

  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { creditBalance: amount, lifetimeCreditsSpent: -amount } },
    { new: true }
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
  });

  return { success: true, newBalance: user.creditBalance };
}

export async function addCredits(params: {
  userId: Types.ObjectId | string;
  amount: number;
  type: "PURCHASE" | "BONUS" | "TRIAL";
  description: string;
  referenceId?: string;
  referenceType?: "payment" | "listing_object" | "re_edit";
}): Promise<number> {
  const { userId, amount, type, description, referenceId, referenceType } = params;

  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { creditBalance: amount, lifetimeCreditsEarned: amount } },
    { new: true }
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
  });

  return user.creditBalance;
}
