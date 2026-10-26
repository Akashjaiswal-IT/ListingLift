"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";
import { useLanguage } from "~/providers/LanguageContext";

interface PurchaseConsentProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Show the "please accept first" error (set when Buy was pressed unchecked). */
  showError?: boolean;
  /** Where the policy pages' "Back" link should return to. */
  from?: string;
  compact?: boolean;
  /** Open the policies in a new tab (inside a dialog, so the user's work isn't lost). */
  newTab?: boolean;
}

/**
 * The required "I agree to the Terms…" checkbox shown before any payment.
 * The text is the same wherever a purchase can start (pricing page and the
 * in-flow buy dialog). The ref is on the wrapper so callers can scroll to it.
 */
export const PurchaseConsent = forwardRef<HTMLDivElement, PurchaseConsentProps>(function PurchaseConsent(
  { id, checked, onCheckedChange, showError = false, from = "pricing", compact = false, newTab = false },
  ref
) {
  const { language } = useLanguage();
  const isHi = language === "hi";
  const errorId = `${id}-error`;
  const linkClass = "font-bold text-primary underline underline-offset-2 hover:text-primary/80";
  const linkTarget = newTab ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <div
      ref={ref}
      className={`rounded-2xl border-2 bg-primary/5 shadow-sm transition-colors ${
        compact ? "px-4 py-3" : "px-5 py-4"
      } ${showError && !checked ? "border-destructive ring-2 ring-destructive/30" : "border-primary/50"}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-describedby={showError && !checked ? errorId : undefined}
          aria-invalid={showError && !checked ? true : undefined}
          className="mt-1 size-6 rounded-md border-2 border-primary data-[state=checked]:bg-primary"
        />
        <div className="space-y-1.5">
          {!compact && (
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              {isHi ? "भुगतान से पहले आवश्यक पुष्टि" : "Required before payment"}
            </p>
          )}
          <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-foreground/85">
            {isHi ? "मैं " : "I agree to the "}
            <Link href={`/terms?from=${from}`} className={linkClass} {...linkTarget}>
              {isHi ? "सेवा की शर्तें" : "Terms of Service"}
            </Link>
            {", "}
            <Link href={`/privacy?from=${from}`} className={linkClass} {...linkTarget}>
              {isHi ? "गोपनीयता नीति" : "Privacy Policy"}
            </Link>
            {isHi ? ", और " : ", and "}
            <Link href={`/refund-policy?from=${from}`} className={linkClass} {...linkTarget}>
              {isHi ? "रिफंड और क्रेडिट पॉलिसी" : "Refund & Credit Policy"}
            </Link>
            {isHi ? ", और " : ", and "}
            <Link href={`/acceptable-use?from=${from}`} className={linkClass} {...linkTarget}>
              {isHi ? "उपयोग के नियम" : "Acceptable Use Policy"}
            </Link>
            {isHi
              ? ". मैं समझता/समझती हूँ कि AI परिणाम बदल सकते हैं और सफल जनरेशन के उपयोग किए गए क्रेडिट कैश रिफंड योग्य नहीं हैं।"
              : ". I understand that AI results can vary and that credits used for a completed generation are not cash-refundable."}
          </label>
          {showError && !checked && (
            <p id={errorId} role="alert" className="text-sm font-semibold text-destructive">
              {isHi
                ? "खरीदने से पहले कृपया यह बॉक्स टिक करें।"
                : "Please tick this box before buying."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
