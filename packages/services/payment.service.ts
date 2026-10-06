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

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "trial",
    name: "Studio Kickstart",
    credits: 10,
    priceRupees: 249,
    amountPaise: 24900,
    perCreditRupees: 24.9,
    badge: "First Purchase",
  },
  {
    id: "starter",
    name: "Growth Seller",
    credits: 30,
    priceRupees: 599,
    amountPaise: 59900,
    perCreditRupees: 19.97,
    savingsPercent: 20,
    badge: "Starter Studio",
  },
  {
    id: "standard",
    name: "Merchant Pro",
    credits: 80,
    priceRupees: 1299,
    amountPaise: 129900,
    perCreditRupees: 16.24,
    savingsPercent: 35,
    isPopular: true,
    badge: "Most Popular",
  },
  {
    id: "pro",
    name: "Brand Studio",
    credits: 200,
    priceRupees: 2799,
    amountPaise: 279900,
    perCreditRupees: 13.99,
    savingsPercent: 44,
    badge: "Best Value",
  },
  {
    id: "business_s",
    name: "Business Studio",
    credits: 450,
    priceRupees: 5499,
    amountPaise: 549900,
    perCreditRupees: 12.22,
    savingsPercent: 51,
  },
  {
    id: "business_l",
    name: "Agency Bulk",
    credits: 1000,
    priceRupees: 9999,
    amountPaise: 999900,
    perCreditRupees: 9.99,
    savingsPercent: 60,
  },
];

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
}): Promise<{
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  razorpayKey: string;
  packId: string;
  credits: number;
}> {
  const { userId, packId, topupQuantity } = params;

  let amountPaise = 0;
  let credits = 0;

  if (packId === "topup") {
    // Clamp to a sane range. Without an upper bound a client could request an
    // absurd quantity (huge Razorpay order) and the lower bound stops 0/negative
    // amounts. 2000 mirrors the largest named pack.
    const qty = Math.min(2000, Math.max(1, topupQuantity || 1));
    credits = qty;
    let perCreditPaise = 2500; // default ₹25 per credit
    if (qty >= 500) perCreditPaise = 1100; // ₹11
    else if (qty >= 200) perCreditPaise = 1400; // ₹14
    else if (qty >= 80) perCreditPaise = 1700; // ₹17
    else if (qty >= 30) perCreditPaise = 2000; // ₹20
    amountPaise = qty * perCreditPaise;
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
