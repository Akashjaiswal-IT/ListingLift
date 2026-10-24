"use client";

import Link from "next/link";
import { useLanguage } from "~/providers/LanguageContext";

const policies = [
  { href: "/terms", en: "Terms of Service", hi: "सेवा की शर्तें" },
  { href: "/privacy", en: "Privacy Policy", hi: "गोपनीयता नीति" },
  { href: "/refund-policy", en: "Refund & Credit Policy", hi: "रिफंड और क्रेडिट पॉलिसी" },
  { href: "/acceptable-use", en: "Use & Marketplace Rules", hi: "उपयोग और मार्केटप्लेस नियम" },
];

export function PolicyLinks({
  current,
  from,
}: {
  current: string;
  from?: string | null;
}) {
  const { language } = useLanguage();

  return (
    <nav aria-label="Related legal policies" className="flex flex-wrap gap-2">
      {policies.map((policy) => {
        const href = from ? `${policy.href}?from=${encodeURIComponent(from)}` : policy.href;
        return (
          <Link
            key={policy.href}
            href={href}
            aria-current={policy.href === current ? "page" : undefined}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            policy.href === current
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:border-primary/50 hover:text-primary"
          }`}
          >
            {language === "hi" ? policy.hi : policy.en}
          </Link>
        );
      })}
    </nav>
  );
}
