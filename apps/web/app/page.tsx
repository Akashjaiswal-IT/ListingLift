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
  Coins,
  ChevronRight,
  RotateCw,
  Sliders,
  Check,
  Play,
  Share2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { useLanguage } from "~/providers/LanguageContext";
import { toast } from "sonner";
import { OnboardingTour } from "~/components/onboarding/OnboardingTour";
import { BeforeAfterSlider } from "~/components/landing/BeforeAfterSlider";

export default function HomePage() {
  const { t, language } = useLanguage();
  const isHi = language === "hi";
  const [activeTab, setActiveTab] = useState<"whatsapp" | "meesho" | "instagram">("whatsapp");
  const [activeHistoryFilter, setActiveHistoryFilter] = useState<"all" | "whatsapp" | "meesho">("all");
  const [customCredits, setCustomCredits] = useState(220);
  const [selectedStyle, setSelectedStyle] = useState("studio_white");
  const [copied, setCopied] = useState(false);

  const calculateCustomPrice = (credits: number) => {
    if (credits >= 500) return Math.round(credits * 11);
    if (credits >= 200) return Math.round(credits * 14);
    if (credits >= 80) return Math.round(credits * 17);
    if (credits >= 30) return Math.round(credits * 20);
    return Math.round(credits * 25);
  };

  const handleCopyCaption = () => {
    const textToCopy = isHi
      ? `✨ नया कलेक्शन: प्रीमियम स्मार्टवॉच 🔥\nआज ही अपना स्टाइल अपग्रेड करें!\n✅ वाटर रेसिस्टेंट\n✅ 7 दिन की बैटरी\n✅ हार्ट रेट मॉनिटर\n*ऑफ़र प्राइस:* ₹1,299 मात्र\n*मुफ़्त शिपिंग* पूरे भारत में 🇮🇳\nऑर्डर करने के लिए अपना पता भेजें।`
      : `✨ New Arrival: Premium Smartwatch 🔥\nUpgrade your style today!\n✅ Water Resistant\n✅ 7 Day Battery\n✅ Heart Rate Monitor\n*Price:* ₹1,299 only\n*Free Shipping* across India 🇮🇳\nTo order, reply with your address.`;
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
      img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: "3",
      title: isHi ? "वायरलेस हेडफ़ोन" : "Wireless Headphones",
      time: isHi ? "3 दिन पहले" : "Added 3 days ago",
      type: "whatsapp",
      img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: "4",
      title: isHi ? "प्रीमियम लेदर बैग" : "Leather Bag",
      time: isHi ? "1 सप्ताह पहले" : "Added 1 week ago",
      type: "meesho",
      img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80",
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

      {/* MOBILE-ONLY SELLER QUICK VIEW (Matches Reference Image 1) */}
      <section className="md:hidden p-4 space-y-4">
        {/* Top User Pill Header */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-xs">
              PV
            </div>
            <div>
              <div className="font-bold text-sm leading-tight text-foreground">
                Priya Verma
              </div>
              <span className="text-[10px] font-semibold text-primary">
                ★ {t.mobile.starReseller}
              </span>
            </div>
          </div>
          <Link href="/app/credits">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs shadow-2xs">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              <span>42 {t.sections.creditsUnit}</span>
            </div>
          </Link>
        </div>

        {/* Vibrant Orange Mobile Banner (Ref Image 1) */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#E05822] via-[#E8632E] to-amber-600 text-white space-y-4 shadow-lg shadow-primary/20">
          <div>
            <h2 className="text-2xl font-black tracking-tight leading-snug">
              {t.mobile.boostSales}
            </h2>
            <p className="text-xs text-white/90 mt-1">
              {t.mobile.boostDesc}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/95 dark:bg-card text-foreground space-y-3 shadow-md">
            <div>
              <h3 className="font-bold text-base text-primary">
                {t.mobile.studioRevamp}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.mobile.studioRevampDesc}
              </p>
            </div>
            <Link href="/app/generate" className="block">
              <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-black text-sm rounded-xl shadow-sm">
                {t.mobile.revampBtn}
              </Button>
            </Link>
          </div>
        </div>

        {/* Success Stories Card (Ref Image 1) */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t.mobile.successStories}
          </span>
          <div className="flex items-center gap-3.5 p-2 rounded-xl bg-muted/30">
            <img
              src="/images/hero-after.jpg"
              alt="Backpack Transformation"
              className="w-14 h-14 rounded-lg object-cover bg-stone-800"
            />
            <div>
              <h4 className="font-bold text-xs text-foreground">
                {isHi ? "ब्लैक बैकपैक (बैग)" : "Black Backpack Pro"}
              </h4>
              <p className="text-[11px] text-muted-foreground">
                {isHi ? "स्टूडियो व्हाइट में बदला गया" : "Transformed to Studio White"}
              </p>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] font-bold mt-1">
                {t.mobile.moreInquiries}
              </Badge>
            </div>
          </div>
        </div>

        {/* Popular Contexts Pills (Ref Image 1) */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            {t.mobile.popularContexts}
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { name: t.mobile.ctxPremium, icon: "🏠", color: "bg-rose-500/10 text-rose-600" },
              { name: t.mobile.ctxLifestyle, icon: "🌳", color: "bg-blue-500/10 text-blue-600" },
              { name: t.mobile.ctxStudio, icon: "⚪", color: "bg-emerald-500/10 text-emerald-600" },
              { name: t.mobile.ctxFestive, icon: "✨", color: "bg-amber-500/10 text-amber-600" },
            ].map((ctx, idx) => (
              <Link key={idx} href="/app/generate" className="shrink-0">
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border/80 w-20 text-center hover:border-primary/50 transition-colors">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg ${ctx.color}`}>
                    {ctx.icon}
                  </div>
                  <span className="text-[11px] font-bold text-foreground">{ctx.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
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
          <div className="lg:col-span-7 space-y-4">
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
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
                <div className="aspect-square rounded-xl overflow-hidden bg-white border border-stone-200 flex items-center justify-center p-4 relative">
                  <img
                    src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=500&q=85"
                    alt="Clean White Studio Watch"
                    className="w-full h-full object-contain filter drop-shadow-md"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-stone-900 text-white text-[9px] font-bold">
                      {isHi ? "प्योर स्टूडियो व्हाइट" : "Pure Studio White"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
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
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
                <div className="aspect-square rounded-xl overflow-hidden bg-[#F5C242] flex items-center justify-center p-4 relative">
                  <img
                    src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=85"
                    alt="Warm Lighting Headphones"
                    className="w-full h-full object-contain filter drop-shadow-xl"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-stone-900 text-white text-[9px] font-bold">
                      {isHi ? "वार्म स्टूडियो लाइटिंग" : "Warm Studio Lighting"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
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
        <div className="flex items-center gap-2">
          {[
            { id: "whatsapp", label: t.sections.tabWhatsapp },
            { id: "meesho", label: t.sections.tabMeesho },
            { id: "instagram", label: t.sections.tabInstagram },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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

        {/* 3-Card Grid Matching Ref Image 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Left: WhatsApp Card Preview */}
          <div className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {isHi ? "व्हाट्सएप कार्ड" : "WhatsApp Card"}
            </span>
            <div className="rounded-xl overflow-hidden bg-white border border-stone-200 p-4 space-y-3 text-stone-900">
              <div className="aspect-square rounded-lg bg-stone-50 flex items-center justify-center p-2">
                <img
                  src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80"
                  alt="Watch"
                  className="w-full h-full object-contain"
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
              <Button size="sm" className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs h-8">
                <MessageCircle className="h-3.5 w-3.5 mr-1" />
                {t.sections.messageToOrder}
              </Button>
            </div>
          </div>

          {/* Middle: WhatsApp Caption with One-Click Copy */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "व्हाट्सएप कैप्शन" : "WhatsApp Caption"}
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
            <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-xs font-mono whitespace-pre-wrap leading-relaxed">
              {isHi
                ? "✨ नया कलेक्शन: प्रीमियम स्मार्टवॉच 🔥\nआज ही अपना स्टाइल अपग्रेड करें!\n✅ वाटर रेसिस्टेंट\n✅ 7 दिन की बैटरी\n✅ हार्ट रेट मॉनिटर\n*ऑफ़र प्राइस:* ₹1,299 मात्र\n*मुफ़्त शिपिंग* पूरे भारत में 🇮🇳\nऑर्डर करने के लिए अपना पता भेजें।"
                : "✨ New Arrival: Premium Smartwatch 🔥\nUpgrade your style today!\n✅ Water Resistant\n✅ 7 Day Battery\n✅ Heart Rate Monitor\n*Price:* ₹1,299 only\n*Free Shipping* across India 🇮🇳\nTo order, reply with your address."}
            </div>
          </div>

          {/* Right: AI Product Details & Download Entire Kit */}
          <div className="p-6 rounded-2xl bg-[#161311] text-[#FAF7F2] border border-stone-800 space-y-5 shadow-md">
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

            <Link href="/app/generate" className="block pt-2">
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

        {/* Custom Credit Pack Slider Card (Matches Pricing Page) */}
        <div className="p-6 sm:p-10 rounded-3xl border-2 border-primary/20 bg-card shadow-lg max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-lg text-foreground">
                  {t.pricingPage.customTitle}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.pricingPage.customSubtitle}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl sm:text-4xl font-black font-serif text-primary">
                ₹{calculateCustomPrice(customCredits).toLocaleString("en-IN")}
              </div>
              <span className="text-xs text-muted-foreground font-semibold">
                ≈ ₹{(calculateCustomPrice(customCredits) / customCredits).toFixed(1)} {t.pricingPage.perCredit}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="range"
              min={10}
              max={1000}
              step={10}
              value={customCredits}
              onChange={(e) => setCustomCredits(Number(e.target.value))}
              className="w-full accent-primary h-2.5 bg-muted rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground font-semibold">
              <span>10 {t.sections.creditsUnit}</span>
              <span className="text-primary font-black text-sm">
                {customCredits} {t.sections.creditsUnit} ({t.pricingPage.selected})
              </span>
              <span>1,000 {t.sections.creditsUnit}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>{isHi ? "तत्काल सक्रियण • स्वचालित रिफंड सुरक्षा" : "Instant Activation • Automatic Refund Protection"}</span>
            </div>
            <Link href="/pricing" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto h-11 px-8 font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md gap-2 text-xs"
              >
                <Sparkles className="h-4 w-4" />
                {t.pricingPage.buyCustomBtn} (₹{calculateCustomPrice(customCredits).toLocaleString("en-IN")})
              </Button>
            </Link>
          </div>
        </div>

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
