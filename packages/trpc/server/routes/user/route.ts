import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { User } from "@repo/database";
import { getPresignedUploadUrl } from "@repo/services";

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
});
