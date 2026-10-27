"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Download,
  MessageCircle,
  ShoppingBag,
  Check,
  Heart,
  Send,
  Bookmark,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useLanguage } from "~/providers/LanguageContext";
import { toast } from "sonner";
import { BeforeAfterSlider } from "~/components/landing/BeforeAfterSlider";
import { AnimatedHero } from "~/components/landing/hero/AnimatedHero";
import { HERO_COPY, pick } from "~/components/landing/hero/hero-content";
import { CustomTopup } from "~/components/pricing/CustomTopup";
import { PackCard } from "~/components/pricing/PackCard";
import { PricingFaq } from "~/components/pricing/PricingFaq";
import { HowItWorks } from "~/components/landing/HowItWorks";
import { ExamplesGallery } from "~/components/landing/ExamplesGallery";
import { LANDING_PACKS } from "~/lib/credit-packs";
import { copyToClipboard } from "~/lib/clipboard";

// Demo photos in /public/images/demo-*.webp come from Unsplash (free to use under the Unsplash License):
// - demo-watch-white:           https://unsplash.com/photos/black-smart-watch-with-white-background-O43D6CYzxqM
// - demo-watch-white-band:      https://unsplash.com/photos/white-and-black-digital-watch-h1MnFsRI-_I
// - demo-headphones-lifestyle:  https://unsplash.com/photos/white-beats-by-dr-dre-wireless-headphones-bE3_aFt85Y8
// - demo-headphones:            https://unsplash.com/photos/black-wireless-headphones-on-white-table-lUMj2Zv5HUE
// - demo-leather-bag:           https://unsplash.com/photos/a-brown-leather-handbag-on-a-white-background-zxPo13geJ5U

type KitTab = "whatsapp" | "meesho" | "instagram";
const KIT_TABS: KitTab[] = ["whatsapp", "meesho", "instagram"];

// Demo copy for the "Your Listing Kit" tabs. Same product and prices (₹1,299 / ₹2,499) on every tab.
const KIT_DEMO = {
  whatsapp: {
    cardLabel: { en: "WhatsApp Card", hi: "व्हाट्सएप कार्ड" },
    copyLabel: { en: "WhatsApp Caption", hi: "व्हाट्सएप कैप्शन" },
    caption: {
      en: "✨ New Arrival: Premium Smartwatch 🔥\nUpgrade your style today!\n✅ Water Resistant\n✅ 7 Day Battery\n✅ Heart Rate Monitor\n*Price:* ₹1,299 only\n*Free Shipping* across India 🇮🇳\nTo order, reply with your address.",
      hi: "✨ नया कलेक्शन: प्रीमियम स्मार्टवॉच 🔥\nआज ही अपना स्टाइल अपग्रेड करें!\n✅ वाटर रेसिस्टेंट\n✅ 7 दिन की बैटरी\n✅ हार्ट रेट मॉनिटर\n*ऑफ़र प्राइस:* ₹1,299 मात्र\n*मुफ़्त शिपिंग* पूरे भारत में 🇮🇳\nऑर्डर करने के लिए अपना पता भेजें।",
    },
  },
  meesho: {
    cardLabel: { en: "Meesho Listing Preview", hi: "मीशो लिस्टिंग प्रीव्यू" },
    copyLabel: { en: "Meesho Catalog", hi: "मीशो कैटलॉग" },
    productTitle: { en: "Premium White Smartwatch", hi: "प्रीमियम व्हाइट स्मार्टवॉच" },
    delivery: { en: "Free Delivery · Cash on Delivery", hi: "मुफ़्त डिलीवरी · कैश ऑन डिलीवरी" },
    cta: { en: "Add to Cart", hi: "कार्ट में जोड़ें" },
    catalogTitle: {
      en: "Premium Bluetooth Smartwatch for Men & Women - White Silicone Strap",
      hi: "पुरुषों और महिलाओं के लिए प्रीमियम ब्लूटूथ स्मार्टवॉच - व्हाइट सिलिकॉन स्ट्रैप",
    },
    category: { en: "Smart Watches", hi: "स्मार्ट वॉच" },
    specs: [
      { label: { en: "Material", hi: "मटेरियल" }, value: { en: "Aluminium alloy case, soft silicone strap", hi: "एल्यूमीनियम अलॉय केस, सॉफ्ट सिलिकॉन स्ट्रैप" } },
      { label: { en: "Display", hi: "डिस्प्ले" }, value: { en: "1.9\" HD always-on touch display", hi: "1.9\" HD ऑलवेज-ऑन टच डिस्प्ले" } },
      { label: { en: "Battery", hi: "बैटरी" }, value: { en: "Up to 7 days with fast charge", hi: "फास्ट चार्ज के साथ 7 दिन तक" } },
      { label: { en: "Features", hi: "फ़ीचर्स" }, value: { en: "Heart rate monitor, water resistant, sports modes", hi: "हार्ट रेट मॉनिटर, वाटर रेसिस्टेंट, स्पोर्ट्स मोड्स" } },
      { label: { en: "Country of Origin", hi: "मूल देश" }, value: { en: "India", hi: "भारत" } },
    ],
  },
  instagram: {
    cardLabel: { en: "Instagram Post", hi: "इंस्टाग्राम पोस्ट" },
    copyLabel: { en: "Instagram Caption", hi: "इंस्टाग्राम कैप्शन" },
    handle: "@yourstore",
    likes: { en: "1,204 likes", hi: "1,204 लाइक्स" },
    caption: {
      en: "Meet your new everyday companion ✨\nClean white design, 7-day battery and all-day health tracking.\nTap the link in bio to order. Cash on Delivery available!",
      hi: "मिलिए अपने नए रोज़ के साथी से ✨\nक्लीन व्हाइट डिज़ाइन, 7 दिन की बैटरी और पूरे दिन हेल्थ ट्रैकिंग।\nऑर्डर करने के लिए बायो में दिया लिंक टैप करें। कैश ऑन डिलीवरी उपलब्ध!",
    },
    hashtags: "#smartwatch #whitesmartwatch #fitnesstracker #onlineshoppingindia #styleupgrade #newarrival",
  },
};

// Plain text copied by the Copy button for the active tab
function getKitCopyText(tab: KitTab, lang: "en" | "hi"): string {
  if (tab === "meesho") {
    const m = KIT_DEMO.meesho;
    return [
      m.catalogTitle[lang],
      `${lang === "hi" ? "कैटेगरी" : "Category"}: ${m.category[lang]}`,
      "",
      ...m.specs.map((spec) => `${spec.label[lang]}: ${spec.value[lang]}`),
    ].join("\n");
  }
  if (tab === "instagram") {
    return `${KIT_DEMO.instagram.caption[lang]}\n\n${KIT_DEMO.instagram.hashtags}`;
  }
  return KIT_DEMO.whatsapp.caption[lang];
}

export function HomePage() {
  const { t, language } = useLanguage();
  const isHi = language === "hi";
  const [activeTab, setActiveTab] = useState<KitTab>("whatsapp");
  const [copied, setCopied] = useState(false);

  const handleCopyCaption = async () => {
    const textToCopy = getKitCopyText(activeTab, isHi ? "hi" : "en");
    if (!(await copyToClipboard(textToCopy))) {
      toast.error(isHi ? "कॉपी नहीं हो सका" : "Couldn't copy");
      return;
    }
    setCopied(true);
    toast.success(t.sections.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors selection:bg-primary/20">
      {/* Animated hero: drop a photo → copies fly out → processing → listing kit.
          Kept exactly as designed; the scope keeps its original brand colours. */}
      <div className="hero-brand-scope contents">
        <AnimatedHero isHi={isHi} />
      </div>

      {/* See the difference: before / after slider */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-xl space-y-6 text-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight">
              {pick(HERO_COPY.differenceTitle, isHi)}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {pick(HERO_COPY.differenceSubtitle, isHi)}
            </p>
          </div>
          <BeforeAfterSlider
            beforeImage="/images/hero-before.webp"
            afterImage="/images/hero-after.webp"
            beforeLabel={t.hero.originalPhoto}
            afterLabel={t.hero.aiStudioRevamp}
            beforeSubtitle={isHi ? "बिस्तर पर सामान्य फ़ोन फ़ोटो" : "Casual photo on bed"}
            afterSubtitle={isHi ? "सीधा स्टूडियो ट्रांसफ़ॉर्मेशन" : "Upright Studio Lighting"}
          />
        </div>
      </section>

      {/* How it works: three real steps, real app-made images, working sample CTA */}
      <HowItWorks isHi={isHi} />

      {/* ================= SECTION 2: 2. YOUR LISTING KIT (Ref Image 3) ================= */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16 space-y-8 border-t border-border/40">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight">
            {t.sections.step2Title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t.sections.step2Subtitle}
          </p>
        </div>

        {/* Platform Tabs */}
        <div className="flex items-center gap-2" role="tablist" aria-label={isHi ? "प्लेटफ़ॉर्म" : "Platform"}>
          {[
            { id: "whatsapp", label: t.sections.tabWhatsapp },
            { id: "meesho", label: t.sections.tabMeesho },
            { id: "instagram", label: t.sections.tabInstagram },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`kit-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`kit-card-${tab.id} kit-copy-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => {
                setActiveTab(tab.id as KitTab);
                setCopied(false);
              }}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                const i = KIT_TABS.indexOf(tab.id as KitTab);
                const next = KIT_TABS[(i + (e.key === "ArrowRight" ? 1 : KIT_TABS.length - 1)) % KIT_TABS.length]!;
                setActiveTab(next);
                setCopied(false);
                document.getElementById(`kit-tab-${next}`)?.focus();
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 3-Card Grid. Left/middle columns switch with the tab; every tab's panel is stacked in the
            same grid cell so the section keeps one height (no jump) and the columns stay level. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Left: platform preview card */}
          <div className="grid">
            {KIT_TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <div
                  key={tab}
                  id={`kit-card-${tab}`}
                  role="tabpanel"
                  aria-labelledby={`kit-tab-${tab}`}
                  aria-hidden={!active}
                  inert={!active}
                  className={`col-start-1 row-start-1 transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0 invisible pointer-events-none"
                  }`}
                >
                  <div className="h-full flex flex-col p-4 rounded-2xl border border-border bg-card space-y-3 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {KIT_DEMO[tab].cardLabel[isHi ? "hi" : "en"]}
                    </span>

                    {tab === "whatsapp" && (
                      <div className="flex-1 flex flex-col rounded-xl overflow-hidden bg-white border border-stone-200 p-4 space-y-3 text-stone-900">
                        <div className="aspect-square rounded-lg bg-stone-50 flex items-center justify-center p-2">
                          <img
                            src="/images/demo-watch-white-band.webp"
                            alt="White smartwatch with a white strap on a light background"
                            className="w-full h-full object-cover rounded-md"
                          />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-stone-900">
                            {isHi ? "प्रीमियम व्हाइट स्मार्टवॉच" : "Premium White Smartwatch"}
                          </h4>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-sm font-black text-stone-900">₹1,299</span>
                            <span className="text-[10px] text-stone-400 line-through">₹2,499</span>
                            <Badge className="bg-emerald-100 text-emerald-800 text-[8px] font-bold px-1.5 py-0 border-none">
                              48% OFF
                            </Badge>
                          </div>
                          <span className="text-[10px] text-success font-semibold block mt-1">
                            {isHi ? "मुफ़्त शिपिंग | COD उपलब्ध" : "Free Shipping | COD Available"}
                          </span>
                        </div>
                        <Button size="sm" className="w-full mt-auto bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs h-8">
                          <MessageCircle className="h-3.5 w-3.5 mr-1" />
                          {t.sections.messageToOrder}
                        </Button>
                      </div>
                    )}

                    {tab === "meesho" && (
                      <div className="flex-1 flex flex-col rounded-xl overflow-hidden bg-white border border-stone-200 p-4 space-y-3 text-stone-900">
                        <div className="aspect-square rounded-lg bg-stone-50 flex items-center justify-center p-2">
                          <img
                            src="/images/demo-watch-white-band.webp"
                            alt="White smartwatch with a white strap on a light background"
                            className="w-full h-full object-cover rounded-md"
                          />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-stone-900">{KIT_DEMO.meesho.productTitle[isHi ? "hi" : "en"]}</h4>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-sm font-black text-stone-900">₹1,299</span>
                            <span className="text-[10px] text-stone-400 line-through">₹2,499</span>
                            <span className="text-[10px] font-bold text-success">48% {isHi ? "छूट" : "off"}</span>
                          </div>
                          <span className="text-[10px] text-stone-600 font-medium block mt-1">
                            {KIT_DEMO.meesho.delivery[isHi ? "hi" : "en"]}
                          </span>
                        </div>
                        <Link href="/app/generate" className="block mt-auto">
                          <Button size="sm" className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs h-8">
                            <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                            {KIT_DEMO.meesho.cta[isHi ? "hi" : "en"]}
                          </Button>
                        </Link>
                      </div>
                    )}

                    {tab === "instagram" && (
                      <div className="flex-1 flex flex-col rounded-xl overflow-hidden bg-white border border-stone-200 text-stone-900">
                        <div className="flex items-center gap-2 px-3 py-2">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]">
                            <div className="h-full w-full rounded-full bg-white flex items-center justify-center text-[9px] font-black">
                              YS
                            </div>
                          </div>
                          <span className="text-xs font-bold">{KIT_DEMO.instagram.handle}</span>
                        </div>
                        <div className="aspect-square bg-stone-50">
                          <img
                            src="/images/demo-watch-white-band.webp"
                            alt="White smartwatch with a white strap on a light background"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex items-center gap-3 px-3 pt-2.5">
                          <Heart className="h-5 w-5" aria-hidden="true" />
                          <MessageCircle className="h-5 w-5" aria-hidden="true" />
                          <Send className="h-5 w-5" aria-hidden="true" />
                          <Bookmark className="h-5 w-5 ml-auto" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-bold px-3 pt-1.5 pb-3 mt-auto block">
                          {KIT_DEMO.instagram.likes[isHi ? "hi" : "en"]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Middle: platform copy with One-Click Copy */}
          <div className="grid">
            {KIT_TABS.map((tab) => {
              const active = activeTab === tab;
              const lang = isHi ? "hi" : "en";
              return (
                <div
                  key={tab}
                  id={`kit-copy-${tab}`}
                  role="tabpanel"
                  aria-labelledby={`kit-tab-${tab}`}
                  aria-hidden={!active}
                  inert={!active}
                  className={`col-start-1 row-start-1 transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0 invisible pointer-events-none"
                  }`}
                >
                  <div className="h-full flex flex-col p-5 rounded-2xl border border-border bg-card space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {KIT_DEMO[tab].copyLabel[lang]}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyCaption}
                        className="h-7 text-xs gap-1 font-bold text-primary"
                      >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied ? t.sections.copied : t.sections.copyCaption}
                      </Button>
                    </div>

                    {tab === "whatsapp" && (
                      <div className="flex-1 p-4 rounded-xl bg-muted/40 border border-border/60 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                        {KIT_DEMO.whatsapp.caption[lang]}
                      </div>
                    )}

                    {tab === "meesho" && (
                      <div className="flex-1 p-4 rounded-xl bg-muted/40 border border-border/60 text-xs leading-relaxed space-y-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                            {isHi ? "टाइटल" : "Title"}
                          </span>
                          <p className="font-semibold text-foreground mt-0.5">{KIT_DEMO.meesho.catalogTitle[lang]}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                            {isHi ? "कैटेगरी" : "Category"}
                          </span>
                          <p className="text-foreground mt-0.5">{KIT_DEMO.meesho.category[lang]}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                            {isHi ? "विवरण" : "Description"}
                          </span>
                          <ul className="mt-1 space-y-1 text-muted-foreground">
                            {KIT_DEMO.meesho.specs.map((spec) => (
                              <li key={spec.label.en}>
                                <span className="font-semibold text-foreground">{spec.label[lang]}:</span> {spec.value[lang]}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {tab === "instagram" && (
                      <div className="flex-1 p-4 rounded-xl bg-muted/40 border border-border/60 text-xs leading-relaxed space-y-3">
                        <p className="whitespace-pre-wrap">{KIT_DEMO.instagram.caption[lang]}</p>
                        <p className="text-primary font-medium break-words">{KIT_DEMO.instagram.hashtags}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: AI Product Details & Download Entire Kit */}
          <div className="h-full flex flex-col p-6 rounded-2xl bg-[#161311] text-[#FAF7F2] border border-stone-800 space-y-5 shadow-md">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">
              {t.sections.aiProductDetails}
            </span>

            <div className="space-y-1">
              <span className="text-[10px] text-stone-400 block uppercase">
                {t.sections.aiGeneratedTitle}
              </span>
              <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 text-xs font-semibold text-white">
                {isHi
                  ? "प्रीमियम ब्लूटूथ स्मार्टवॉच - सीरीज़ 7 कम्पैटिबल"
                  : "Premium Bluetooth Smartwatch - Series 7 Compatible"}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-stone-400 block uppercase">
                {t.sections.keyFeatures}
              </span>
              <ul className="space-y-1.5 text-xs text-stone-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  {isHi ? "हाई रेजोल्यूशन ऑलवेज-ऑन रेटिना डिस्प्ले" : "High Resolution Always-On Retina Display"}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  {isHi ? "मल्टीपल स्पोर्ट्स और फिटनेस ट्रैकिंग मोड्स" : "Multiple Sports & Fitness Tracking Modes"}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  {isHi ? "फास्ट चार्ज के साथ 7-दिन की लॉन्ग-लास्टिंग बैटरी" : "Long-Lasting 7-Day Battery with Fast Charge"}
                </li>
              </ul>
            </div>

            <Link href="/app/generate" className="block mt-auto pt-2">
              <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md gap-2">
                <Download className="h-4 w-4" />
                {t.sections.downloadEntireKit}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ================= SECTION 3: UNIVERSAL CREDIT PRICING (Matches Pricing Page) ================= */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16 space-y-12 border-t border-border/40">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <Badge className="bg-primary/10 text-primary border-primary/20 font-bold px-3.5 py-1 text-xs uppercase tracking-wider">
            {t.pricingPage.badge}
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-black font-serif tracking-tight text-foreground">
            {t.pricingPage.title}{" "}
            <span className="text-primary italic">{t.pricingPage.titleAccent}</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {t.pricingPage.subtitle}
          </p>
        </div>

        {/* Credit packs: the same card component as the /pricing page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {LANDING_PACKS.map((pack) => (
            <PackCard key={pack.id} pack={{ ...pack, isPopular: pack.id === "standard" }} href="/pricing" />
          ))}
        </div>

        {/* Custom credit pack: same component as the pricing page */}
        <CustomTopup />

        {/* Pricing FAQs: same component as the pricing page */}
        <div className="pt-4">
          <PricingFaq headingLevel="h3" />
        </div>
      </section>

      {/* Real before/after examples (replaces the old mock "product history") */}
      <ExamplesGallery isHi={isHi} />
    </div>
  );
}
