"use client";

import { useRef, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { trpc } from "~/trpc/client";
import { useLanguage } from "~/providers/LanguageContext";
import { useCheckout } from "~/hooks/useCheckout";
import { CustomTopup } from "~/components/pricing/CustomTopup";
import { PackCard, PackCardSkeleton } from "~/components/pricing/PackCard";
import { PricingFaq } from "~/components/pricing/PricingFaq";
import { PurchaseConsent } from "~/components/legal/PurchaseConsent";
import { ErrorState } from "~/components/common/ErrorState";

const CONSENT_ID = "purchase-legal-acceptance";

export function PricingPage() {
  const { language, t } = useLanguage();
  const isHi = language === "hi";
  const [hasAcceptedPolicies, setHasAcceptedPolicies] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const consentRef = useRef<HTMLDivElement>(null);

  const { startCheckout, pendingKey: selectedPack } = useCheckout(hasAcceptedPolicies, {
    // Buy pressed without ticking the box: take the seller to it instead of
    // only flashing a toast far away from the checkbox.
    onConsentMissing: () => {
      setConsentError(true);
      consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(CONSENT_ID)?.focus({ preventScroll: true });
    },
  });
  const packsQuery = trpc.credits.getPacks.useQuery();
  const packs = packsQuery.data || [];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12 sm:py-16 sm:px-6 space-y-12 sm:space-y-16">
      {/* Top Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <Badge className="bg-primary/10 text-primary border-primary/20 font-bold px-3.5 py-1 text-xs uppercase tracking-wider">
          {t.pricingPage.badge}
        </Badge>
        <h1 className="text-3xl sm:text-5xl font-black font-serif tracking-tight text-foreground leading-tight">
          {t.pricingPage.title} <span className="text-primary italic">{t.pricingPage.titleAccent}</span>
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          {t.pricingPage.subtitle}
        </p>
      </div>

      <div className="mx-auto max-w-4xl">
        <PurchaseConsent
          ref={consentRef}
          id={CONSENT_ID}
          checked={hasAcceptedPolicies}
          onCheckedChange={(checked) => {
            setHasAcceptedPolicies(checked);
            if (checked) setConsentError(false);
          }}
          showError={consentError}
        />
      </div>

      {/* Credit packs */}
      {packsQuery.isError ? (
        <ErrorState
          title={isHi ? "पैक लोड नहीं हो सके" : "Couldn't load credit packs"}
          onRetry={() => packsQuery.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" aria-busy={packsQuery.isLoading}>
          {packsQuery.isLoading
            ? [1, 2, 3, 4].map((i) => <PackCardSkeleton key={i} />)
            : packs.slice(0, 4).map((pack) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  isOpening={selectedPack === pack.id}
                  onBuy={() => startCheckout({ packId: pack.id as any })}
                />
              ))}
        </div>
      )}

      <CustomTopup onCheckout={startCheckout} isOpening={selectedPack === "topup"} />

      <PricingFaq headingLevel="h2" />
    </div>
  );
}
