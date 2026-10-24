import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { Payment, User } from "@repo/database";
import {
  createOrder,
  verifyPaymentSignature,
  addCredits,
  grantReferralRewardOnFirstPurchase,
  generateReceiptPdf,
  getPackDisplayName,
  TOPUP_MIN_CREDITS,
  TOPUP_MAX_CREDITS,
} from "@repo/services";
import { LEGAL_POLICY_VERSION } from "../../../legal";

export const paymentsRouter = router({
  createOrder: protectedProcedure
    .input(
      z
        .object({
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
          topupQuantity: z.number().int().min(TOPUP_MIN_CREDITS).max(TOPUP_MAX_CREDITS).optional(),
          legalPolicyVersion: z.literal(LEGAL_POLICY_VERSION),
        })
        .refine((v) => v.packId !== "topup" || v.topupQuantity !== undefined, {
          message: "Please choose how many credits to buy",
          path: ["topupQuantity"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createOrder({
          userId: ctx.user._id,
          packId: input.packId,
          topupQuantity: input.topupQuantity,
          legalPolicyVersion: input.legalPolicyVersion,
        });
      } catch (err: any) {
        // Validation problems (bad quantity / unknown pack) are the caller's to fix
        if (/Custom top-up|Invalid pack/.test(err?.message || "")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
        throw err;
      }
    }),

  verifyPayment: protectedProcedure
    .input(
      z.object({
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string(),
      }),
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

      // Fast-path idempotency check: if already captured, return success immediately
      if (payment.status === "captured") {
        const user = await User.findById(ctx.user._id);
        return {
          success: true,
          newBalance: user?.creditBalance ?? 0,
          creditsAdded: payment.creditsPurchased,
        };
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
        { new: true },
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
        description: `Purchased ${getPackDisplayName(payment.packId, payment.creditsPurchased)}`,
        referenceId: String(payment._id),
        referenceType: "payment",
      });

      // If this buyer was invited by someone, pay that referrer now (once).
      // Non-blocking: a referral hiccup must never fail a real payment.
      grantReferralRewardOnFirstPurchase(ctx.user._id).catch(() => {});

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
      }),
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

  // Generate a payment-receipt PDF for a captured payment. Returns it as a
  // base64 data URI so the browser can download it directly — no extra storage
  // or download-proxy changes needed (receipts are a few KB).
  getInvoice: protectedProcedure
    .input(z.object({ paymentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const payment = await Payment.findOne({
        _id: input.paymentId,
        userId: ctx.user._id,
      });

      if (!payment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
      }
      if (payment.status !== "captured") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A receipt is only available for successful payments.",
        });
      }

      const receiptNumber = `RCPT-${new Date(payment.createdAt).getFullYear()}-${String(payment._id).slice(-8).toUpperCase()}`;

      const pdf = await generateReceiptPdf(
        {
          receiptNumber,
          date: payment.createdAt,
          razorpayOrderId: payment.razorpayOrderId,
          razorpayPaymentId: payment.razorpayPaymentId,
          packId: payment.packId,
          creditsPurchased: payment.creditsPurchased,
          amountPaise: payment.amountPaise,
          currency: payment.currency || "INR",
        },
        { name: ctx.user.fullName, email: ctx.user.email },
      );

      return {
        fileName: `${receiptNumber}.pdf`,
        dataUri: `data:application/pdf;base64,${pdf.toString("base64")}`,
      };
    }),
});
