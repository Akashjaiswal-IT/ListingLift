"use client";

import { useState } from "react";
import { CheckCircle2, Zap, Sparkles, ShieldCheck, HelpCircle, Sliders } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { trpc } from "~/trpc/client";
import { useCreditStore } from "~/stores/useCreditStore";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useLanguage } from "~/providers/LanguageContext";
import { trackEvent } from "~/lib/analytics";

export default function PricingPage() {
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const { language, t } = useLanguage();
  const isHi = language === "hi";
  const { addLocal } = useCreditStore();
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [customCredits, setCustomCredits] = useState<number>(220);

  const utils = trpc.useUtils();
  const packsQuery = trpc.credits.getPacks.useQuery();
  const createOrderMutation = trpc.payments.createOrder.useMutation();
  const verifyPaymentMutation = trpc.payments.verifyPayment.useMutation();

  const calculateCustomPrice = (credits: number) => {
    if (credits >= 500) return Math.round(credits * 11);
    if (credits >= 200) return Math.round(credits * 14);
    if (credits >= 80) return Math.round(credits * 17);
    if (credits >= 30) return Math.round(credits * 20);
    return Math.round(credits * 25);
  };

  const handleBuyPack = async (packId: string) => {
    if (!isSignedIn) {
      toast.info(isHi ? "क्रेडिट्स खरीदने के लिए कृपया लॉग इन करें।" : "Please sign in or create an account to purchase credits.");
      router.push("/login");
      return;
    }

    setSelectedPack(packId);
    try {
      const order = await createOrderMutation.mutateAsync({
        packId: packId as any,
      });

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
      setSelectedPack(null);
    }
  };

  const handleBuyCustomPack = () => {
    if (!isSignedIn) {
      toast.info(isHi ? "कस्टम पैक खरीदने के लिए कृपया लॉग इन करें।" : "Please sign in to purchase credits.");
      router.push("/login");
      return;
    }
    // Match closest pre-configured pack or launch checkout
    const closestPack = packs.find((p) => p.credits >= customCredits) || packs[packs.length - 1];
    if (closestPack) {
      handleBuyPack(closestPack.id);
    } else {
      toast.success(isHi ? `कस्टम पैक चयनित: ${customCredits} क्रेडिट्स` : `Custom pack selected: ${customCredits} credits`);
    }
  };

  const packs = packsQuery.data || [];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12 sm:py-16 sm:px-6 space-y-16">
      {/* Top Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <Badge className="bg-primary/10 text-primary border-primary/20 font-bold px-3.5 py-1 text-xs uppercase tracking-wider">
          {t.pricingPage.badge}
        </Badge>
        <h1 className="text-3xl sm:text-5xl font-black font-serif tracking-tight text-foreground leading-tight">
          {t.pricingPage.title}{" "}
          <span className="text-primary italic">{t.pricingPage.titleAccent}</span>
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          {t.pricingPage.subtitle}
        </p>
      </div>

      {/* Credit Pricing Grid (Ref Image 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {packs.slice(0, 4).map((pack) => {
          const isSelected = selectedPack === pack.id;
          return (
            <Card
              key={pack.id}
              className={`relative flex flex-col justify-between transition-all hover:scale-[1.02] border-border/70 bg-card rounded-2xl ${
                pack.isPopular
                  ? "border-2 border-primary shadow-xl shadow-primary/10 bg-primary/5 ring-1 ring-primary/30"
                  : "shadow-xs hover:border-border"
              }`}
            >
              {pack.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-white font-black uppercase text-[10px] px-3 py-0.5 shadow-sm">
                    {t.pricingPage.popularBadge}
                  </Badge>
                </div>
              )}

              <CardContent className="p-6 space-y-6 pt-7 flex flex-col justify-between h-full">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {isHi && pack.id === "trial"
                      ? "स्टूडियो किकस्टार्ट"
                      : isHi && pack.id === "starter"
                      ? "ग्रोथ सेलर"
                      : isHi && pack.id === "standard"
                      ? "मर्चेंट प्रो"
                      : isHi && pack.id === "pro"
                      ? "ब्रांड स्टूडियो"
                      : isHi && pack.id === "business_s"
                      ? "बिजनेस स्टूडियो"
                      : isHi && pack.id === "business_l"
                      ? "एजेंसी बल्क"
                      : pack.name}
                  </h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-black font-serif text-foreground">
                      ₹{pack.priceRupees.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / {pack.credits} {t.sections.creditsUnit}
                    </span>
                  </div>
                  <span className="inline-block mt-1 text-xs text-muted-foreground font-medium">
                    ₹{pack.perCreditRupees.toFixed(2)} {t.pricingPage.perCredit}
                  </span>
                </div>

                <div className="space-y-3 pt-2 border-t border-border/50">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    {t.pricingPage.featuresIncluded}
                  </span>
                  <ul className="space-y-2.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>
                        {Math.floor(pack.credits / 2)} {isHi ? "स्टूडियो जेनरेशन्स" : "Quick Studio Generations"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>{t.pricingPage.f1}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>{t.pricingPage.f3}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>{t.pricingPage.f4}</span>
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={() => handleBuyPack(pack.id)}
                  disabled={isSelected}
                  className={`w-full font-bold h-11 rounded-xl shadow-sm text-xs transition-all active:scale-[0.98] ${
                    pack.isPopular
                      ? "bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
                      : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                  }`}
                >
                  {isSelected
                    ? isHi ? "चेकआउट खुल रहा है..." : "Opening Checkout..."
                    : `${t.pricingPage.buyBtn} (₹${pack.priceRupees.toLocaleString("en-IN")})`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ================= CUSTOM CREDIT PACK SLIDER (Matching Home Page, Ref Image 4) ================= */}
      <div className="p-6 sm:p-10 rounded-3xl border-2 border-primary/20 bg-card shadow-lg max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg text-foreground">
                {t.pricingPage.customTitle}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.pricingPage.customSubtitle}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl sm:text-4xl font-black font-serif text-primary">
              ₹{calculateCustomPrice(customCredits).toLocaleString("en-IN")}
            </div>
            <span className="text-xs text-muted-foreground font-semibold">
              ≈ ₹{(calculateCustomPrice(customCredits) / customCredits).toFixed(1)} {t.pricingPage.perCredit}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="range"
            min={10}
            max={1000}
            step={10}
            value={customCredits}
            onChange={(e) => setCustomCredits(Number(e.target.value))}
            className="w-full accent-primary h-2.5 bg-muted rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-semibold">
            <span>10 {t.sections.creditsUnit}</span>
            <span className="text-primary font-black text-sm">
              {customCredits} {t.sections.creditsUnit} ({t.pricingPage.selected})
            </span>
            <span>1,000 {t.sections.creditsUnit}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>{isHi ? "तत्काल सक्रियण • स्वचालित रिफंड सुरक्षा" : "Instant Activation • Automatic Refund Protection"}</span>
          </div>
          <Button
            size="lg"
            onClick={handleBuyCustomPack}
            className="w-full sm:w-auto h-11 px-8 font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md gap-2 text-xs"
          >
            <Sparkles className="h-4 w-4" />
            {t.pricingPage.buyCustomBtn} (₹{calculateCustomPrice(customCredits).toLocaleString("en-IN")})
          </Button>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-foreground">
            {t.pricingPage.faqTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t.pricingPage.faqSubtitle}
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-border/70 bg-card space-y-2 shadow-xs">
            <h4 className="font-bold text-sm flex items-center gap-2 text-foreground">
              <HelpCircle className="h-4 w-4 text-primary shrink-0" />
              {t.pricingPage.faq1Q}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed pl-6">
              {t.pricingPage.faq1A}
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-border/70 bg-card space-y-2 shadow-xs">
            <h4 className="font-bold text-sm flex items-center gap-2 text-foreground">
              <HelpCircle className="h-4 w-4 text-primary shrink-0" />
              {t.pricingPage.faq2Q}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed pl-6">
              {t.pricingPage.faq2A}
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-border/70 bg-card space-y-2 shadow-xs">
            <h4 className="font-bold text-sm flex items-center gap-2 text-foreground">
              <HelpCircle className="h-4 w-4 text-primary shrink-0" />
              {t.pricingPage.faq3Q}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed pl-6">
              {t.pricingPage.faq3A}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
