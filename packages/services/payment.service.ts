import Razorpay from "razorpay";
import crypto from "crypto";
import { Payment } from "@repo/database";
import { Types } from "mongoose";

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceRupees: number;
  amountPaise: number;
  perCreditRupees: number;
  savingsPercent?: number;
  badge?: string;
  isPopular?: boolean;
}

// Pack ids are stable (stored on Payment records and in Razorpay notes) - only change prices/credits.
// The landing page mirrors the first four in apps/web/lib/credit-packs.ts; the parity tests keep them equal.
// Every pack stays at or above ₹20/credit, the floor that covers worst-case AI cost per credit.
export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "trial",
    name: "Studio Kickstart",
    credits: 15,
    priceRupees: 499,
    amountPaise: 49900,
    perCreditRupees: 33.27,
    badge: "First Purchase",
  },
  {
    id: "starter",
    name: "Growth Seller",
    credits: 40,
    priceRupees: 1199,
    amountPaise: 119900,
    perCreditRupees: 29.98,
    savingsPercent: 10,
    badge: "Starter Studio",
  },
  {
    id: "standard",
    name: "Merchant Pro",
    credits: 100,
    priceRupees: 2499,
    amountPaise: 249900,
    perCreditRupees: 24.99,
    savingsPercent: 25,
    isPopular: true,
    badge: "Most Popular",
  },
  {
    id: "pro",
    name: "Brand Studio",
    credits: 250,
    priceRupees: 5499,
    amountPaise: 549900,
    perCreditRupees: 22.0,
    savingsPercent: 34,
    badge: "Best Value",
  },
  {
    id: "business_s",
    name: "Business Studio",
    credits: 500,
    priceRupees: 10499,
    amountPaise: 1049900,
    perCreditRupees: 21.0,
    savingsPercent: 37,
  },
  {
    id: "business_l",
    name: "Agency Bulk",
    credits: 1000,
    priceRupees: 19999,
    amountPaise: 1999900,
    perCreditRupees: 20.0,
    savingsPercent: 40,
  },
];

// Custom top-up limits. The UI slider is narrower (15-1,000) but the server accepts up to 2,000.
// The minimum is 15 so no top-up costs less than the ₹499 entry pack.
export const TOPUP_MIN_CREDITS = 15;
export const TOPUP_MAX_CREDITS = 2000;

/**
 * Price per credit (in paise) for a custom top-up of `qty` credits. Each tier is just above the
 * matching pack, so a pack is always the better deal.
 * The web app mirrors this table in apps/web/lib/topup-pricing.ts - keep both
 * (and their tests) identical so the quote always equals the charge.
 */
function getTopupPerCreditPaise(qty: number): number {
  if (qty >= 1000) return 2000; // ₹20
  if (qty >= 500) return 2100; // ₹21
  if (qty >= 250) return 2200; // ₹22
  if (qty >= 100) return 2500; // ₹25
  if (qty >= 40) return 3000; // ₹30
  return 3400; // ₹34
}

/** Total price in paise for a custom top-up of `qty` credits. */
export function getTopupPricePaise(qty: number): number {
  return qty * getTopupPerCreditPaise(qty);
}

/** Human-readable pack name for receipts, ledger entries and payment lists. */
export function getPackDisplayName(packId: string, credits: number): string {
  return packId === "topup"
    ? `Custom top-up (${credits} credits)`
    : `${packId.toUpperCase()} pack (${credits} credits)`;
}

/**
 * Read a required Razorpay credential. In PRODUCTION a missing value throws
 * immediately — a silent placeholder would create real orders / verify
 * signatures against the wrong secret, which fails confusingly or, worse,
 * mis-handles money. In dev/test we keep a placeholder so the app still boots
 * without real keys.
 */
function requireRazorpayEnv(name: "RAZORPAY_KEY_ID" | "RAZORPAY_KEY_SECRET"): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`[config] ${name} is not configured`);
  }
  return name === "RAZORPAY_KEY_ID" ? "rzp_test_placeholder" : "rzp_secret_placeholder";
}

function getRazorpayClient(): Razorpay {
  return new Razorpay({
    key_id: requireRazorpayEnv("RAZORPAY_KEY_ID"),
    key_secret: requireRazorpayEnv("RAZORPAY_KEY_SECRET"),
  });
}

export function getCreditPacks(): CreditPack[] {
  return CREDIT_PACKS;
}

export function getPackById(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId);
}

export async function createOrder(params: {
  userId: Types.ObjectId | string;
  packId: string;
  topupQuantity?: number;
  legalPolicyVersion?: string;
}): Promise<{
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  razorpayKey: string;
  packId: string;
  credits: number;
}> {
  const { userId, packId, topupQuantity, legalPolicyVersion } = params;

  let amountPaise = 0;
  let credits = 0;

  if (packId === "topup") {
    // Never silently change what the customer asked to buy: reject anything outside the limits.
    if (
      typeof topupQuantity !== "number" ||
      !Number.isInteger(topupQuantity) ||
      topupQuantity < TOPUP_MIN_CREDITS ||
      topupQuantity > TOPUP_MAX_CREDITS
    ) {
      throw new Error(
        `Custom top-up must be a whole number of credits between ${TOPUP_MIN_CREDITS} and ${TOPUP_MAX_CREDITS}.`,
      );
    }
    credits = topupQuantity;
    amountPaise = getTopupPricePaise(topupQuantity);
  } else {
    const pack = getPackById(packId);
    if (!pack) {
      throw new Error(`Invalid pack ID: ${packId}`);
    }
    credits = pack.credits;
    amountPaise = pack.amountPaise;
  }

  const razorpay = getRazorpayClient();
  const options = {
    amount: amountPaise,
    currency: "INR",
    receipt: `rcpt_${Date.now()}_${String(userId).slice(-4)}`,
    notes: {
      userId: String(userId),
      packId,
      credits: String(credits),
    },
  };

  const order = await razorpay.orders.create(options);

  // Record payment in MongoDB with status: "created"
  await Payment.create({
    userId,
    razorpayOrderId: order.id,
    status: "created",
    amountPaise,
    currency: "INR",
    packId,
    creditsPurchased: credits,
    topupQuantity: packId === "topup" ? topupQuantity : undefined,
    legalPolicyVersion,
    legalAcceptedAt: legalPolicyVersion ? new Date() : undefined,
    razorpayMetadata: order,
  });

  return {
    razorpayOrderId: order.id,
    amountPaise,
    currency: "INR",
    razorpayKey: requireRazorpayEnv("RAZORPAY_KEY_ID"),
    packId,
    credits,
  };
}

export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;
  const secret = requireRazorpayEnv("RAZORPAY_KEY_SECRET");

  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  // Constant-time comparison. A normal `===` returns as soon as it hits the
  // first differing character, so an attacker can measure response time to
  // discover the signature one character at a time. timingSafeEqual always
  // compares the whole buffer. Lengths must match first (it throws otherwise).
  const a = Buffer.from(generatedSignature, "utf8");
  const b = Buffer.from(razorpaySignature || "", "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
