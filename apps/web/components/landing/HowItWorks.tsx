"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowRight, Camera, Share2, Sparkles } from "lucide-react";
import { Button } from "~/components/ui/button";

// Real app-made images: the raw phone photo, the studio shot Peshkar made from
// it, and a WhatsApp card rendered from that studio shot.
const STEPS = [
  {
    icon: Camera,
    img: "/hero/raw.webp",
    alt: { en: "A phone photo of a teal backpack on a bed", hi: "बिस्तर पर रखे टील बैग की फ़ोन फ़ोटो" },
    title: { en: "Upload a phone photo", hi: "फ़ोन से फ़ोटो डालें" },
    body: {
      en: "Any background is fine — a bed, a table, the floor. One photo is enough.",
      hi: "कोई भी बैकग्राउंड चलेगा — बिस्तर, टेबल या ज़मीन। एक फ़ोटो काफ़ी है।",
    },
  },
  {
    icon: Sparkles,
    img: "/hero/studio-white.webp",
    alt: { en: "The same backpack as a white-background studio photo", hi: "वही बैग सफ़ेद बैकग्राउंड वाली स्टूडियो फ़ोटो में" },
    title: {
      en: "AI creates studio images, listing text and cards",
      hi: "AI बनाता है स्टूडियो फ़ोटो, लिस्टिंग टेक्स्ट और कार्ड",
    },
    body: {
      en: "Pure-white marketplace photos, a styled shot, title, bullet points, keywords and WhatsApp / Instagram cards.",
      hi: "मार्केटप्लेस के लिए सफ़ेद बैकग्राउंड फ़ोटो, एक स्टाइल्ड शॉट, टाइटल, बुलेट पॉइंट, कीवर्ड और व्हाट्सएप / इंस्टाग्राम कार्ड।",
    },
  },
  {
    icon: Share2,
    img: "/card-previews/studio-terracotta.jpg",
    alt: { en: "A WhatsApp product card with price and offer", hi: "कीमत और ऑफ़र के साथ व्हाट्सएप प्रोडक्ट कार्ड" },
    title: {
      en: "Share to WhatsApp, Meesho, Amazon",
      hi: "व्हाट्सएप, मीशो, अमेज़ॅन पर शेयर करें",
    },
    body: {
      en: "Share straight from your phone, or download everything as a ZIP and a Meesho-ready Excel sheet.",
      hi: "सीधे फ़ोन से शेयर करें, या सब कुछ ZIP और मीशो के लिए तैयार एक्सेल शीट में डाउनलोड करें।",
    },
  },
] as const;

/** Three honest steps from a phone photo to a ready listing, with a working "try a sample" CTA. */
export function HowItWorks({ isHi }: { isHi: boolean }) {
  const { isSignedIn } = useUser();
  const pick = (c: { en: string; hi: string }) => (isHi ? c.hi : c.en);
  // Signed-out visitors sign up first (3 free credits); signed-in sellers go
  // straight to the generator with the bundled sample photo loaded.
  const sampleHref = isSignedIn ? "/app/generate?sample=1" : "/signup";

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="container mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16 space-y-8"
    >
      <div className="max-w-2xl">
        <h2 id="how-it-works-title" className="text-2xl sm:text-3xl font-black font-serif tracking-tight">
          {isHi ? "यह कैसे काम करता है" : "How it works"}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          {isHi ? "फ़ोन फ़ोटो से तैयार लिस्टिंग तक — तीन कदम।" : "From a phone photo to a ready listing in three steps."}
        </p>
      </div>

      <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.img} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <div className="relative aspect-[4/3] bg-muted">
                <img
                  src={step.img}
                  alt={pick(step.alt)}
                  width={900}
                  height={675}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base font-black text-primary-foreground shadow-md">
                  {i + 1}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-5">
                <h3 className="flex items-start gap-2 text-base font-bold text-foreground">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {pick(step.title)}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{pick(step.body)}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="font-bold text-foreground">
            {isHi ? "फ़ोटो नहीं है? हमारी सैंपल फ़ोटो से आज़माएँ।" : "No photo handy? Try it with our sample photo."}
          </p>
          <p className="text-sm text-muted-foreground">
            {isHi ? "साइनअप पर 3 मुफ़्त क्रेडिट · कोई कार्ड नहीं चाहिए" : "3 free credits on sign-up · no card needed"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="h-12 gap-2 rounded-xl font-bold">
            <Link href={sampleHref}>
              {isHi ? "सैंपल फ़ोटो से आज़माएँ" : "Try with a sample photo"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-xl bg-card font-semibold">
            <Link href={isSignedIn ? "/app/generate" : "/signup"}>
              {isHi ? "अपनी फ़ोटो डालें" : "Use my own photo"}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
