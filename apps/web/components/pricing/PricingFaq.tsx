"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { useLanguage } from "~/providers/LanguageContext";

/** Credits / payments FAQ. One component so the landing and pricing pages can't drift apart. */
export function PricingFaq({ headingLevel = "h2" }: { headingLevel?: "h2" | "h3" }) {
  const { t } = useLanguage();
  const Heading = headingLevel;
  const items = [
    { q: t.pricingPage.faq1Q, a: t.pricingPage.faq1A },
    { q: t.pricingPage.faq2Q, a: t.pricingPage.faq2A },
    { q: t.pricingPage.faq3Q, a: t.pricingPage.faq3A },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <Heading className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-foreground">
          {t.pricingPage.faqTitle}
        </Heading>
        <p className="text-sm text-muted-foreground">{t.pricingPage.faqSubtitle}</p>
      </div>

      <Accordion type="single" collapsible defaultValue="faq-0" className="rounded-2xl border border-border/70 bg-card px-5 shadow-xs">
        {items.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-sm sm:text-base font-bold text-foreground">{item.q}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
