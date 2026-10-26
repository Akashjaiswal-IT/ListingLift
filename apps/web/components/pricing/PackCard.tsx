"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useLanguage } from "~/providers/LanguageContext";
import { packDisplayName } from "~/lib/pack-names";

export interface PackCardPack {
  id: string;
  name?: string;
  credits: number;
  priceRupees: number;
  perCreditRupees: number;
  isPopular?: boolean;
}

interface PackCardProps {
  pack: PackCardPack;
  /** Buy straight from this card (pricing page). */
  onBuy?: () => void;
  /** Or link somewhere instead (landing page links to /pricing). */
  href?: string;
  isOpening?: boolean;
}

/** One credit pack. Used by the pricing page and the landing page so both always match. */
export function PackCard({ pack, onBuy, href, isOpening = false }: PackCardProps) {
  const { language, t } = useLanguage();
  const isHi = language === "hi";
  const price = `₹${pack.priceRupees.toLocaleString("en-IN")}`;
  const buttonClass = `w-full font-bold h-11 rounded-xl text-sm ${
    pack.isPopular ? "shadow-md" : "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
  }`;
  const buttonLabel = isOpening
    ? isHi ? "चेकआउट खुल रहा है..." : "Opening checkout..."
    : `${t.pricingPage.buyBtn} (${price})`;

  return (
    <Card
      className={`relative flex flex-col justify-between rounded-2xl bg-card ${
        pack.isPopular
          ? "border-2 border-primary shadow-lg ring-1 ring-primary/30"
          : "border-border/70 shadow-xs"
      }`}
    >
      {pack.isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground font-black uppercase text-xs px-3 py-0.5 shadow-sm">
            {t.pricingPage.popularBadge}
          </Badge>
        </div>
      )}

      <CardContent className="p-6 space-y-6 pt-7 flex flex-col justify-between h-full">
        <div>
          <h3 className="text-lg font-bold text-foreground">{packDisplayName(pack.id, isHi, pack.name)}</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-black font-serif text-foreground">{price}</span>
            <span className="text-sm text-muted-foreground">
              / {pack.credits} {t.sections.creditsUnit}
            </span>
          </div>
          <span className="inline-block mt-1 text-xs text-muted-foreground font-medium">
            ₹{pack.perCreditRupees.toFixed(2)} {t.pricingPage.perCredit}
          </span>
        </div>

        <div className="space-y-3 pt-2 border-t border-border/50">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
            {t.pricingPage.featuresIncluded}
          </span>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {[
              `${Math.floor(pack.credits / 2)} ${isHi ? "स्टूडियो जेनरेशन्स" : "Quick Studio Generations"}`,
              t.pricingPage.f1,
              t.pricingPage.f3,
              t.pricingPage.f4,
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {onBuy ? (
          <Button onClick={onBuy} disabled={isOpening} className={`${buttonClass} active:scale-[0.98]`}>
            {buttonLabel}
          </Button>
        ) : (
          <Button asChild className={buttonClass}>
            <Link href={href ?? "/pricing"}>{buttonLabel}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Placeholder with the same footprint as a PackCard while packs load. */
export function PackCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-5" aria-hidden="true">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-3 w-24" />
      <div className="space-y-2.5 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}
