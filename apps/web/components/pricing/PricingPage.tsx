"use client";

import { CheckCircle2, HelpCircle, ShieldCheck } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { trpc } from "~/trpc/client";
import { useLanguage } from "~/providers/LanguageContext";
import { useCheckout } from "~/hooks/useCheckout";
import { CustomTopup } from "~/components/pricing/CustomTopup";
import { Checkbox } from "~/components/ui/checkbox";
import Link from "next/link";
import { useState } from "react";

export function PricingPage() {
  const { language, t } = useLanguage();
  const isHi = language === "hi";
  const [hasAcceptedPolicies, setHasAcceptedPolicies] = useState(false);
  const { startCheckout, pendingKey: selectedPack } = useCheckout(hasAcceptedPolicies);
  const packsQuery = trpc.credits.getPacks.useQuery();

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

      <div className="mx-auto max-w-4xl rounded-2xl border-2 border-primary/50 bg-primary/5 px-5 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Checkbox
            id="purchase-legal-acceptance"
            checked={hasAcceptedPolicies}
            onCheckedChange={(checked) => setHasAcceptedPolicies(checked === true)}
            className="mt-1 size-6 rounded-md border-2 border-primary data-[state=checked]:bg-primary"
          />
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {isHi ? "भुगतान से पहले आवश्यक पुष्टि" : "Required before payment"}
            </p>
            <label
              htmlFor="purchase-legal-acceptance"
              className="cursor-pointer text-sm leading-relaxed text-foreground/85"
            >
              {isHi ? "मैं " : "I agree to the "}
              <Link
                href="/terms?from=pricing"
                className="font-bold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {isHi ? "सेवा की शर्तें" : "Terms of Service"}
              </Link>
              {isHi ? ", " : ", "}
              <Link
                href="/privacy?from=pricing"
                className="font-bold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {isHi ? "गोपनीयता नीति" : "Privacy Policy"}
              </Link>
              {isHi ? ", और " : ", and "}
              <Link
                href="/refund-policy?from=pricing"
                className="font-bold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {isHi ? "रिफंड और क्रेडिट पॉलिसी" : "Refund & Credit Policy"}
              </Link>
              {isHi ? ", और " : ", and "}
              <Link
                href="/acceptable-use?from=pricing"
                className="font-bold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {isHi ? "उपयोग के नियम" : "Acceptable Use Policy"}
              </Link>
              {isHi
                ? ". मैं समझता/समझती हूँ कि AI परिणाम बदल सकते हैं और सफल जनरेशन के उपयोग किए गए क्रेडिट कैश रिफंड योग्य नहीं हैं।"
                : ". I understand that AI results can vary and that credits used for a completed generation are not cash-refundable."}
            </label>
          </div>
        </div>
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
                        {Math.floor(pack.credits / 2)}{" "}
                        {isHi ? "स्टूडियो जेनरेशन्स" : "Quick Studio Generations"}
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
                  onClick={() => startCheckout({ packId: pack.id as any })}
                  disabled={isSelected}
                  className={`w-full font-bold h-11 rounded-xl shadow-sm text-xs transition-all active:scale-[0.98] ${
                    pack.isPopular
                      ? "bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
                      : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                  }`}
                >
                  {isSelected
                    ? isHi
                      ? "चेकआउट खुल रहा है..."
                      : "Opening Checkout..."
                    : `${t.pricingPage.buyBtn} (₹${pack.priceRupees.toLocaleString("en-IN")})`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CustomTopup onCheckout={startCheckout} isOpening={selectedPack === "topup"} />

      {/* Frequently Asked Questions */}
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-foreground">
            {t.pricingPage.faqTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{t.pricingPage.faqSubtitle}</p>
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
