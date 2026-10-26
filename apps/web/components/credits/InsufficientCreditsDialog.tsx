"use client";

import { useState } from "react";
import Link from "next/link";
import { Coins, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { trpc } from "~/trpc/client";
import { useCheckout } from "~/hooks/useCheckout";
import { useLanguage } from "~/providers/LanguageContext";
import { PurchaseConsent } from "~/components/legal/PurchaseConsent";
import { packDisplayName } from "~/lib/pack-names";

interface InsufficientCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Credits the action costs. */
  needed: number;
  /** Credits the seller has now. */
  balance: number;
}

/**
 * Shown when a seller doesn't have enough credits for a generation or re-edit.
 * They can buy a pack right here (same Razorpay checkout as /pricing) and stay
 * on the page, so the photos they uploaded and the details they typed are kept.
 */
export function InsufficientCreditsDialog({ open, onOpenChange, needed, balance }: InsufficientCreditsDialogProps) {
  const { language } = useLanguage();
  const isHi = language === "hi";
  const [accepted, setAccepted] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const packsQuery = trpc.credits.getPacks.useQuery(undefined, { enabled: open });
  const { startCheckout, pendingKey } = useCheckout(accepted, {
    onConsentMissing: () => {
      setConsentError(true);
      document.getElementById("dialog-purchase-consent")?.focus();
    },
    // Stay here: the seller goes straight back to what they were doing.
    successRedirect: null,
  });

  const shortfall = Math.max(0, needed - balance);
  const packs = (packsQuery.data || []).slice().sort((a, b) => a.priceRupees - b.priceRupees);
  // Cheapest pack that covers the shortfall (packs always cover small shortfalls,
  // but fall back to the cheapest one just in case).
  const suggested = packs.find((p) => p.credits >= shortfall) ?? packs[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl font-bold">
            <Coins className="h-5 w-5 text-credit" aria-hidden="true" />
            {isHi ? "क्रेडिट कम हैं" : "Not enough credits"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isHi
              ? `इसके लिए ${needed} क्रेडिट चाहिए, आपके पास ${balance} हैं। क्रेडिट खरीदें — आपकी फ़ोटो और भरी हुई जानकारी यहीं रहेगी।`
              : `This needs ${needed} credits and you have ${balance}. Buy credits here — your photos and details stay on this page.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {packsQuery.isLoading ? (
            <Skeleton className="h-20 w-full rounded-xl" />
          ) : suggested ? (
            <div className="rounded-xl border-2 border-primary/40 bg-card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-foreground">{packDisplayName(suggested.id, isHi, suggested.name)}</p>
                <p className="text-sm text-muted-foreground">
                  {suggested.credits} {isHi ? "क्रेडिट" : "credits"} · ₹{suggested.perCreditRupees.toFixed(2)}{" "}
                  {isHi ? "प्रति क्रेडिट" : "per credit"}
                </p>
              </div>
              <span className="text-2xl font-black font-serif text-foreground shrink-0">
                ₹{suggested.priceRupees.toLocaleString("en-IN")}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isHi ? "पैक लोड नहीं हो सके।" : "Couldn't load credit packs."}
            </p>
          )}

          <PurchaseConsent
            id="dialog-purchase-consent"
            compact
            newTab
            checked={accepted}
            onCheckedChange={(checked) => {
              setAccepted(checked);
              if (checked) setConsentError(false);
            }}
            showError={consentError}
          />
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button asChild variant="ghost">
            <Link href="/pricing" target="_blank" rel="noopener noreferrer">
              {isHi ? "सभी पैक देखें" : "See all packs"}
            </Link>
          </Button>
          <Button
            disabled={!suggested || pendingKey !== null}
            onClick={() => {
              if (!suggested) return;
              if (!accepted) {
                setConsentError(true);
                document.getElementById("dialog-purchase-consent")?.focus();
                return;
              }
              // Close this dialog first: a modal dialog blocks clicks outside it,
              // which would make the Razorpay window unusable.
              onOpenChange(false);
              void startCheckout({ packId: suggested.id as any });
            }}
            className="font-bold gap-2"
          >
            {pendingKey !== null ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {isHi ? "चेकआउट खुल रहा है..." : "Opening checkout..."}
              </>
            ) : suggested ? (
              isHi
                ? `₹${suggested.priceRupees.toLocaleString("en-IN")} में खरीदें`
                : `Buy for ₹${suggested.priceRupees.toLocaleString("en-IN")}`
            ) : isHi ? (
              "खरीदें"
            ) : (
              "Buy"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
