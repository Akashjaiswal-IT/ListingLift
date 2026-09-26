import { Router, Request, Response } from "express";
import { Webhook } from "svix";
import crypto from "crypto";
import { User, Payment, connectToDatabase } from "@repo/database";
import { logger } from "@repo/logger";

export const webhookRouter = Router();

// Clerk Webhook Handler
webhookRouter.post("/clerk", async (req: Request, res: Response) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.warn("CLERK_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  // Svix headers
  const svixId = req.headers["svix-id"] as string;
  const svixTimestamp = req.headers["svix-timestamp"] as string;
  const svixSignature = req.headers["svix-signature"] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({ error: "Missing svix headers" });
  }

  const rawBody = (req as any).rawBody
    ? (req as any).rawBody.toString("utf8")
    : JSON.stringify(req.body);

  const wh = new Webhook(webhookSecret);
  let evt: any;

  try {
    evt = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    logger.error("Error verifying Clerk webhook signature", { err });
    return res.status(400).json({ error: "Invalid signature" });
  }

  await connectToDatabase();
  const eventType = evt.type;

  try {
    if (eventType === "user.created") {
      const { id, email_addresses, first_name, last_name, image_url, phone_numbers } = evt.data;
      const primaryEmail = email_addresses?.[0]?.email_address || "";
      const fullName = [first_name, last_name].filter(Boolean).join(" ") || primaryEmail.split("@")[0] || "Seller";
      const phone = phone_numbers?.[0]?.phone_number;

      // Seed 10 trial credits
      const trialCredits = 10;

      const existingUser = await User.findOne({ clerkId: id });
      if (!existingUser) {
        await User.create({
          clerkId: id,
          fullName,
          email: primaryEmail,
          phone,
          profileImageUrl: image_url,
          creditBalance: trialCredits,
          lifetimeCreditsEarned: trialCredits,
          lifetimeCreditsSpent: 0,
          creditHistory: [
            {
              type: "TRIAL",
              amount: trialCredits,
              balanceAfter: trialCredits,
              description: "Welcome bonus trial credits",
              createdAt: new Date(),
            },
          ],
          role: "user",
        });
        logger.info(`User created and seeded with ${trialCredits} trial credits: ${id}`);
      }
    } else if (eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name, image_url, phone_numbers } = evt.data;
      const primaryEmail = email_addresses?.[0]?.email_address;
      const fullName = [first_name, last_name].filter(Boolean).join(" ");
      const phone = phone_numbers?.[0]?.phone_number;

      await User.findOneAndUpdate(
        { clerkId: id },
        {
          $set: {
            ...(fullName ? { fullName } : {}),
            ...(primaryEmail ? { email: primaryEmail } : {}),
            ...(phone ? { phone } : {}),
            ...(image_url ? { profileImageUrl: image_url } : {}),
          },
        }
      );
      logger.info(`User updated from Clerk: ${id}`);
    } else if (eventType === "user.deleted") {
      const { id } = evt.data;
      await User.deleteOne({ clerkId: id });
      logger.info(`User deleted from Clerk: ${id}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Error processing Clerk webhook event", { eventType, error });
    return res.status(500).json({ error: "Failed to process webhook" });
  }
});

// Razorpay Webhook Handler
webhookRouter.post("/razorpay", async (req: Request, res: Response) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    logger.warn("RAZORPAY_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ error: "Razorpay secret not configured" });
  }

  const signature = req.headers["x-razorpay-signature"] as string;
  if (!signature) {
    return res.status(400).json({ error: "Missing Razorpay signature" });
  }

  const rawBody = (req as any).rawBody
    ? (req as any).rawBody.toString("utf8")
    : JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (signature !== expectedSignature) {
    logger.error("Invalid Razorpay webhook signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  await connectToDatabase();
  const event = req.body.event;

  try {
    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = req.body.payload?.payment?.entity;
      const orderEntity = req.body.payload?.order?.entity;
      const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
      const razorpayPaymentId = paymentEntity?.id;

      if (!razorpayOrderId) {
        return res.status(400).json({ error: "Missing order ID in payload" });
      }

      const payment = await Payment.findOne({ razorpayOrderId });
      if (!payment) {
        logger.warn(`Payment record not found for order: ${razorpayOrderId}`);
        return res.status(200).json({ received: true });
      }

      // Idempotency check: if already captured, do not credit again
      if (payment.status === "captured") {
        return res.status(200).json({ received: true, alreadyCaptured: true });
      }

      payment.status = "captured";
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpayMetadata = req.body;
      await payment.save();

      // Atomically credit user
      await User.updateOne(
        { _id: payment.userId },
        {
          $inc: {
            creditBalance: payment.creditsPurchased,
            lifetimeCreditsEarned: payment.creditsPurchased,
          },
          $push: {
            creditHistory: {
              type: "PURCHASE",
              amount: payment.creditsPurchased,
              description: `Purchased ${payment.packId.toUpperCase()} pack (${payment.creditsPurchased} credits)`,
              referenceId: String(payment._id),
              referenceType: "payment",
              createdAt: new Date(),
            },
          },
        }
      );

      logger.info(
        `Successfully credited ${payment.creditsPurchased} credits to user ${payment.userId}`
      );
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Error processing Razorpay webhook", { error });
    return res.status(500).json({ error: "Processing failed" });
  }
});
