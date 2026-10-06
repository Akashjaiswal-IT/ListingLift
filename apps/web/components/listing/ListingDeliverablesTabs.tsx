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
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { CARD_TEMPLATES_INFO, CARD_TEMPLATES_MAP, CardTemplateInfo, TemplateId } from "~/lib/card-templates";
import { useLanguage } from "~/providers/LanguageContext";
import { downloadFile } from "~/lib/download";
import { trackEvent } from "~/lib/analytics";
import { trpc } from "~/trpc/client";
import { Loader2 } from "lucide-react";

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
  const utils = trpc.useUtils();
  const [renderingTemplateId, setRenderingTemplateId] = useState<string | null>(null);

  const undoReEditMutation = trpc.generate.undoReEdit.useMutation({
    onSuccess: () => {
      toast.success(isHi ? "पिछला वर्ज़न बहाल कर दिया गया!" : "Reverted to the previous version!");
      utils.listing.getById.invalidate({ id: listingId });
    },
    onError: (err) => {
      toast.error(err.message || (isHi ? "वापस लाने में विफल" : "Could not undo"));
    },
  });

  const regenerateCardsMutation = trpc.card.regenerateCards.useMutation({
    onSuccess: () => {
      toast.success(
        isHi
          ? "कार्ड्स सफलतापूर्वक नए स्टाइल में तैयार हो गए!"
          : "Cards successfully rendered in selected festival style!"
      );
      utils.listing.getById.invalidate({ id: listingId });
      setRenderingTemplateId(null);
    },
    onError: (err) => {
      toast.error(
        isHi
          ? `कार्ड तैयार करने में त्रुटि: ${err.message}`
          : `Failed to render cards: ${err.message}`
      );
      setRenderingTemplateId(null);
    },
  });

  const handleApplyTemplate = (templateId: TemplateId) => {
    setRenderingTemplateId(templateId);
    toast.info(isHi ? "कार्ड्स रेंडर हो रहे हैं…" : "Rendering festival cards…");
    regenerateCardsMutation.mutate({
      listingObjectId: listingId,
      templateId,
    });
  };

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
                  {/* Undo appears only when this image replaced an earlier one
                      (some hidden version points at it via replacedBy). */}
                  {(listing.generatedImages || []).some(
                    (h: any) => String(h.replacedBy) === String(img._id)
                  ) && listingId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={undoReEditMutation.isPending}
                      onClick={() =>
                        undoReEditMutation.mutate({
                          listingObjectId: listingId,
                          generatedImageId: String(img._id),
                        })
                      }
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      title={isHi ? "री-एडिट वापस लें" : "Undo re-edit"}
                    >
                      {undoReEditMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCw className="h-3 w-3 -scale-x-100" />
                      )}
                      {isHi ? "वापस लें" : "Undo"}
                    </Button>
                  ) : null}
                  {onReEditClick ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReEditClick(img)}
                      className="h-8 text-xs gap-1 text-primary hover:text-primary/90 hover:bg-primary/10"
                    >
                      <RotateCw className="h-3 w-3" /> {isHi ? "री-एडिट" : "Re-edit"}
                    </Button>
                  ) : listingId ? (
                    <Link href={`/app/re-edit/${listingId}/${img._id}`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-primary hover:text-primary/90 hover:bg-primary/10">
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
                className="h-7 text-xs gap-1 font-semibold text-primary hover:text-primary/90 hover:bg-primary/10"
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
                className="h-7 text-xs gap-1 font-semibold text-primary hover:text-primary/90 hover:bg-primary/10"
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
                className="h-7 text-xs gap-1 font-semibold text-primary hover:text-primary/90 hover:bg-primary/10"
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
                className="h-7 text-xs gap-1 font-semibold text-primary hover:text-primary/90 hover:bg-primary/10"
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
                className="h-7 text-xs gap-1 font-semibold text-primary hover:text-primary/90 hover:bg-primary/10"
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
                className="h-8 text-xs font-semibold gap-1 text-primary hover:text-primary/90 hover:bg-primary/10"
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
                className="h-7 text-xs gap-1 font-semibold text-primary hover:text-primary/90 hover:bg-primary/10"
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
                  className="h-7 text-xs gap-1 font-semibold text-primary hover:text-primary/90 hover:bg-primary/10"
                >
                  <Copy className="h-3 w-3" /> {isHi ? "सभी हैशटैग्स कॉपी करें" : "Copy All Hashtags"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {text.instagramHashtags.map((tag: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs text-primary py-1 px-2.5">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </TabsContent>

      {/* 6. CARDS TAB */}
      <TabsContent value="cards" className="space-y-8">
        {/* Active rendered cards preview */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <span className="text-xs text-muted-foreground">{isHi ? "वर्तमान सक्रिय कार्ड टेम्पलेट:" : "Currently Active Template:"} </span>
                <span className="font-bold text-xs text-foreground">
                  {listing.templateId && CARD_TEMPLATES_MAP[listing.templateId as TemplateId]?.name || "Standard Luxury"}
                </span>
                {listing.templateId && CARD_TEMPLATES_MAP[listing.templateId as TemplateId]?.description && (
                  <span className="text-[11px] text-muted-foreground hidden sm:inline ml-1.5">
                    — {CARD_TEMPLATES_MAP[listing.templateId as TemplateId].description}
                  </span>
                )}
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] w-fit border-primary/30 text-primary font-semibold">
              {isHi ? "1080x1080 & 9:16 फ़ॉर्मैट्स" : "1080x1080 & 9:16 Formats"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {listing.whatsappCard?.url && (
              <Card className="overflow-hidden border-border/60">
                <div className="aspect-square bg-muted">
                  <img src={listing.whatsappCard.url} alt="WhatsApp Card" className="w-full h-full object-cover" />
                </div>
                <CardContent className="p-3.5 flex items-center justify-between">
                  <span className="text-xs font-semibold">{isHi ? "व्हाट्सएप कार्ड (1:1)" : "WhatsApp Card (1:1)"}</span>
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
        </div>

        {/* 4 Festive & Studio Collections (35 Cards Total) */}
        {[
          {
            sectionId: "diwali",
            title: isHi ? "🪔 शुभ दीपावली स्पेशल (9 विशेष टेम्पलेट्स)" : "🪔 Shubh Deepavali Special (9 Festival Templates)",
            subtitle: isHi ? "रॉयल झरोखा मेहराब, गेंद फूल माला, 3D गोल्डन पैडेस्टल, प्रज्वलित मिट्टी के दीये एवं 24K गोल्ड रिबन" : "Royal jharokha arch, cascading marigold garlands, 3D golden pedestal, lit clay diyas & gold ribbon",
            badgeText: "SHUBH DIWALI",
            badgeClass: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
            templates: CARD_TEMPLATES_INFO.filter((t) => t.festivalSection === "diwali"),
          },
          {
            sectionId: "navratri",
            title: isHi ? "🌟 नवरात्रि स्पेशल कार्ड्स (8 विशेष टेम्पलेट्स)" : "🌟 Navratri Utsav Cards (8 Festival Templates)",
            subtitle: isHi ? "डांडिया स्टिक्स, दुर्गा शक्ति त्रिशूल, कच्छी मिरर एम्ब्रॉयडरी एवं रास लीला वेक्टर्स" : "Authored Gujarati dandiya sticks, Durga trishul, Kutch mirror & Raas Leela vectors",
            badgeText: "NAVRATRI UTSAV",
            badgeClass: "bg-pink-500/10 text-pink-600 border-pink-500/30",
            templates: CARD_TEMPLATES_INFO.filter((t) => t.festivalSection === "navratri"),
          },
          {
            sectionId: "dussehra",
            title: isHi ? "🏹 दशहरा एवं विजयादशमी स्पेशल (8 विशेष टेम्पलेट्स)" : "🏹 Dussehra & Vijayadashami Special (8 Festival Templates)",
            subtitle: isHi ? "विजय धनुष बाण, विजय अग्नि, शुभ आप्टा पत्तियां एवं राजपूताना शस्त्र पूजा कलाकृति" : "Authored Vijay Dhanush bow, victory agni, golden apta leaves & shastra puja crest",
            badgeText: "VIJAYADASHAMI",
            badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30",
            templates: CARD_TEMPLATES_INFO.filter((t) => t.festivalSection === "dussehra"),
          },
          {
            sectionId: "luxury",
            title: isHi ? "👑 लग्जरी स्टूडियो एवं एडिटोरियल (10 विशेष टेम्पलेट्स)" : "👑 Luxury Studio & Editorial (10 Premium Templates)",
            subtitle: isHi ? "मिनिमलिस्ट आइवरी, 24K गोल्ड फॉयल, एमराल्ड प्रेस्टीज, और सायबर नियॉन ड्रॉप लेआउट्स" : "Minimalist ivory, 24K gold foil, royal emerald, and cyber neon drop layouts",
            badgeText: "STUDIO LUXE",
            badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
            templates: CARD_TEMPLATES_INFO.filter((t) => t.festivalSection === "luxury" || !t.festivalSection),
          },
        ].map((sec) => (
          <div key={sec.sectionId} className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  {sec.title}
                  <Badge variant="outline" className={`text-[10px] font-bold ${sec.badgeClass}`}>
                    {sec.badgeText}
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{sec.subtitle}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {sec.templates.map((tpl) => {
                const isCurrent = listing.templateId === tpl.id;
                const isRendering = renderingTemplateId === tpl.id;

                return (
                  <Card
                    key={tpl.id}
                    className={`overflow-hidden border transition-all duration-200 flex flex-col justify-between ${
                      isCurrent
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                        : "border-border/60 hover:border-border hover:shadow-xs"
                    }`}
                  >
                    {/* Rich Visual Card Preview Box (Accurate Reference Rendering) */}
                    <div
                      className={`aspect-[4/3] p-2.5 bg-gradient-to-b ${tpl.cardGradClass} border-b ${tpl.borderClass} flex flex-col justify-between relative overflow-hidden`}
                    >
                      {/* Top Royal Arch Contour Silhouette */}
                      <div className="absolute top-0 inset-x-0 h-6 border-b border-amber-400/40 bg-black/20 rounded-b-2xl pointer-events-none" />

                      {/* Side Marigold Garland Dots */}
                      <div className="absolute left-1.5 top-6 bottom-8 flex flex-col justify-between pointer-events-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-xs" />
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-xs" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shadow-xs" />
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 shadow-xs" />
                      </div>
                      <div className="absolute right-1.5 top-6 bottom-8 flex flex-col justify-between pointer-events-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-xs" />
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-xs" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shadow-xs" />
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 shadow-xs" />
                      </div>

                      {/* Header Pill & Active Badge */}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${tpl.tagBadgeClass}`}>
                          {tpl.tag}
                        </span>
                        {isCurrent && (
                          <span className="text-[8px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded shadow-xs">
                            {isHi ? "सक्रिय" : "ACTIVE"}
                          </span>
                        )}
                      </div>

                      {/* Center 3D Stepped Golden Pedestal with Title */}
                      <div className="relative z-10 my-auto text-center px-3 space-y-1">
                        <p className={`text-[10px] font-serif font-black tracking-tight ${tpl.titleColorClass} line-clamp-1`}>
                          {tpl.headline || tpl.name}
                        </p>
                        {/* 3D Circular Pedestal Simulation */}
                        <div className="mx-auto w-24 h-4 rounded-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 border border-amber-300 shadow-sm flex items-center justify-center">
                          <span className="text-[7px] font-bold text-stone-900 truncate px-1">
                            {listing.userTitle?.slice(0, 14) || "Product"}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Pricing & Metallic Gold Ribbon Preview */}
                      <div className="relative z-10 space-y-1 pt-1">
                        {/* Strikethrough MRP and Price */}
                        <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold">
                          {listing.price && listing.discountPrice ? (
                            <>
                              <span className="line-through text-muted-foreground/80 opacity-70 text-[8px]">
                                ₹{listing.price}
                              </span>
                              <span className={`font-black text-[11px] ${tpl.priceColorClass}`}>
                                ₹{listing.discountPrice}
                              </span>
                            </>
                          ) : (
                            <span className={`font-black text-[11px] ${tpl.priceColorClass}`}>
                              {listing.price ? `₹${listing.price}` : "₹699"}
                            </span>
                          )}
                        </div>

                        {/* Gold Ribbon Bar */}
                        <div className="w-full h-4 rounded bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-400 flex items-center justify-between px-1.5 text-[7px] font-black text-amber-950 shadow-xs">
                          <span className="truncate max-w-[85px]">🎁 {tpl.tagline?.slice(0, 18) || "Special Offer"}</span>
                          <span>🔗 SHARE</span>
                        </div>
                      </div>
                    </div>

                    <CardContent className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold truncate text-foreground">{tpl.name}</h4>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                          {tpl.description}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant={isCurrent ? "secondary" : "outline"}
                        disabled={isRendering || isCurrent}
                        onClick={() => handleApplyTemplate(tpl.id)}
                        className={`w-full h-7 text-[11px] font-bold gap-1 mt-2 ${
                          isCurrent
                            ? "bg-muted text-muted-foreground"
                            : "border-primary/30 text-primary hover:bg-primary hover:text-white"
                        }`}
                      >
                        {isRendering ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {isHi ? "रेंडर हो रहा है…" : "Rendering…"}
                          </>
                        ) : isCurrent ? (
                          isHi ? "लागू है" : "Currently Applied"
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            {isHi ? "यह कार्ड बनाएं" : "Render Card"}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}
