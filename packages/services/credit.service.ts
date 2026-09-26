import { User, IUser } from "@repo/database";
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

  // Atomically check balance and deduct
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: userId,
      creditBalance: { $gte: amount },
    },
    {
      $inc: {
        creditBalance: -amount,
        lifetimeCreditsSpent: amount,
      },
      $push: {
        creditHistory: {
          type: "DEBIT",
          amount: -amount,
          balanceAfter: 0, // placeholder updated below
          description,
          referenceId,
          referenceType,
          createdAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!updatedUser) {
    throw new InsufficientCreditsError(
      `Insufficient credits. Required: ${amount}. Please purchase a credit pack.`
    );
  }

  // Fix balanceAfter in the latest entry
  const lastEntryIndex = updatedUser.creditHistory.length - 1;
  if (lastEntryIndex >= 0) {
    updatedUser.creditHistory[lastEntryIndex]!.balanceAfter = updatedUser.creditBalance;
    await updatedUser.save();
  }

  return {
    success: true,
    newBalance: updatedUser.creditBalance,
  };
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
    {
      $inc: {
        creditBalance: amount,
        lifetimeCreditsSpent: -amount,
      },
      $push: {
        creditHistory: {
          type: "REFUND",
          amount: amount,
          balanceAfter: 0,
          description,
          referenceId,
          referenceType,
          createdAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!user) throw new Error("User not found for refund");

  const lastEntryIndex = user.creditHistory.length - 1;
  if (lastEntryIndex >= 0) {
    user.creditHistory[lastEntryIndex]!.balanceAfter = user.creditBalance;
    await user.save();
  }

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
    {
      $inc: {
        creditBalance: amount,
        lifetimeCreditsEarned: amount,
      },
      $push: {
        creditHistory: {
          type,
          amount,
          balanceAfter: 0,
          description,
          referenceId,
          referenceType,
          createdAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!user) throw new Error("User not found to add credits");

  const lastEntryIndex = user.creditHistory.length - 1;
  if (lastEntryIndex >= 0) {
    user.creditHistory[lastEntryIndex]!.balanceAfter = user.creditBalance;
    await user.save();
  }

  return user.creditBalance;
}
