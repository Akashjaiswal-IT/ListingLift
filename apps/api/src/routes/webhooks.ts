import { Router, Request, Response } from "express";
import { Webhook } from "svix";
import crypto from "crypto";
import { User, Payment, ListingObject, CreditLedger, connectToDatabase } from "@repo/database";
import { addCredits, deleteObjectFromR2, grantReferralRewardOnFirstPurchase } from "@repo/services";
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

  const rawBodyBuf = (req as any).rawBody;
  if (!rawBodyBuf) {
    logger.error("[SECURITY] Clerk webhook received without rawBody buffer. Cryptographic verification rejected.");
    return res.status(400).json({ error: "Missing raw body buffer" });
  }
  const rawBody = rawBodyBuf.toString("utf8");

  const wh = new Webhook(webhookSecret);
  let evt: any;

  try {
    wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    evt = typeof req.body === "object" && req.body !== null && Object.keys(req.body).length > 0
      ? req.body
      : JSON.parse(rawBody);
  } catch (err) {
    logger.error("Error verifying Clerk webhook signature", { err });
    return res.status(400).json({ error: "Invalid signature" });
  }

  await connectToDatabase();
  const eventType = evt?.type;

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
        const createdUser = await User.create({
          clerkId: id,
          fullName,
          email: primaryEmail,
          phone,
          profileImageUrl: image_url,
          creditBalance: trialCredits,
          lifetimeCreditsEarned: trialCredits,
          lifetimeCreditsSpent: 0,
          role: "user",
        });
        // Record the trial grant in the append-only ledger.
        await CreditLedger.create({
          userId: createdUser._id,
          type: "TRIAL",
          amount: trialCredits,
          balanceAfter: trialCredits,
          description: "Welcome bonus trial credits",
          createdAt: new Date(),
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
      // Cascade delete: when a user is removed, their listings, uploaded/
      // generated files and payment records must go too. Leaving them behind is
      // both a storage leak and, under India's DPDP Act, a data-retention
      // violation (personal data kept after the account is gone).
      const user = await User.findOne({ clerkId: id });
      if (user) {
        const listings = await ListingObject.find({ userId: user._id }).lean();
        // Best-effort R2 cleanup — never let a storage hiccup block the DB delete.
        for (const listing of listings) {
          const keys: string[] = [];
          (listing.originalImages || []).forEach((img: any) => img?.s3Key && keys.push(img.s3Key));
          (listing.generatedImages || []).forEach((img: any) => img?.s3Key && keys.push(img.s3Key));
          [listing.whatsappCard, listing.instagramPost, listing.instagramStory].forEach(
            (c: any) => c?.s3Key && keys.push(c.s3Key)
          );
          for (const key of keys) {
            try {
              await deleteObjectFromR2(key);
            } catch (err) {
              logger.warn(`Failed to delete R2 object during user purge: ${key}`, { err });
            }
          }
        }
        await ListingObject.deleteMany({ userId: user._id });
        await Payment.deleteMany({ userId: user._id });
        await CreditLedger.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
      logger.info(`User and associated data deleted from Clerk: ${id}`);
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

  const rawBodyBuf = (req as any).rawBody;
  if (!rawBodyBuf) {
    logger.error("[SECURITY] Razorpay webhook received without rawBody buffer. Cryptographic verification rejected.");
    return res.status(400).json({ error: "Missing raw body buffer" });
  }
  const rawBody = rawBodyBuf.toString("utf8");

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedSignature, "utf8");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
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

      // Atomic transition: only transition if not already captured (prevents race conditions with client verify)
      const updatedPayment = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          status: { $ne: "captured" },
        },
        {
          $set: {
            status: "captured",
            razorpayPaymentId,
            razorpayMetadata: req.body,
          },
        },
        { new: true }
      );

      if (!updatedPayment) {
        logger.info(`Payment already captured for order: ${razorpayOrderId} (idempotent ignore)`);
        return res.status(200).json({ received: true, alreadyCaptured: true });
      }

      // Add credits via unified ledger service with accurate balanceAfter
      await addCredits({
        userId: payment.userId,
        amount: payment.creditsPurchased,
        type: "PURCHASE",
        description: `Purchased ${payment.packId.toUpperCase()} pack (${payment.creditsPurchased} credits)`,
        referenceId: String(payment._id),
        referenceType: "payment",
      });

      logger.info(
        `Successfully credited ${payment.creditsPurchased} credits to user ${payment.userId}`
      );

      // Pay the referrer (if any) now that this buyer has made a purchase.
      // Idempotent and non-blocking so it never jeopardises the webhook 200.
      grantReferralRewardOnFirstPurchase(payment.userId).catch(() => {});
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Error processing Razorpay webhook", { error });
    return res.status(500).json({ error: "Processing failed" });
  }
});

// =======================================================
// Meta WhatsApp Cloud API Webhook Endpoints
// =======================================================

/**
 * Meta Webhook Verification Handshake
 * Triggered when configuring webhook URL in Meta App Dashboard
 */
webhookRouter.get("/whatsapp", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "peshkar_ai_webhook_secret";

  if (mode === "subscribe" && token === verifyToken) {
    logger.info("[WHATSAPP WEBHOOK] Handshake verified successfully with Meta");
    return res.status(200).send(challenge);
  }

  logger.warn("[WHATSAPP WEBHOOK] Verification token mismatch or invalid mode", { mode, token });
  return res.status(403).json({ error: "Verification token mismatch" });
});

/**
 * Meta WhatsApp Message Ingestion Webhook
 * Receives messages, images, and statuses from sellers on WhatsApp
 */
webhookRouter.post("/whatsapp", async (req: Request, res: Response) => {
  // Optional Meta HMAC signature verification if WHATSAPP_APP_SECRET is configured
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const signature = req.headers["x-hub-signature-256"] as string;
    const rawBodyBuf = (req as any).rawBody;
    if (signature && rawBodyBuf) {
      const expectedSig = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBodyBuf).digest("hex")}`;
      if (signature !== expectedSig) {
        logger.warn("[WHATSAPP WEBHOOK] Invalid signature rejected");
        return res.status(403).json({ error: "Invalid signature" });
      }
    }
  }

  // Acknowledge Meta immediately with 200 OK within 5s to avoid retry storms
  res.status(200).json({ status: "received" });

  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") {
      return;
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return; // Status notification (sent, delivered, read) - ignore
    }

    const msg = messages[0];
    const rawFrom = msg.from; // e.g. "919876543210"
    const messageType = msg.type; // "image" | "text" | "interactive"

    // Sanitize phone number strictly to numeric digits (prevents regex injection & ReDoS)
    const cleanDigits = String(rawFrom || "").replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      logger.warn(`[WHATSAPP WEBHOOK] Received message with invalid phone length: ${rawFrom}`);
      return;
    }

    const last10Digits = cleanDigits.slice(-10);

    logger.info(`[WHATSAPP WEBHOOK] Received ${messageType} message from ${cleanDigits}`);

    await connectToDatabase();

    // Match seller by phone number safely
    const user = await User.findOne({
      $or: [
        { phone: cleanDigits },
        { phone: `+${cleanDigits}` },
        { phone: { $regex: `${last10Digits}$` } },
        { whatsappNumber: cleanDigits },
        { whatsappNumber: `+${cleanDigits}` },
        { whatsappNumber: { $regex: `${last10Digits}$` } },
      ],
    });

    if (!user) {
      logger.info(
        `[WHATSAPP WEBHOOK] Unregistered phone number ${rawFrom}. User needs to link WhatsApp on profile.`
      );
      return;
    }

    logger.info(
      `[WHATSAPP WEBHOOK] Matched seller: ${user.fullName} (${user._id}), Credit Balance: ${user.creditBalance}`
    );

    if (messageType === "image") {
      const imageId = msg.image?.id;
      const caption = msg.image?.caption || "";
      logger.info(
        `[WHATSAPP WEBHOOK] Image received (Media ID: ${imageId}) from user ${user._id}. Caption: "${caption}"`
      );
      // In production, fetch media from Graph API using imageId, upload to S3/R2, and enqueue listing generation
    } else if (messageType === "text") {
      const textBody = msg.text?.body?.trim()?.toLowerCase() || "";
      logger.info(`[WHATSAPP WEBHOOK] Text command from ${user.fullName}: "${textBody}"`);
    }
  } catch (err: any) {
    logger.error("[WHATSAPP WEBHOOK] Error processing incoming WhatsApp event", {
      error: err.message || String(err),
    });
  }
});

