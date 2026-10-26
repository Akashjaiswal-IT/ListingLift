"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sliders, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useLanguage } from "~/providers/LanguageContext";
import type { PurchaseRequest } from "~/hooks/useCheckout";
import {
  getTopupPriceRupees,
  CUSTOM_SLIDER_MIN,
  CUSTOM_SLIDER_MAX,
  CUSTOM_SLIDER_STEP,
} from "~/lib/topup-pricing";

// TODO: replace with a contact page if one is added; for now this is the support address from the refund policy
const SUPPORT_EMAIL = "support@peshkarai.in";

/**
 * Custom credit slider. The price shown is always getTopupPriceRupees(qty), and
 * "Buy" orders exactly that quantity (packId "topup"), so the charge equals the quote.
 * Used on both the pricing page and the landing page.
 */
interface CustomTopupProps {
  onCheckout?: (request: PurchaseRequest) => Promise<void>;
  isOpening?: boolean;
}

export function CustomTopup({ onCheckout, isOpening = false }: CustomTopupProps) {
  const { language, t } = useLanguage();
  const isHi = language === "hi";
  const router = useRouter();
  const [credits, setCredits] = useState(220);

  const price = getTopupPriceRupees(credits);

  return (
    <div className="p-6 sm:p-10 rounded-3xl border-2 border-primary/20 bg-card shadow-lg max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg text-foreground">{t.pricingPage.customTitle}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{t.pricingPage.customSubtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl sm:text-4xl font-black font-serif text-primary">
            ₹{price.toLocaleString("en-IN")}
          </div>
          <span className="text-xs text-muted-foreground font-semibold">
            ≈ ₹{(price / credits).toFixed(1)} {t.pricingPage.perCredit}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <input
          type="range"
          min={CUSTOM_SLIDER_MIN}
          max={CUSTOM_SLIDER_MAX}
          step={CUSTOM_SLIDER_STEP}
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value))}
          aria-label={t.pricingPage.customTitle}
          className="w-full accent-primary h-2.5 bg-muted rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground font-semibold">
          <span>
            {CUSTOM_SLIDER_MIN} {t.sections.creditsUnit}
          </span>
          <span className="text-primary font-black text-sm">
            {credits} {t.sections.creditsUnit} ({t.pricingPage.selected})
          </span>
          <span>
            {CUSTOM_SLIDER_MAX.toLocaleString("en-IN")} {t.sections.creditsUnit}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success shrink-0" />
          <span>
            {isHi
              ? "तत्काल सक्रियण • स्वचालित रिफंड सुरक्षा"
              : "Instant Activation • Automatic Refund Protection"}
          </span>
        </div>
        <Button
          size="lg"
          disabled={isOpening}
          onClick={() => {
            if (onCheckout) {
              void onCheckout({ packId: "topup", topupQuantity: credits });
              return;
            }
            router.push("/pricing");
          }}
          className="w-full sm:w-auto h-11 px-8 font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-md gap-2 text-xs"
        >
          <Sparkles className="h-4 w-4" />
          {isOpening
            ? isHi
              ? "चेकआउट खुल रहा है..."
              : "Opening Checkout..."
            : isHi
              ? `${credits} क्रेडिट्स खरीदें (₹${price.toLocaleString("en-IN")})`
              : onCheckout
                ? `Buy ${credits} credits (₹${price.toLocaleString("en-IN")})`
                : "Review & purchase credits"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {isHi ? "1,000 से ज़्यादा क्रेडिट्स चाहिए? " : "Need more than 1,000 credits? "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary font-semibold hover:underline">
          {isHi ? "हमसे संपर्क करें" : "Contact us"}
        </a>
        .
      </p>
    </div>
  );
}
