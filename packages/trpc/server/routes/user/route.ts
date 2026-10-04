import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { User } from "@repo/database";
import { getPresignedUploadUrl, addCredits } from "@repo/services";

export const userRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().min(1).optional(),
        phone: z.string().optional(),
        profileImageUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await User.findByIdAndUpdate(
        ctx.user._id,
        { $set: input },
        { new: true }
      );
      return user;
    }),

  updateSellerProfile: protectedProcedure
    .input(
      z.object({
        storeName: z.string().optional(),
        whatsappNumber: z.string().optional(),
        instagramHandle: z.string().optional(),
        logoUrl: z.string().url().optional().or(z.literal("")),
        defaultCta: z
          .object({
            text: z.string(),
            link: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await User.findByIdAndUpdate(
        ctx.user._id,
        {
          $set: {
            ...(input.storeName !== undefined ? { storeName: input.storeName } : {}),
            ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber } : {}),
            ...(input.instagramHandle !== undefined ? { instagramHandle: input.instagramHandle } : {}),
            ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
            ...(input.defaultCta !== undefined ? { defaultCta: input.defaultCta } : {}),
          },
        },
        { new: true }
      );
      return user;
    }),

  uploadLogo: protectedProcedure
    .input(
      z.object({
        mimeType: z.string().default("image/png"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const s3Key = `logos/${ctx.user._id}/logo-${Date.now()}`;
      return await getPresignedUploadUrl(s3Key, input.mimeType, 300);
    }),

  getCreditBalance: protectedProcedure.query(async ({ ctx }) => {
    const user = await User.findById(ctx.user._id);
    return {
      balance: user?.creditBalance ?? 0,
      lifetimeEarned: user?.lifetimeCreditsEarned ?? 0,
      lifetimeSpent: user?.lifetimeCreditsSpent ?? 0,
    };
  }),

  getCreditHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await User.findById(ctx.user._id);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const history = [...(user.creditHistory || [])].reverse().slice(0, input.limit);
      return history;
    }),

  getReferralStats: protectedProcedure.query(async ({ ctx }) => {
    let user = await User.findById(ctx.user._id);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    if (!user.referralCode) {
      user.referralCode = `PESH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await user.save();
    }

    return {
      referralCode: user.referralCode,
      referralCount: user.referralCount || 0,
      referralCreditsEarned: user.referralCreditsEarned || 0,
      referredBy: user.referredBy || null,
      bonusPerReferral: 5,
    };
  }),

  applyReferralCode: protectedProcedure
    .input(z.object({ code: z.string().trim().toUpperCase() }))
    .mutation(async ({ ctx, input }) => {
      const user = await User.findById(ctx.user._id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      if (user.referredBy) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already redeemed a referral code",
        });
      }

      if (user.referralCode === input.code) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot redeem your own referral code",
        });
      }

      const referrer = await User.findOne({ referralCode: input.code });
      if (!referrer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid referral code. Please check and try again.",
        });
      }

      if (referrer.referredBy === ctx.user.clerkId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Mutual referral loop is not permitted",
        });
      }

      // Atomic lock transition: only updates if referredBy is not yet set (prevents concurrent race conditions)
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          $or: [{ referredBy: { $exists: false } }, { referredBy: null }, { referredBy: "" }],
        },
        {
          $set: { referredBy: referrer.clerkId },
        },
        { new: true }
      );

      if (!updatedUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already redeemed a referral code",
        });
      }

      // Give 5 credits to both!
      const bonusCredits = 5;
      await Promise.all([
        addCredits({
          userId: String(user._id),
          amount: bonusCredits,
          type: "BONUS",
          description: `Referral welcome bonus (Invited by ${referrer.fullName || "Seller"})`,
        }),
        addCredits({
          userId: String(referrer._id),
          amount: bonusCredits,
          type: "BONUS",
          description: `Referral reward for inviting ${user.fullName || "new seller"}`,
        }),
        User.findByIdAndUpdate(referrer._id, {
          $inc: { referralCount: 1, referralCreditsEarned: bonusCredits },
        }),
      ]);

      return {
        success: true,
        creditsAwarded: bonusCredits,
        referrerName: referrer.fullName,
      };
    }),
});
