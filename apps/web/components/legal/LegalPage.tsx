"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "~/providers/LanguageContext";
import { PolicyLinks } from "./PolicyLinks";

type LocalizedText = { en: string; hi: string };

export type LegalSection = { title: LocalizedText; body: LocalizedText };

type LegalPageProps = {
  current: string;
  title: LocalizedText;
  sections: LegalSection[];
  children?: ReactNode;
};

/**
 * Next.js requires useSearchParams() inside a Suspense boundary on statically rendered pages
 * (otherwise the build fails). The fallback is the full page without the "Back" link, so the
 * legal text is still in the prerendered HTML; the link appears once the URL is read.
 */
export function LegalPage(props: LegalPageProps) {
  return (
    <Suspense fallback={<LegalPageContent {...props} from={null} />}>
      <LegalPageWithParams {...props} />
    </Suspense>
  );
}

function LegalPageWithParams(props: LegalPageProps) {
  const searchParams = useSearchParams();
  return <LegalPageContent {...props} from={searchParams.get("from")} />;
}

function LegalPageContent({
  current,
  title,
  sections,
  children,
  from,
}: LegalPageProps & { from: string | null }) {
  const { language } = useLanguage();
  const isHi = language === "hi";
  const localize = (value: LocalizedText) => (isHi ? value.hi : value.en);

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-16 sm:px-6">
      <div className="relative">
        {from === "pricing" && (
          <Link
            href="/pricing"
            aria-label={isHi ? "भुगतान पेज पर वापस जाएं" : "Back to payment"}
            className="mb-4 inline-flex shrink-0 whitespace-nowrap items-center rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10 min-[1100px]:absolute min-[1100px]:right-full min-[1100px]:top-1/2 min-[1100px]:mb-0 min-[1100px]:mr-4 min-[1100px]:-translate-y-1/2"
          >
            ← {isHi ? "वापस" : "Back"}
          </Link>
        )}
        <h1 className="text-3xl font-black">{localize(title)}</h1>
      </div>
      <p className="text-xs text-muted-foreground">
        {isHi ? "अंतिम अपडेट: 24 अक्टूबर 2026" : "Last updated: 24 October 2026"}
      </p>
      <PolicyLinks current={current} from={from} />
      <div className="prose space-y-4 text-sm leading-relaxed text-muted-foreground dark:prose-invert">
        {sections.map((section, index) => (
          <section key={section.title.en}>
            <h3 className="text-base font-bold text-foreground">
              {index + 1}. {localize(section.title)}
            </h3>
            <p>{localize(section.body)}</p>
          </section>
        ))}
        {children}
      </div>
    </div>
  );
}
