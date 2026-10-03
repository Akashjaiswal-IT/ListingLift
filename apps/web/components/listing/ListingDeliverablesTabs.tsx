"use client";

import Link from "next/link";
import {
  Sparkles,
  Download,
  Copy,
  RotateCw,
  ShoppingBag,
  MessageCircle,
  Instagram,
  CheckCircle2,
  Search,
  Tag,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { toast } from "sonner";
import { CARD_TEMPLATES_MAP, TemplateId } from "~/lib/card-templates";
import { useLanguage } from "~/providers/LanguageContext";
import { useCallback } from "react";
import { downloadFile } from "~/lib/download";
import { trackEvent } from "~/lib/analytics";

export interface ListingDeliverablesTabsProps {
  listing: any;
  defaultTab?: string;
  onReEditClick?: (img: any) => void;
}

export function ListingDeliverablesTabs({
  listing,
  defaultTab = "photos",
  onReEditClick,
}: ListingDeliverablesTabsProps) {
  const { language } = useLanguage();
  const isHi = language === "hi";

  if (!listing) return null;

  const listingId = listing._id || listing.id;
  const text = listing.aiGeneratedText;

  const handleDownload = useCallback((url: string, filename: string) => {
    toast.info(isHi ? "डाउनलोड शुरू हो रहा है…" : "Starting download…");
    trackEvent("listing_downloaded", { filename, listingId });
    downloadFile(url, filename)
      .then(() => {
        toast.success(isHi ? "डाउनलोड पूरा!" : "Download complete!");
      })
      .catch((err) => {
        toast.error(isHi ? "डाउनलोड विफल रहा" : "Download failed");
      });
  }, [isHi, listingId]);

  const copyText = (txt?: string, label?: string) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    trackEvent("listing_copied", { label: label || "text", listingId });
    toast.success(isHi ? `${label || "टेक्स्ट"} कॉपी हो गया!` : `Copied ${label || "text"} to clipboard!`);
  };

  return (
    <Tabs defaultValue={defaultTab} className="space-y-6">
      <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 max-w-3xl">
        <TabsTrigger value="photos" className="gap-1.5 text-xs font-bold">
          <Sparkles className="h-3.5 w-3.5" /> {isHi ? "फ़ोटो" : "Photos"}
        </TabsTrigger>
        <TabsTrigger value="catalog" className="gap-1.5 text-xs font-bold">
          <ShoppingBag className="h-3.5 w-3.5" /> {isHi ? "कैटलॉग" : "Catalog"}
        </TabsTrigger>
        <TabsTrigger value="seo" className="gap-1.5 text-xs font-bold">
          <Search className="h-3.5 w-3.5" /> {isHi ? "एसईओ बुलेट्स" : "SEO & Bullets"}
        </TabsTrigger>
        <TabsTrigger value="whatsapp" className="gap-1.5 text-xs font-bold">
          <MessageCircle className="h-3.5 w-3.5" /> {isHi ? "व्हाट्सएप" : "WhatsApp"}
        </TabsTrigger>
        <TabsTrigger value="instagram" className="gap-1.5 text-xs font-bold">
          <Instagram className="h-3.5 w-3.5" /> {isHi ? "इंस्टाग्राम" : "Instagram"}
        </TabsTrigger>
        <TabsTrigger value="cards" className="gap-1.5 text-xs font-bold">
          <Tag className="h-3.5 w-3.5" /> {isHi ? "कार्ड्स" : "Cards"}
        </TabsTrigger>
      </TabsList>

      {/* 1. PHOTOS TAB */}
      <TabsContent value="photos" className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {/* Original Uploaded Images */}
          {listing.originalImages?.map((orig: any, idx: number) => (
            <Card key={`orig-${idx}`} className="overflow-hidden border-border/60 bg-muted/10 flex flex-col justify-between">
              <div className="relative aspect-square bg-muted">
                <img src={orig.url} alt={`Original Photo ${idx + 1}`} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2">
                  <Badge variant="outline" className="bg-background/80 text-[10px] backdrop-blur-sm font-semibold">
                    {isHi ? "मूल अपलोड फ़ोटो" : "Original Upload"}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-3.5 flex items-center justify-between border-t border-border/40">
                <span className="text-xs text-muted-foreground font-medium">
                  {isHi ? `इनपुट फ़ोटो #${idx + 1}` : `Input Photo #${idx + 1}`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => handleDownload(orig.url, `original-photo-${idx + 1}.jpg`)}
                >
                  <Download className="h-3 w-3" /> {isHi ? "मूल फ़ोटो सेव करें" : "Save Original"}
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Generated Studio Variations */}
          {(listing.generatedImages || []).filter((img: any) => img.isLatest !== false).map((img: any, idx: number) => (
            <Card key={img._id || idx} className="overflow-hidden border-border/60 flex flex-col justify-between">
              <div className="relative aspect-square bg-muted">
                <img src={img.url} alt={`Studio variation ${idx + 1}`} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {img.variationType === "studio_white"
                      ? isHi ? "प्योर व्हाइट स्टूडियो" : "Pure White Studio"
                      : img.variationType === "studio_premium"
                      ? isHi ? "प्रीमियम पोडियम" : "Premium Podium"
                      : img.variationType === "lifestyle"
                      ? isHi ? "लाइफ़स्टाइल" : "Lifestyle"
                      : (img.variationType?.replace("_", " ") || "Studio")}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-3.5 flex items-center justify-between border-t border-border/40">
                <span className="text-xs text-muted-foreground font-medium">
                  {isHi ? `वेरिएशन #${idx + 1}` : `Variation #${idx + 1}`}
                </span>
                <div className="flex items-center gap-1.5">
                  {onReEditClick ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReEditClick(img)}
                      className="h-8 text-xs gap-1 text-[#E05822] hover:text-[#c94917] hover:bg-[#E05822]/10"
                    >
                      <RotateCw className="h-3 w-3" /> {isHi ? "री-एडिट" : "Re-edit"}
                    </Button>
                  ) : listingId ? (
                    <Link href={`/app/re-edit/${listingId}/${img._id}`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-[#E05822] hover:text-[#c94917] hover:bg-[#E05822]/10">
                        <RotateCw className="h-3 w-3" /> {isHi ? "री-एडिट" : "Re-edit"}
                      </Button>
                    </Link>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => handleDownload(img.url, `studio-variation-${idx + 1}.jpg`)}
                  >
                    <Download className="h-3 w-3" /> {isHi ? "डाउनलोड" : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      {/* 2. CATALOG TAB */}
      <TabsContent value="catalog" className="space-y-6 max-w-3xl">
        <Card className="border-border/60 p-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "मार्केटप्लेस ऑप्टिमाइज़्ड टाइटल (Amazon, Flipkart, Meesho, Shopify)" : "Marketplace Optimized Title (Amazon, Flipkart, Meesho, Shopify)"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyText(text?.meeshoListing?.title || text?.seoTitle, isHi ? "टाइटल" : "Title")}
                className="h-7 text-xs gap-1 font-semibold text-[#E05822] hover:text-[#c94917] hover:bg-[#E05822]/10"
              >
                <Copy className="h-3 w-3" /> {isHi ? "टाइटल कॉपी करें" : "Copy Title"}
              </Button>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 font-medium text-sm border border-border/40">
              {text?.meeshoListing?.title || text?.seoTitle || listing.userTitle || (isHi ? "उत्पाद टाइटल" : "Product Title")}
            </div>
          </div>

          {(text?.meeshoListing?.category || text?.meeshoListing?.subcategory) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{isHi ? "अनुशंसित श्रेणी:" : "Suggested Category:"}</span>
              <Badge variant="outline">
                {text?.meeshoListing?.category || "Fashion"} &gt; {text?.meeshoListing?.subcategory || "Apparel"}
              </Badge>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "मार्केटप्लेस विवरण और स्पेसिफिकेशन" : "Marketplace Description & Specifications"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyText(text?.meeshoListing?.description, isHi ? "विवरण" : "Description")}
                className="h-7 text-xs gap-1 font-semibold text-[#E05822] hover:text-[#c94917] hover:bg-[#E05822]/10"
              >
                <Copy className="h-3 w-3" /> {isHi ? "विवरण कॉपी करें" : "Copy Description"}
              </Button>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 text-xs text-foreground whitespace-pre-wrap font-mono border border-border/40 leading-relaxed">
              {text?.meeshoListing?.description || (isHi ? "उत्पाद कैटलॉग विवरण..." : "Product catalog details...")}
            </div>
          </div>
        </Card>
      </TabsContent>

      {/* 3. SEO & BULLETS TAB */}
      <TabsContent value="seo" className="space-y-6 max-w-3xl">
        <Card className="border-border/60 p-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "एसईओ सर्च-ऑप्टिमाइज़्ड टाइटल (50-80 अक्षर)" : "SEO Search-Optimized Title (50-80 chars)"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyText(text?.seoTitle, "SEO Title")}
                className="h-7 text-xs gap-1 font-semibold text-[#E05822] hover:text-[#c94917] hover:bg-[#E05822]/10"
              >
                <Copy className="h-3 w-3" /> {isHi ? "कॉपी करें" : "Copy"}
              </Button>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 font-semibold text-sm border border-border/40">
              {text?.seoTitle || (isHi ? "ऑप्टिमाइज़्ड टाइटल" : "Optimized Title")}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "एसईओ मेटा डिस्क्रिप्शन" : "SEO Meta Description"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyText(text?.seoDescription, "Meta Description")}
                className="h-7 text-xs gap-1 font-semibold text-[#E05822] hover:text-[#c94917] hover:bg-[#E05822]/10"
              >
                <Copy className="h-3 w-3" /> {isHi ? "कॉपी करें" : "Copy"}
              </Button>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground border border-border/40 leading-relaxed">
              {text?.seoDescription || (isHi ? "मेटा विवरण..." : "Meta description...")}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "हाई-कन्वर्टिंग फ़ीचर बुलेट्स" : "High-Converting Feature Bullet Points"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyText(text?.keyFeatures?.map((f: string) => `• ${f}`).join("\n"), isHi ? "बुलेट पॉइंट्स" : "Bullet Points")}
                className="h-7 text-xs gap-1 font-semibold text-[#E05822] hover:text-[#c94917] hover:bg-[#E05822]/10"
              >
                <Copy className="h-3 w-3" /> {isHi ? "सभी कॉपी करें" : "Copy All"}
              </Button>
            </div>
            <div className="space-y-2">
              {text?.keyFeatures?.map((feature: string, i: number) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border/30 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              )) || <div className="text-xs text-muted-foreground">{isHi ? "फ़ीचर्स..." : "Features..."}</div>}
            </div>
          </div>

          {text?.keywords && text.keywords.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                {isHi ? "सर्च कीवर्ड्स और टैग्स" : "Search Keywords & Tags"}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {text.keywords.map((kw: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs py-1 px-2.5 bg-muted/20 cursor-pointer hover:bg-muted/40" onClick={() => copyText(kw, isHi ? "कीवर्ड" : "Keyword")}>
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </TabsContent>

      {/* 4. WHATSAPP TAB */}
      <TabsContent value="whatsapp" className="space-y-6 max-w-2xl">
        <Card className="border-border/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isHi ? "व्हाट्सएप ब्रॉडकास्ट कॉपी" : "WhatsApp Broadcast Copy"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs font-semibold gap-1 text-[#E05822] hover:text-[#c94917] hover:bg-[#E05822]/10"
                onClick={() => copyText(text?.whatsappCaption, isHi ? "व्हाट्सएप कॉपी" : "WhatsApp Caption")}
              >
                <Copy className="h-3 w-3" /> {isHi ? "टेक्स्ट कॉपी करें" : "Copy Text"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs font-semibold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={() => {
                  copyText(text?.whatsappCaption, isHi ? "व्हाट्सएप कॉपी" : "WhatsApp Caption");
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text?.whatsappCaption || "")}`, "_blank");
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" /> {isHi ? "व्हाट्सएप पर शेयर करें" : "Share to WhatsApp"}
              </Button>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs font-medium whitespace-pre-wrap leading-relaxed">
            {text?.whatsappCaption || (isHi ? "व्हाट्सएप कैप्शन..." : "WhatsApp caption...")}
          </div>
        </Card>
      </TabsContent>

      {/* 5. INSTAGRAM TAB */}
      <TabsContent value="instagram" className="space-y-6 max-w-2xl">
        <Card className="border-border/60 p-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "इंस्टाग्राम पोस्ट कैप्शन" : "Instagram Caption"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyText(text?.instagramCaption, isHi ? "इंस्टाग्राम कैप्शन" : "Instagram Caption")}
                className="h-7 text-xs gap-1 font-semibold text-[#E05822] hover:text-[#c94917] hover:bg-[#E05822]/10"
              >
                <Copy className="h-3 w-3" /> {isHi ? "कैप्शन कॉपी करें" : "Copy Caption"}
              </Button>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 text-xs whitespace-pre-wrap border border-border/40 leading-relaxed">
              {text?.instagramCaption || (isHi ? "इंस्टाग्राम कैप्शन..." : "Instagram caption...")}
            </div>
          </div>

          {text?.instagramHashtags && text.instagramHashtags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isHi ? "टारगेटेड ई-कॉमर्स हैशटैग्स" : "Targeted E-Commerce Hashtags"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyText(text?.instagramHashtags?.join(" "), isHi ? "हैशटैग्स" : "Hashtags")}
                  className="h-7 text-xs gap-1 font-semibold text-[#E05822] hover:text-[#c94917] hover:bg-[#E05822]/10"
                >
                  <Copy className="h-3 w-3" /> {isHi ? "सभी हैशटैग्स कॉपी करें" : "Copy All Hashtags"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {text.instagramHashtags.map((tag: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs text-[#E05822] py-1 px-2.5">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </TabsContent>

      {/* 6. CARDS TAB */}
      <TabsContent value="cards" className="space-y-6">
        {listing.templateId && CARD_TEMPLATES_MAP[listing.templateId as TemplateId] && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-[#E05822]/20 bg-[#E05822]/5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{isHi ? "सक्रिय डिज़ाइन टेम्पलेट:" : "Active Template:"}</span>
              <Badge variant="outline" className="font-semibold text-xs border-[#E05822]/30 text-[#E05822]">
                {CARD_TEMPLATES_MAP[listing.templateId as TemplateId].name}
              </Badge>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                — {CARD_TEMPLATES_MAP[listing.templateId as TemplateId].description}
              </span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {listing.whatsappCard?.url && (
            <Card className="overflow-hidden border-border/60">
              <div className="aspect-square bg-muted">
                <img src={listing.whatsappCard.url} alt="WhatsApp Card" className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-3.5 flex items-center justify-between">
                <span className="text-xs font-semibold">{isHi ? "व्हाट्सएप कार्ड" : "WhatsApp Card"}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  onClick={() => handleDownload(listing.whatsappCard.url, "whatsapp-card.jpg")}
                >
                  <Download className="h-3 w-3" /> {isHi ? "डाउनलोड" : "Download"}
                </Button>
              </CardContent>
            </Card>
          )}

          {listing.instagramPost?.url && (
            <Card className="overflow-hidden border-border/60">
              <div className="aspect-square bg-muted">
                <img src={listing.instagramPost.url} alt="Instagram Post" className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-3.5 flex items-center justify-between">
                <span className="text-xs font-semibold">{isHi ? "इंस्टाग्राम पोस्ट (1:1)" : "Instagram Post (1:1)"}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  onClick={() => handleDownload(listing.instagramPost.url, "instagram-post.jpg")}
                >
                  <Download className="h-3 w-3" /> {isHi ? "डाउनलोड" : "Download"}
                </Button>
              </CardContent>
            </Card>
          )}

          {listing.instagramStory?.url && (
            <Card className="overflow-hidden border-border/60">
              <div className="aspect-[9/16] bg-muted max-h-[400px]">
                <img src={listing.instagramStory.url} alt="Instagram Story" className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-3.5 flex items-center justify-between">
                <span className="text-xs font-semibold">{isHi ? "इंस्टाग्राम स्टोरी (9:16)" : "Instagram Story (9:16)"}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  onClick={() => handleDownload(listing.instagramStory.url, "instagram-story.jpg")}
                >
                  <Download className="h-3 w-3" /> {isHi ? "डाउनलोड" : "Download"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
