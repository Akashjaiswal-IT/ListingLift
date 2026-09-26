import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { Payment, User } from "@repo/database";
import { createOrder, verifyPaymentSignature } from "@repo/services";

export const paymentsRouter = router({
  createOrder: protectedProcedure
    .input(
      z.object({
        packId: z.enum([
          "trial",
          "starter",
          "standard",
          "pro",
          "topup",
          "business_s",
          "business_m",
          "business_l",
        ]),
        topupQuantity: z.number().int().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await createOrder({
        userId: ctx.user._id,
        packId: input.packId,
        topupQuantity: input.topupQuantity,
      });

      return order;
    }),

  verifyPayment: protectedProcedure
    .input(
      z.object({
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = input;

      const payment = await Payment.findOne({
        razorpayOrderId,
        userId: ctx.user._id,
      });

      if (!payment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order record not found" });
      }

      // Idempotency: if already processed, return success immediately
      if (payment.status === "captured") {
        const user = await User.findById(ctx.user._id);
        return { success: true, newBalance: user?.creditBalance ?? 0 };
      }

      const isValid = verifyPaymentSignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      if (!isValid) {
        payment.status = "failed";
        await payment.save();
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payment signature verification failed",
        });
      }

      // Update payment record
      payment.status = "captured";
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      await payment.save();

      // Atomically add credits to User
      const updatedUser = await User.findOneAndUpdate(
        { _id: ctx.user._id },
        {
          $inc: {
            creditBalance: payment.creditsPurchased,
            lifetimeCreditsEarned: payment.creditsPurchased,
          },
          $push: {
            creditHistory: {
              type: "PURCHASE",
              amount: payment.creditsPurchased,
              balanceAfter: 0,
              description: `Purchased ${payment.packId.toUpperCase()} pack (${payment.creditsPurchased} credits)`,
              referenceId: String(payment._id),
              referenceType: "payment",
              createdAt: new Date(),
            },
          },
        },
        { new: true }
      );

      if (updatedUser) {
        const lastIdx = updatedUser.creditHistory.length - 1;
        if (lastIdx >= 0) {
          updatedUser.creditHistory[lastIdx]!.balanceAfter = updatedUser.creditBalance;
          await updatedUser.save();
        }
      }

      return {
        success: true,
        newBalance: updatedUser?.creditBalance ?? 0,
        creditsAdded: payment.creditsPurchased,
      };
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;

      const [payments, total] = await Promise.all([
        Payment.find({ userId: ctx.user._id })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(input.limit)
          .lean(),
        Payment.countDocuments({ userId: ctx.user._id }),
      ]);

      return {
        payments,
        total,
        page: input.page,
        limit: input.limit,
      };
    }),
});
