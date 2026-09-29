import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { Payment, User } from "@repo/database";
import { createOrder, verifyPaymentSignature, addCredits } from "@repo/services";

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

      // Atomic transition: only transition if not already captured (prevents race conditions with webhook)
      const updatedPayment = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          status: { $ne: "captured" },
        },
        {
          $set: {
            status: "captured",
            razorpayPaymentId,
            razorpaySignature,
          },
        },
        { new: true }
      );

      // If updatedPayment is null, the webhook already processed and credited this order
      if (!updatedPayment) {
        const user = await User.findById(ctx.user._id);
        return {
          success: true,
          newBalance: user?.creditBalance ?? 0,
          creditsAdded: payment.creditsPurchased,
        };
      }

      // Add credits via unified ledger service with accurate balanceAfter
      const newBalance = await addCredits({
        userId: ctx.user._id,
        amount: payment.creditsPurchased,
        type: "PURCHASE",
        description: `Purchased ${payment.packId.toUpperCase()} pack (${payment.creditsPurchased} credits)`,
        referenceId: String(payment._id),
        referenceType: "payment",
      });

      return {
        success: true,
        newBalance,
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
