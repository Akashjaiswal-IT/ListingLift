import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { Payment } from "@repo/database";
import {
  createOrder,
  verifyPaymentSignature,
  capturePaymentAndGrantCredits,
  getCreditBalance,
  generateReceiptPdf,
  TOPUP_MIN_CREDITS,
  TOPUP_MAX_CREDITS,
} from "@repo/services";
import { enforceRateLimit } from "../../rate-limit";

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
        })
        .refine((v) => v.packId !== "topup" || v.topupQuantity !== undefined, {
          message: "Please choose how many credits to buy",
          path: ["topupQuantity"],
        })
    )
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(ctx.user._id, "create_order", "checkout");
      try {
        return await createOrder({
          userId: ctx.user._id,
          packId: input.packId,
          topupQuantity: input.topupQuantity,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(ctx.user._id, "verify_payment", "payment verification");
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = input;

      const payment = await Payment.findOne({ razorpayOrderId, userId: ctx.user._id });
      if (!payment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order record not found" });
      }

      if (payment.status !== "captured") {
        const isValid = verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
        if (!isValid) {
          // Conditional: never overwrite a payment the webhook has already captured.
          await Payment.updateOne({ _id: payment._id, status: "created" }, { $set: { status: "failed" } });
          throw new TRPCError({ code: "BAD_REQUEST", message: "Payment signature verification failed" });
        }
      }

      // One transaction: payment captured + credits + ledger (+ referral reward). Idempotent with
      // the webhook, and it also credits a payment that was captured earlier but never credited.
      const result = await capturePaymentAndGrantCredits({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        userId: ctx.user._id,
      });
      if (result.outcome === "not_found") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order record not found" });
      }

      return {
        success: true,
        newBalance: result.newBalance ?? (await getCreditBalance(ctx.user._id)),
        creditsAdded: result.creditsAdded,
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
        { name: ctx.user.fullName, email: ctx.user.email }
      );

      return {
        fileName: `${receiptNumber}.pdf`,
        dataUri: `data:application/pdf;base64,${pdf.toString("base64")}`,
      };
    }),
});
