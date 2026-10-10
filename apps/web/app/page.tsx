"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Zap,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Upload,
  MessageCircle,
  Instagram,
  ShoppingBag,
  ChevronRight,
  RotateCw,
  Check,
  Play,
  Share2,
  Heart,
  Send,
  Bookmark,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { useLanguage } from "~/providers/LanguageContext";
import { toast } from "sonner";
import { OnboardingTour } from "~/components/onboarding/OnboardingTour";
import { BeforeAfterSlider } from "~/components/landing/BeforeAfterSlider";
import { CustomTopup } from "~/components/pricing/CustomTopup";

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

export default function HomePage() {
  const { t, language } = useLanguage();
  const isHi = language === "hi";
  const [activeTab, setActiveTab] = useState<KitTab>("whatsapp");
  const [activeHistoryFilter, setActiveHistoryFilter] = useState<"all" | "whatsapp" | "meesho">("all");
  const [selectedStyle, setSelectedStyle] = useState("studio_white");
  const [copied, setCopied] = useState(false);

  const handleCopyCaption = () => {
    const textToCopy = getKitCopyText(activeTab, isHi ? "hi" : "en");
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success(t.sections.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const historyItems = [
    {
      id: "1",
      title: isHi ? "ब्लैक बैकपैक प्रो" : "Black Backpack Pro",
      time: isHi ? "2 घंटे पहले" : "Added 2 hours ago",
      type: "whatsapp",
      img: "/images/hero-after.jpg",
    },
    {
      id: "2",
      title: isHi ? "क्लासिक स्मार्टवॉच" : "Classic Smartwatch",
      time: isHi ? "कल जोड़ा गया" : "Added yesterday",
      type: "meesho",
      img: "/images/demo-watch-white.webp",
    },
    {
      id: "3",
      title: isHi ? "वायरलेस हेडफ़ोन" : "Wireless Headphones",
      time: isHi ? "3 दिन पहले" : "Added 3 days ago",
      type: "whatsapp",
      img: "/images/demo-headphones.webp",
    },
    {
      id: "4",
      title: isHi ? "प्रीमियम लेदर बैग" : "Leather Bag",
      time: isHi ? "1 सप्ताह पहले" : "Added 1 week ago",
      type: "meesho",
      img: "/images/demo-leather-bag.webp",
    },
  ];

  const filteredHistory = historyItems.filter((item) => {
    if (activeHistoryFilter === "all") return true;
    return item.type === activeHistoryFilter;
  });

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors selection:bg-primary/20">
      {/* Interactive Onboarding Tour (Auto-triggers on first signup or manual trigger) */}
      <OnboardingTour />

      {/* DESKTOP & GLOBAL HERO CONTAINER (Matches Reference Image 2) */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 pt-6 sm:pt-10 pb-16">
        <div className="relative rounded-3xl bg-[#161311] text-[#FAF7F2] p-8 sm:p-14 lg:p-16 border border-stone-800 shadow-2xl overflow-hidden">
          {/* Subtle warm ambient backlights */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 blur-[130px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-600/15 blur-[130px] rounded-full pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
                {t.hero.badge}
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-serif tracking-tight leading-[1.15]">
                {t.hero.headline}{" "}
                <span className="text-primary italic">
                  {t.hero.headlineAccent}
                </span>
              </h1>

              <p className="text-sm sm:text-base text-stone-300 max-w-xl leading-relaxed">
                {t.hero.subheadline}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link href="/app/generate">
                  <Button
                    size="lg"
                    className="h-12 px-7 font-bold bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg shadow-primary/25 gap-2 text-sm transition-all hover:scale-105"
                  >
                    {t.hero.tryFree}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    const el = document.getElementById("step-1-demo");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="h-12 px-6 font-semibold border-stone-700 bg-stone-900/60 hover:bg-stone-800 text-stone-200 rounded-full text-sm gap-2"
                >
                  <Play className="h-4 w-4 fill-stone-200" />
                  {t.hero.watchDemo}
                </Button>
              </div>

              {/* Pure White Guarantee Callout */}
              <div className="flex items-center gap-2.5 pt-4 text-xs text-stone-400 border-t border-stone-800/80">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium text-stone-300">
                  {t.hero.guaranteedWhite}
                </span>
              </div>
            </div>

            {/* Right Visual Column: Interactive Before/After Comparison Slider */}
            <div className="lg:col-span-5">
              <BeforeAfterSlider
                beforeImage="/images/hero-before.jpg"
                afterImage="/images/hero-after.jpg"
                beforeLabel={t.hero.originalPhoto}
                afterLabel={t.hero.aiStudioRevamp}
                beforeSubtitle={isHi ? "बिस्तर पर सामान्य फ़ोन फ़ोटो" : "Casual photo on bed"}
                afterSubtitle={isHi ? "सीधा 8K स्टूडियो ट्रांसफ़ॉर्मेशन" : "Upright 8K Studio Lighting"}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECTION 1: 1. UPLOAD & AI REVAMP (Ref Image 2 & 3) ================= */}
      <section id="step-1-demo" className="container mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16 space-y-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight">
            {t.sections.step1Title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t.sections.step1Subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Interactive Upload Controls */}
          <div className="lg:col-span-5 p-6 rounded-2xl border border-border bg-card shadow-xs space-y-5">
            <Link href="/app/generate">
              <div className="border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40 group">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6" />
                </div>
                <span className="font-bold text-sm block text-foreground">
                  {t.sections.tapUpload}
                </span>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {t.sections.supports}
                </span>
              </div>
            </Link>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t.sections.transformStyle}
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: "studio_white", name: t.sections.styleCleanWhite },
                  { id: "lifestyle", name: t.sections.styleLifestyle },
                  { id: "luxury", name: t.sections.styleLuxury },
                  { id: "festive", name: t.sections.styleFestive },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setSelectedStyle(st.id)}
                    className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all flex items-center justify-between ${
                      selectedStyle === st.id
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-border bg-background hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <span>{st.name}</span>
                    {selectedStyle === st.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {t.sections.customPromptLabel}
              </label>
              <input
                type="text"
                placeholder={t.sections.customPromptPlaceholder}
                className="w-full text-xs h-9 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-primary"
              />
            </div>

            <Link href="/app/generate" className="block">
              <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-sm">
                {t.sections.generateBtn}
              </Button>
            </Link>
          </div>

          {/* Right Column: AI Results Preview (Generated in 4.2 seconds) */}
          <div className="lg:col-span-7 flex flex-col h-full gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold tracking-tight text-foreground">
                {t.sections.aiResultsTitle}
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                ✓ {t.sections.generatedIn}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Variation 1: Guaranteed Pure White Studio (Amazon / Flipkart standard) */}
              <div className="h-full flex flex-col rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
                <div className="aspect-square rounded-xl overflow-hidden bg-white border border-stone-200 relative">
                  <img
                    src="/images/demo-watch-white.webp"
                    alt="Black smartwatch on a pure white studio background"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-stone-900 text-white text-[9px] font-bold">
                      {isHi ? "प्योर स्टूडियो व्हाइट" : "Pure Studio White"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 mt-auto">
                  <span className="text-xs font-bold text-foreground">
                    {isHi ? "क्लासिक व्हाइट स्टूडियो" : "Classic White Studio"}
                  </span>
                  <Link href="/app/generate">
                    <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-primary border-primary/30">
                      {t.sections.selectAndCreate}
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Variation 2: Warm Studio / Lifestyle Scene */}
              <div className="h-full flex flex-col rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
                <div className="aspect-square rounded-xl overflow-hidden relative">
                  <img
                    src="/images/demo-headphones-lifestyle.webp"
                    alt="White wireless headphones resting on a warm wooden table"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-stone-900 text-white text-[9px] font-bold">
                      {isHi ? "वार्म स्टूडियो लाइटिंग" : "Warm Studio Lighting"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 mt-auto">
                  <span className="text-xs font-bold text-foreground">
                    {isHi ? "लाइफ़स्टाइल सीन" : "Lifestyle Lighting"}
                  </span>
                  <Link href="/app/generate">
                    <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-primary border-primary/30">
                      {t.sections.selectAndCreate}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Also included in every kit - fills the column so both sides end level on desktop */}
            <div className="flex-1 rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col justify-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "हर किट में शामिल" : "Also included in every kit"}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Sparkles, label: isHi ? "SEO कैटलॉग कॉपी" : "SEO catalog copy" },
                  {
                    icon: Instagram,
                    label: isHi ? "3 सोशल कार्ड (WhatsApp, इंस्टा पोस्ट, स्टोरी)" : "3 social cards (WhatsApp, Insta post, story)",
                  },
                  { icon: Download, label: isHi ? "Excel कैटलॉग एक्सपोर्ट" : "Excel catalog export" },
                  { icon: MessageCircle, label: isHi ? "WhatsApp ब्रॉडकास्ट टेक्स्ट" : "WhatsApp broadcast text" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5 text-xs font-medium text-foreground">
                    <span className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

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
                  ? "bg-primary text-white shadow-xs"
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
                          <span className="text-[10px] text-emerald-700 font-semibold block mt-1">
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
                            <span className="text-[10px] font-bold text-emerald-700">48% {isHi ? "छूट" : "off"}</span>
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
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  {isHi ? "हाई रेजोल्यूशन ऑलवेज-ऑन रेटिना डिस्प्ले" : "High Resolution Always-On Retina Display"}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  {isHi ? "मल्टीपल स्पोर्ट्स और फिटनेस ट्रैकिंग मोड्स" : "Multiple Sports & Fitness Tracking Modes"}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  {isHi ? "फास्ट चार्ज के साथ 7-दिन की लॉन्ग-लास्टिंग बैटरी" : "Long-Lasting 7-Day Battery with Fast Charge"}
                </li>
              </ul>
            </div>

            <Link href="/app/generate" className="block mt-auto pt-2">
              <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md gap-2">
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

        {/* 4 Universal Pricing Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pack 1: Studio Kickstart */}
          <Card className="relative flex flex-col justify-between transition-all hover:scale-[1.02] border-border/70 bg-card rounded-2xl shadow-xs hover:border-border">
            <CardContent className="p-6 space-y-6 pt-7 flex flex-col justify-between h-full">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {isHi ? "स्टूडियो किकस्टार्ट" : "Studio Kickstart"}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black font-serif text-foreground">₹249</span>
                  <span className="text-xs text-muted-foreground">/ 10 {t.sections.creditsUnit}</span>
                </div>
                <span className="inline-block mt-1 text-xs text-muted-foreground font-medium">
                  ₹24.90 {t.pricingPage.perCredit}
                </span>
              </div>

              <div className="space-y-3 pt-2 border-t border-border/50">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {t.pricingPage.featuresIncluded}
                </span>
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>5 {isHi ? "स्टूडियो जेनरेशन्स" : "Quick Studio Generations"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f1}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f3}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f4}</span>
                  </li>
                </ul>
              </div>

              <Link href="/pricing" className="block w-full">
                <Button className="w-full font-bold h-11 rounded-xl shadow-sm text-xs bg-muted hover:bg-muted/80 text-foreground border border-border">
                  {t.pricingPage.buyBtn} (₹249)
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Pack 2: Growth Seller */}
          <Card className="relative flex flex-col justify-between transition-all hover:scale-[1.02] border-border/70 bg-card rounded-2xl shadow-xs hover:border-border">
            <CardContent className="p-6 space-y-6 pt-7 flex flex-col justify-between h-full">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {isHi ? "ग्रोथ सेलर" : "Growth Seller"}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black font-serif text-foreground">₹599</span>
                  <span className="text-xs text-muted-foreground">/ 30 {t.sections.creditsUnit}</span>
                </div>
                <span className="inline-block mt-1 text-xs text-muted-foreground font-medium">
                  ₹19.97 {t.pricingPage.perCredit}
                </span>
              </div>

              <div className="space-y-3 pt-2 border-t border-border/50">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {t.pricingPage.featuresIncluded}
                </span>
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>15 {isHi ? "स्टूडियो जेनरेशन्स" : "Quick Studio Generations"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f1}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f3}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f4}</span>
                  </li>
                </ul>
              </div>

              <Link href="/pricing" className="block w-full">
                <Button className="w-full font-bold h-11 rounded-xl shadow-sm text-xs bg-muted hover:bg-muted/80 text-foreground border border-border">
                  {t.pricingPage.buyBtn} (₹599)
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Pack 3: Merchant Pro (Popular) */}
          <Card className="relative flex flex-col justify-between transition-all hover:scale-[1.02] border-2 border-primary shadow-xl shadow-primary/10 bg-primary/5 ring-1 ring-primary/30 rounded-2xl">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-white font-black uppercase text-[10px] px-3 py-0.5 shadow-sm">
                {t.pricingPage.popularBadge}
              </Badge>
            </div>
            <CardContent className="p-6 space-y-6 pt-7 flex flex-col justify-between h-full">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {isHi ? "मर्चेंट प्रो" : "Merchant Pro"}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black font-serif text-foreground">₹1,299</span>
                  <span className="text-xs text-muted-foreground">/ 80 {t.sections.creditsUnit}</span>
                </div>
                <span className="inline-block mt-1 text-xs text-muted-foreground font-medium">
                  ₹16.24 {t.pricingPage.perCredit}
                </span>
              </div>

              <div className="space-y-3 pt-2 border-t border-border/50">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {t.pricingPage.featuresIncluded}
                </span>
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>40 {isHi ? "स्टूडियो जेनरेशन्स" : "Quick Studio Generations"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f1}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f3}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f4}</span>
                  </li>
                </ul>
              </div>

              <Link href="/pricing" className="block w-full">
                <Button className="w-full font-bold h-11 rounded-xl shadow-md shadow-primary/20 text-xs bg-primary hover:bg-primary/90 text-white">
                  {t.pricingPage.buyBtn} (₹1,299)
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Pack 4: Brand Studio (Best Value) */}
          <Card className="relative flex flex-col justify-between transition-all hover:scale-[1.02] border-border/70 bg-card rounded-2xl shadow-xs hover:border-border">
            <CardContent className="p-6 space-y-6 pt-7 flex flex-col justify-between h-full">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {isHi ? "ब्रांड स्टूडियो" : "Brand Studio"}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black font-serif text-foreground">₹2,799</span>
                  <span className="text-xs text-muted-foreground">/ 200 {t.sections.creditsUnit}</span>
                </div>
                <span className="inline-block mt-1 text-xs text-muted-foreground font-medium">
                  ₹13.99 {t.pricingPage.perCredit}
                </span>
              </div>

              <div className="space-y-3 pt-2 border-t border-border/50">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {t.pricingPage.featuresIncluded}
                </span>
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>100 {isHi ? "स्टूडियो जेनरेशन्स" : "Quick Studio Generations"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f1}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f3}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{t.pricingPage.f4}</span>
                  </li>
                </ul>
              </div>

              <Link href="/pricing" className="block w-full">
                <Button className="w-full font-bold h-11 rounded-xl shadow-sm text-xs bg-muted hover:bg-muted/80 text-foreground border border-border">
                  {t.pricingPage.buyBtn} (₹2,799)
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Custom credit pack: same component as the pricing page */}
        <CustomTopup />

        {/* Pricing FAQs (Matches Pricing Page) */}
        <div className="max-w-3xl mx-auto space-y-6 pt-4">
          <div className="text-center space-y-1">
            <h3 className="text-xl sm:text-2xl font-black font-serif tracking-tight text-foreground">
              {t.pricingPage.faqTitle}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.pricingPage.faqSubtitle}
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-border/70 bg-card space-y-1 shadow-xs">
              <h4 className="font-bold text-xs sm:text-sm text-foreground">
                {t.pricingPage.faq1Q}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t.pricingPage.faq1A}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/70 bg-card space-y-1 shadow-xs">
              <h4 className="font-bold text-xs sm:text-sm text-foreground">
                {t.pricingPage.faq2Q}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t.pricingPage.faq2A}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/70 bg-card space-y-1 shadow-xs">
              <h4 className="font-bold text-xs sm:text-sm text-foreground">
                {t.pricingPage.faq3Q}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t.pricingPage.faq3A}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECTION 4: PRODUCT HISTORY SHOWCASE (Ref Image 4 & 5) ================= */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16 space-y-8 border-t border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight">
              {t.sections.historyTitle}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {t.sections.historySubtitle}
            </p>
          </div>

          {/* Filter Pills: All, WhatsApp, Meesho */}
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-full border border-border text-xs w-fit">
            {[
              { id: "all", label: t.sections.filterAll },
              { id: "whatsapp", label: t.sections.filterWhatsapp },
              { id: "meesho", label: t.sections.filterMeesho },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveHistoryFilter(f.id as any)}
                className={`px-3 py-1 rounded-full font-bold transition-all text-xs ${
                  activeHistoryFilter === f.id
                    ? "bg-primary text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Cards Grid Matching Ref Image 4 & 5 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs flex flex-col justify-between group hover:border-primary/40 transition-colors"
            >
              <div className="aspect-square bg-muted/30 overflow-hidden relative">
                <img
                  src={item.img}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <h4 className="font-bold text-sm text-foreground line-clamp-1">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {item.time}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                  <Link href="/app/generate" className="flex-1">
                    <Button variant="ghost" size="sm" className="w-full h-7 text-xs font-semibold text-muted-foreground hover:text-foreground">
                      {t.sections.edit}
                    </Button>
                  </Link>
                  <Link href="/app/history" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs font-bold text-primary border-primary/30">
                      {t.sections.viewKit}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
