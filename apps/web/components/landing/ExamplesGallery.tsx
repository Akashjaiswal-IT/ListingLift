"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";

// Real before -> after pairs produced by Peshkar (no stock photos, no invented
// stats). The card is rendered by the app from the studio photo of the same bag.
const EXAMPLES = [
  {
    before: "/images/hero-before.jpg",
    after: "/images/hero-after.jpg",
    label: { en: "Studio photo", hi: "स्टूडियो फ़ोटो" },
    product: { en: "Black laptop backpack", hi: "काला लैपटॉप बैग" },
  },
  {
    before: "/hero/raw.webp",
    after: "/hero/studio-white.webp",
    label: { en: "White background for Amazon / Flipkart", hi: "अमेज़ॅन / फ्लिपकार्ट के लिए सफ़ेद बैकग्राउंड" },
    product: { en: "Teal school backpack", hi: "टील स्कूल बैग" },
  },
  {
    before: "/hero/raw.webp",
    after: "/hero/studio-podium.webp",
    label: { en: "Styled podium shot", hi: "स्टाइल्ड पोडियम शॉट" },
    product: { en: "Teal school backpack", hi: "टील स्कूल बैग" },
  },
  {
    before: "/hero/raw.webp",
    after: "/card-previews/studio-terracotta.jpg",
    label: { en: "WhatsApp card with price", hi: "कीमत के साथ व्हाट्सएप कार्ड" },
    product: { en: "Teal school backpack", hi: "टील स्कूल बैग" },
  },
] as const;

export function ExamplesGallery({ isHi }: { isHi: boolean }) {
  const { isSignedIn } = useUser();
  const pick = (c: { en: string; hi: string }) => (isHi ? c.hi : c.en);

  return (
    <section
      aria-labelledby="examples-title"
      className="container mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16 space-y-8 border-t border-border/40"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2 id="examples-title" className="text-2xl sm:text-3xl font-black font-serif tracking-tight">
            {isHi ? "Peshkar से बने उदाहरण" : "Examples made with Peshkar"}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {isHi
              ? "असली फ़ोन फ़ोटो, और Peshkar ने उनसे क्या बनाया।"
              : "Real phone photos, and what Peshkar made from them."}
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {EXAMPLES.map((ex) => (
          <li key={ex.after} className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="grid grid-cols-2 gap-px bg-border">
              {[
                { src: ex.before, tag: isHi ? "पहले: फ़ोन फ़ोटो" : "Before: phone photo" },
                { src: ex.after, tag: isHi ? "बाद में" : "After" },
              ].map((side, i) => (
                <figure key={side.src + i} className="relative aspect-square bg-muted">
                  <img
                    src={side.src}
                    alt={`${pick(ex.product)} — ${side.tag}`}
                    width={450}
                    height={450}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  <figcaption
                    className={`absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                      i === 0 ? "bg-black/70 text-white" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {side.tag}
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="p-4">
              <p className="text-sm font-bold text-foreground">{pick(ex.label)}</p>
              <p className="text-xs text-muted-foreground">{pick(ex.product)}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex justify-center">
        <Button asChild size="lg" className="h-12 gap-2 rounded-xl px-8 font-bold">
          <Link href={isSignedIn ? "/app/generate" : "/signup"}>
            {isSignedIn
              ? isHi ? "अपनी बनाएं" : "Make yours"
              : isHi ? "अपनी बनाएं — 3 मुफ़्त क्रेडिट" : "Make yours — 3 free credits"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
