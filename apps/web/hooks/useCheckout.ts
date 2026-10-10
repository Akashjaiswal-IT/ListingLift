"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "~/trpc/client";
import { useCreditStore } from "~/stores/useCreditStore";
import { useLanguage } from "~/providers/LanguageContext";
import { trackEvent } from "~/lib/analytics";

export type CheckoutRequest = Parameters<
  ReturnType<typeof trpc.payments.createOrder.useMutation>["mutateAsync"]
>[0];

/**
 * Razorpay checkout shared by every "buy credits" button (named packs and the
 * custom top-up slider): create the order, open Razorpay, verify the payment.
 * `pendingKey` is the pack id being opened ("topup" for custom), or null.
 */
export function useCheckout() {
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const { language } = useLanguage();
  const isHi = language === "hi";
  const { addLocal } = useCreditStore();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const createOrderMutation = trpc.payments.createOrder.useMutation();
  const verifyPaymentMutation = trpc.payments.verifyPayment.useMutation();

  const startCheckout = async (request: CheckoutRequest) => {
    const packId = request.packId;

    if (!isSignedIn) {
      toast.info(isHi ? "क्रेडिट्स खरीदने के लिए कृपया लॉग इन करें।" : "Please sign in or create an account to purchase credits.");
      router.push("/login");
      return;
    }

    setPendingKey(packId);
    try {
      const order = await createOrderMutation.mutateAsync(request);

      // Ensure Razorpay SDK is available (dynamically load if not yet ready)
      let razorpayLoaded = typeof window !== "undefined" && !!(window as any).Razorpay;
      if (!razorpayLoaded && typeof window !== "undefined") {
        razorpayLoaded = await new Promise<boolean>((resolve) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      }

      if (!razorpayLoaded) {
        toast.error(
          isHi
            ? "भुगतान गेटवे लोड नहीं हो सका। कृपया विज्ञापन अवरोधक (ad-blocker) बंद करें और पुनः प्रयास करें।"
            : "Payment gateway failed to load. Please disable ad-blockers and try again."
        );
        return;
      }

      // Launch Razorpay Modal with customer prefill and instant webhook sync
      const options = {
        key: order.razorpayKey,
        amount: order.amountPaise,
        currency: order.currency,
        name: "Peshkar AI",
        description: `Purchase ${order.credits} Peshkar AI Credits`,
        order_id: order.razorpayOrderId,
        prefill: {
          name: user?.fullName || "",
          email: user?.primaryEmailAddress?.emailAddress || "",
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await verifyPaymentMutation.mutateAsync({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            if (verifyRes.success) {
              const added = (verifyRes as any).creditsAdded || order.credits;
              addLocal(added);
              trackEvent("checkout_completed", {
                packId,
                credits: added,
                amount: order.amountPaise / 100,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
              });
              await Promise.allSettled([
                utils.credits.getBalance.invalidate(),
                utils.user.getCreditBalance.invalidate(),
                utils.user.getCreditHistory.invalidate(),
              ]);
              toast.success(isHi ? `आपके खाते में ${added} क्रेडिट्स सफलतापूर्वक जोड़ दिए गए हैं!` : `Successfully added ${added} credits to your account!`);
              router.push("/app/dashboard");
            }
          } catch (err: any) {
            trackEvent("checkout_failed", {
              packId,
              orderId: response.razorpay_order_id,
              error: err.message,
            });
            toast.error(err.message || "Payment verification failed");
          }
        },
        theme: {
          color: "#E05822",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      trackEvent("checkout_opened", {
        packId,
        credits: order.credits,
        amount: order.amountPaise / 100,
        currency: order.currency,
        orderId: order.razorpayOrderId,
      });
      rzp.open();
    } catch (err: any) {
      trackEvent("checkout_failed", {
        packId,
        error: err.message,
      });
      toast.error(err.message || "Failed to initiate payment");
    } finally {
      setPendingKey(null);
    }
  };

  return { startCheckout, pendingKey };
}
