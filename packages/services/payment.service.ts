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
    name: "Trial Pack",
    credits: 10,
    priceRupees: 99,
    amountPaise: 9900,
    perCreditRupees: 9.9,
    badge: "First Purchase",
  },
  {
    id: "starter",
    name: "Starter Pack",
    credits: 25,
    priceRupees: 299,
    amountPaise: 29900,
    perCreditRupees: 11.96,
  },
  {
    id: "standard",
    name: "Standard Pack",
    credits: 60,
    priceRupees: 599,
    amountPaise: 59900,
    perCreditRupees: 9.98,
    savingsPercent: 17,
    isPopular: true,
    badge: "Most Popular",
  },
  {
    id: "pro",
    name: "Pro Pack",
    credits: 100,
    priceRupees: 899,
    amountPaise: 89900,
    perCreditRupees: 8.99,
    savingsPercent: 25,
    badge: "Best Value",
  },
  {
    id: "business_s",
    name: "Business Small",
    credits: 200,
    priceRupees: 1699,
    amountPaise: 169900,
    perCreditRupees: 8.5,
    savingsPercent: 29,
  },
  {
    id: "business_m",
    name: "Business Medium",
    credits: 500,
    priceRupees: 3999,
    amountPaise: 399900,
    perCreditRupees: 8.0,
    savingsPercent: 33,
  },
  {
    id: "business_l",
    name: "Business Large",
    credits: 1200,
    priceRupees: 8999,
    amountPaise: 899900,
    perCreditRupees: 7.5,
    savingsPercent: 37,
  },
];

function getRazorpayClient(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder";
  const key_secret = process.env.RAZORPAY_KEY_SECRET || "rzp_secret_placeholder";
  return new Razorpay({ key_id, key_secret });
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
    const qty = Math.max(1, topupQuantity || 1);
    credits = qty;
    amountPaise = qty * 1200; // ₹12 per credit = 1200 paise
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
    razorpayKey: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
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
  const secret = process.env.RAZORPAY_KEY_SECRET || "rzp_secret_placeholder";

  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return generatedSignature === razorpaySignature;
}
