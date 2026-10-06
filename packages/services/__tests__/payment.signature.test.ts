import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import { verifyPaymentSignature } from "../payment.service";

const SECRET = "test_secret_key_123";

function sign(orderId: string, paymentId: string, secret = SECRET): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

describe("verifyPaymentSignature", () => {
  beforeAll(() => {
    // verifyPaymentSignature reads the secret from env at call time.
    process.env.RAZORPAY_KEY_SECRET = SECRET;
  });

  it("accepts a correctly computed signature", () => {
    const orderId = "order_abc";
    const paymentId = "pay_xyz";
    const good = sign(orderId, paymentId);
    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: good,
      })
    ).toBe(true);
  });

  it("rejects a tampered signature of the same length", () => {
    const orderId = "order_abc";
    const paymentId = "pay_xyz";
    const good = sign(orderId, paymentId);
    // Flip the last hex char so lengths still match (exercises timingSafeEqual).
    const lastChar = good.slice(-1);
    const flipped = good.slice(0, -1) + (lastChar === "a" ? "b" : "a");
    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: flipped,
      })
    ).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    expect(
      verifyPaymentSignature({
        razorpayOrderId: "order_abc",
        razorpayPaymentId: "pay_xyz",
        razorpaySignature: "short",
      })
    ).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(
      verifyPaymentSignature({
        razorpayOrderId: "order_abc",
        razorpayPaymentId: "pay_xyz",
        razorpaySignature: "",
      })
    ).toBe(false);
  });
});
