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
  ShieldCheck,
  ShieldAlert,
  Shield,
  ChevronDown,
  Columns2,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  CARD_TEMPLATES_INFO,
  CARD_TEMPLATES_MAP,
  CARD_TEMPLATE_GROUPS,
  TemplateId,
  resolveTemplateId,
} from "~/lib/card-templates";
import { useLanguage } from "~/providers/LanguageContext";
import { downloadFile } from "~/lib/download";
import { copyToClipboard } from "~/lib/clipboard";
import { variationLabel } from "~/lib/variation-labels";
import { CopyButton } from "~/components/common/CopyButton";
import { ShareButton } from "~/components/common/ShareButton";
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

  // Retired template IDs resolve to the design they now render as.
  const currentTemplate = CARD_TEMPLATES_MAP[resolveTemplateId(listing.templateId)];

  const handleApplyTemplate = (templateId: TemplateId) => {
    setRenderingTemplateId(templateId);
    toast.info(isHi ? "कार्ड्स रेंडर हो रहे हैं…" : "Rendering cards…");
    regenerateCardsMutation.mutate({
      listingObjectId: listingId,
      templateId,
    });
  };

  const handleDownload = useCallback((url: string, filename: string) => {
    trackEvent("listing_downloaded", { filename, listingId });
    downloadFile(url, filename)
      .then(() => {
        toast.success(isHi ? "डाउनलोड पूरा!" : "Download complete!");
      })
      .catch((err) => {
        toast.error(isHi ? "डाउनलोड विफल रहा" : "Download failed");
      });
  }, [isHi, listingId]);

  const copyText = async (txt?: string, label?: string) => {
    if (!txt) return;
    const ok = await copyToClipboard(txt);
    if (!ok) {
      toast.error(isHi ? "कॉपी नहीं हो सका — टेक्स्ट को दबाकर चुनें" : "Couldn't copy — press and hold the text to select it");
      return;
    }
    trackEvent("listing_copied", { label: label || "text", listingId });
    toast.success(isHi ? `${label || "टेक्स्ट"} कॉपी हो गया!` : `Copied ${label || "text"}!`);
  };

  // Latest studio images, in order: what a seller shares to WhatsApp / Instagram.
  const studioImageUrls: string[] = (listing.generatedImages || [])
    .filter((img: any) => img.isLatest !== false && img.url)
    .map((img: any) => img.url);

  return (
    <Tabs defaultValue={defaultTab} className="space-y-6">
      {/* One scrollable row on phones instead of three rows of tabs */}
      <TabsList className="flex w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-6 md:max-w-3xl">
        <TabsTrigger value="photos" className="shrink-0 px-3 gap-1.5 text-xs font-bold">
          <Sparkles className="h-3.5 w-3.5" /> {isHi ? "फ़ोटो" : "Photos"}
        </TabsTrigger>
        <TabsTrigger value="catalog" className="shrink-0 px-3 gap-1.5 text-xs font-bold">
          <ShoppingBag className="h-3.5 w-3.5" /> {isHi ? "कैटलॉग" : "Catalog"}
        </TabsTrigger>
        <TabsTrigger value="seo" className="shrink-0 px-3 gap-1.5 text-xs font-bold">
          <Search className="h-3.5 w-3.5" /> {isHi ? "एसईओ बुलेट्स" : "SEO & Bullets"}
        </TabsTrigger>
        <TabsTrigger value="whatsapp" className="shrink-0 px-3 gap-1.5 text-xs font-bold">
          <MessageCircle className="h-3.5 w-3.5" /> {isHi ? "व्हाट्सएप" : "WhatsApp"}
        </TabsTrigger>
        <TabsTrigger value="instagram" className="shrink-0 px-3 gap-1.5 text-xs font-bold">
          <Instagram className="h-3.5 w-3.5" /> {isHi ? "इंस्टाग्राम" : "Instagram"}
        </TabsTrigger>
        <TabsTrigger value="cards" className="shrink-0 px-3 gap-1.5 text-xs font-bold">
          <Tag className="h-3.5 w-3.5" /> {isHi ? "कार्ड्स" : "Cards"}
        </TabsTrigger>
      </TabsList>

      {/* 1. PHOTOS TAB */}
      <TabsContent value="photos" className="space-y-6">
        {studioImageUrls.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-whatsapp/30 bg-whatsapp/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">
              {isHi
                ? "स्टूडियो फ़ोटो सीधे व्हाट्सएप, इंस्टाग्राम या मीशो ऐप में भेजें।"
                : "Send the studio photos straight to WhatsApp, Instagram or the Meesho app."}
            </p>
            <ShareButton
              imageUrls={studioImageUrls}
              caption={text?.whatsappCaption}
              fileBaseName={listing.userTitle}
              isHi={isHi}
              size="default"
              onShared={() => trackEvent("listing_copied", { label: "share_photos", listingId })}
              className="h-11 shrink-0 bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90"
              label={isHi ? "फ़ोटो शेयर करें" : "Share photos"}
            />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {/* Original Uploaded Images */}
          {listing.originalImages?.map((orig: any, idx: number) => (
            <Card key={`orig-${idx}`} className="overflow-hidden border-border/60 bg-muted/10 flex flex-col justify-between">
              <div className="relative aspect-square bg-muted">
                <img src={orig.url} alt={`Original Photo ${idx + 1}`} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2">
                  <Badge variant="outline" className="bg-background/80 text-xs backdrop-blur-sm font-semibold">
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
                  <Badge variant="secondary" className="capitalize text-xs">
                    {variationLabel(img.variationType, isHi)}
                  </Badge>
                </div>
              </div>

              <FidelityStatus
                image={img}
                originalImages={listing.originalImages || []}
                isHi={isHi}
              />

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
                {isHi ? "एसईओ सर्च-ऑप्टिमाइज़्ड टाइटल (~60 अक्षर)" : "SEO Search-Optimized Title (~60 chars)"}
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
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isHi ? "व्हाट्सएप ब्रॉडकास्ट कॉपी" : "WhatsApp Broadcast Copy"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton
                text={text?.whatsappCaption}
                label={isHi ? "व्हाट्सएप कैप्शन" : "WhatsApp caption"}
                isHi={isHi}
                onCopied={() => trackEvent("listing_copied", { label: "WhatsApp Caption", listingId })}
                className="text-primary hover:text-primary/90 hover:bg-primary/10"
              >
                {isHi ? "टेक्स्ट कॉपी करें" : "Copy text"}
              </CopyButton>
              <ShareButton
                imageUrls={studioImageUrls}
                caption={text?.whatsappCaption}
                fileBaseName={listing.userTitle}
                isHi={isHi}
                onShared={() => trackEvent("listing_copied", { label: "share_whatsapp", listingId })}
                className="h-9 text-xs bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90"
                label={isHi ? "फ़ोटो + टेक्स्ट शेयर करें" : "Share photos + text"}
              />
            </div>
          </div>
          <div className="p-4 rounded-lg bg-success/5 border border-success/20 text-sm font-medium whitespace-pre-wrap leading-relaxed select-text">
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
                  {currentTemplate ? (isHi ? currentTemplate.name.hi : currentTemplate.name.en) : ""}
                </span>
              </div>
            </div>
            <Badge variant="outline" className="text-xs w-fit border-primary/30 text-primary font-semibold">
              {isHi ? "1:1 · 4:5 · 9:16 फ़ॉर्मैट्स" : "1:1 · 4:5 · 9:16 Formats"}
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
                {/* New posts are 4:5; older listings have 1:1 posts, so contain instead of crop. */}
                <div className="aspect-[4/5] bg-muted">
                  <img src={listing.instagramPost.url} alt="Instagram Post" className="w-full h-full object-contain" />
                </div>
                <CardContent className="p-3.5 flex items-center justify-between">
                  <span className="text-xs font-semibold">{isHi ? "इंस्टाग्राम पोस्ट (4:5)" : "Instagram Post (4:5)"}</span>
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

        {/* Card designs, grouped like the picker on the generate page */}
        {CARD_TEMPLATE_GROUPS.map((group) => (
          <div key={group.id} className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-foreground border-b border-border/60 pb-2">
              {isHi ? group.label.hi : group.label.en}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {CARD_TEMPLATES_INFO.filter((t) => t.group === group.id).map((tpl) => {
                const isCurrent = currentTemplate?.id === tpl.id;
                // A retired ID highlights its new equivalent but can still be re-rendered in the new design.
                const isExactCurrent = listing.templateId === tpl.id;
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
                    <div className="relative">
                      <img
                        src={tpl.previewSrc}
                        alt=""
                        width={480}
                        height={480}
                        loading="lazy"
                        className="w-full aspect-square object-cover bg-muted"
                      />
                      {isCurrent && (
                        <span className="absolute top-1.5 left-1.5 text-xs font-black bg-success text-success-foreground px-1.5 py-0.5 rounded shadow-xs">
                          {isHi ? "सक्रिय" : "ACTIVE"}
                        </span>
                      )}
                    </div>

                    <CardContent className="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
                      <h4 className="text-xs font-bold text-foreground line-clamp-2">
                        {isHi ? tpl.name.hi : tpl.name.en}
                      </h4>

                      <Button
                        size="sm"
                        variant={isExactCurrent ? "secondary" : "outline"}
                        disabled={isRendering || isExactCurrent || regenerateCardsMutation.isPending}
                        onClick={() => handleApplyTemplate(tpl.id)}
                        className={`w-full h-7 text-xs font-bold gap-1 ${
                          isExactCurrent
                            ? "bg-muted text-muted-foreground"
                            : "border-primary/30 text-primary hover:bg-primary hover:text-white"
                        }`}
                      >
                        {isRendering ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {isHi ? "रेंडर हो रहा है…" : "Rendering…"}
                          </>
                        ) : isExactCurrent ? (
                          isHi ? "लागू है" : "Currently Applied"
                        ) : isCurrent ? (
                          <>
                            <RotateCw className="h-3 w-3" />
                            {isHi ? "नए डिज़ाइन में बनाएं" : "Update to new design"}
                          </>
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

type FidelityStatusValue = "verified" | "issues" | "not_verified";

// Must match SMALL_PRINT_NOTE in packages/services/ai/product-inventory.ts (services can't be imported in the browser).
const SMALL_PRINT_NOTE_EN =
  "Small printed text on the product may differ from your photo. Check it before uploading.";
const SMALL_PRINT_NOTE_HI =
  "उत्पाद पर छपा छोटा टेक्स्ट आपकी फ़ोटो से अलग हो सकता है। अपलोड करने से पहले इसे जांच लें।";

interface FidelityImage {
  url: string;
  fidelityStatus?: FidelityStatusValue;
  fidelityIssues?: string[];
}

// Per-image "product unchanged" check result. Kept as its own component so its
// expand/dialog state doesn't add hooks to the parent (which returns early).
function FidelityStatus({
  image,
  originalImages,
  isHi,
}: {
  image: FidelityImage;
  originalImages: { url: string }[];
  isHi: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const status = image.fidelityStatus;

  if (status !== "verified" && status !== "issues" && status !== "not_verified") return null;

  if (status === "verified") {
    return (
      <div className="px-3.5 pt-3">
        <Badge
          variant="outline"
          className="gap-1 text-xs font-semibold border-success/30 bg-success/10 text-success"
        >
          <ShieldCheck className="h-3 w-3" />
          {isHi ? "उत्पाद सत्यापित" : "Product verified"}
        </Badge>
      </div>
    );
  }

  const isIssues = status === "issues";
  const issues = (image.fidelityIssues || []).filter((s) => typeof s === "string" && s.trim());

  return (
    <div className="px-3.5 pt-3 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Badge
          variant="outline"
          className={`gap-1 text-xs font-semibold cursor-pointer ${
            isIssues
              ? "border-credit/40 bg-credit/10 text-credit"
              : "border-border bg-muted/50 text-muted-foreground"
          }`}
        >
          {isIssues ? <ShieldAlert className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
          {isIssues ? (isHi ? "विवरण जांचें" : "Check details") : isHi ? "सत्यापित नहीं" : "Not verified"}
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </Badge>
      </button>

      {expanded && (
        <div
          className={`rounded-lg border p-2.5 space-y-2 text-xs ${
            isIssues ? "border-credit/30 bg-credit/5" : "border-border/60 bg-muted/30"
          }`}
        >
          {isIssues ? (
            issues.length > 0 && (
              <ul className="list-disc pl-4 space-y-1 text-foreground break-words">
                {issues.map((issue, i) => (
                  <li key={i}>{isHi && issue === SMALL_PRINT_NOTE_EN ? SMALL_PRINT_NOTE_HI : issue}</li>
                ))}
              </ul>
            )
          ) : (
            <p className="text-muted-foreground">
              {isHi
                ? "इस फ़ोटो के लिए स्वचालित उत्पाद जांच नहीं हो सकी। अपलोड करने से पहले इसे अपनी फ़ोटो से मिलाकर देखें।"
                : "We couldn't run the automatic product check for this image. Please compare it with your photo before uploading."}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setCompareOpen(true)}
          >
            <Columns2 className="h-3 w-3" /> {isHi ? "मूल फ़ोटो से तुलना करें" : "Compare with original"}
          </Button>
        </div>
      )}

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isHi ? "मूल फ़ोटो से तुलना करें" : "Compare with original"}</DialogTitle>
            <DialogDescription>
              {isHi
                ? "अगर आपके उत्पाद में कुछ अलग दिखे, तो अपलोड करने से पहले Re-edit से ठीक करें।"
                : "If something on your product looks different, use Re-edit to fix it before uploading."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {isHi ? "आपकी फ़ोटो" : "Your photo"}
              </span>
              <div className={`grid gap-2 ${originalImages.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {originalImages.map((orig, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                    <img
                      src={orig.url}
                      alt={isHi ? `मूल फ़ोटो ${i + 1}` : `Original photo ${i + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {isHi ? "स्टूडियो फ़ोटो" : "Studio photo"}
              </span>
              <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                <img
                  src={image.url}
                  alt={isHi ? "स्टूडियो फ़ोटो" : "Studio photo"}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
