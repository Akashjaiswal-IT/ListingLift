"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  Download,
  Copy,
  RotateCw,
  ShoppingBag,
  MessageCircle,
  Instagram,
  CheckCircle2,
  RefreshCw,
  Search,
  Tag,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { trpc } from "~/trpc/client";
import { toast } from "sonner";
import { ListingDeliverablesTabs } from "~/components/listing/ListingDeliverablesTabs";
import { useLanguage } from "~/providers/LanguageContext";
import { downloadFile } from "~/lib/download";
import { trackEvent } from "~/lib/analytics";

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const listingId = resolvedParams.id;
  const { language } = useLanguage();
  const isHi = language === "hi";

  const utils = trpc.useUtils();
  const listingQuery = trpc.listing.getById.useQuery(
    { id: listingId },
    {
      refetchInterval: (query) => {
        const data = query.state.data as any;
        if (
          data?.reEditStatus?.status === "processing" ||
          data?.status === "queued" ||
          data?.status === "processing"
        ) {
          return 2500;
        }
        return false;
      },
    }
  );
  const downloadBundleMutation = trpc.download.downloadBundle.useMutation();
  const regenerateTextMutation = trpc.listing.regenerateText.useMutation();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const listing = listingQuery.data;

  const copyText = (txt?: string, label?: string) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    trackEvent("listing_copied", { label: label || "text", listingId });
    toast.success(`Copied ${label || "text"} to clipboard!`);
  };

  const handleDownloadBundle = async () => {
    try {
      toast.info(isHi ? "ZIP पैकेज तैयार किया जा रहा है..." : "Preparing ZIP package...");
      const res = await downloadBundleMutation.mutateAsync({
        listingObjectId: listingId,
      });
      trackEvent("listing_downloaded", { listingId, type: "zip_bundle" });
      await downloadFile(res.downloadUrl, `listing-${listingId}-bundle.zip`);
      toast.success(isHi ? "डाउनलोड पूरा हुआ!" : "Download complete!");
    } catch (err: any) {
      toast.error(err.message || (isHi ? "बंडल डाउनलोड करने में विफल" : "Failed to download bundle"));
    }
  };

  const handleRegenerateText = async () => {
    setIsRegenerating(true);
    try {
      toast.info(isHi ? "AI के साथ कॉपी फिर से लिखी जा रही है..." : "Regenerating SEO copy with OpenAI...");
      trackEvent("listing_text_regenerated", { listingId });
      await regenerateTextMutation.mutateAsync({ id: listingId });
      await Promise.allSettled([
        listingQuery.refetch(),
        utils.listing.getById.invalidate({ id: listingId }),
        utils.listing.list.invalidate(),
      ]);
      toast.success(isHi ? "एसईओ कॉपी सफलतापूर्वक अपडेट की गई!" : "SEO copy updated successfully!");
    } catch (err: any) {
      toast.error(err.message || (isHi ? "कॉपी फिर से लिखने में विफल" : "Failed to regenerate copy"));
    } finally {
      setIsRegenerating(false);
    }
  };

  if (listingQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-5xl py-20 text-center">
        <div className="h-10 w-10 mx-auto rounded-full border-2 border-[#E05822] border-t-transparent animate-spin mb-4" />
        <p className="text-muted-foreground text-sm font-medium">
          {isHi ? "कैटलॉग परिणाम लोड हो रहे हैं..." : "Loading listing deliverables..."}
        </p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container mx-auto max-w-md py-20 text-center space-y-4">
        <h2 className="text-xl font-bold font-serif">{isHi ? "कैटलॉग नहीं मिला" : "Listing not found"}</h2>
        <Link href="/app/history">
          <Button variant="outline">{isHi ? "इतिहास पर वापस जाएं" : "Back to History"}</Button>
        </Link>
      </div>
    );
  }

  const text = listing.aiGeneratedText;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-8">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <Link href="/app/history">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-3 text-muted-foreground mb-2">
              <ArrowLeft className="h-4 w-4" /> {isHi ? "इतिहास पर वापस जाएं" : "Back to History"}
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize text-[10px]">
              {listing.type === "listing_product"
                ? isHi ? "क्विक स्टूडियो" : "Quick Product"
                : isHi ? "फुल लिस्टिंग किट" : "Listing Kit"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {isHi ? "बनाया गया" : "Created"} {new Date(listing.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight mt-1 text-foreground">
            {listing.userTitle || (isHi ? "कैटलॉग परिणाम" : "Listing Deliverables")}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerateText}
            disabled={isRegenerating}
            className="gap-2 font-semibold text-xs h-9 rounded-xl border-border"
          >
            <RefreshCw className={`h-4 w-4 ${isRegenerating ? "animate-spin text-[#E05822]" : ""}`} />
            {isRegenerating
              ? isHi ? "AI द्वारा फिर से लिखा जा रहा है..." : "Rewriting with AI..."
              : isHi ? "एसईओ कॉपी दोबारा लिखें" : "Regenerate SEO Copy"}
          </Button>

          <Button
            onClick={handleDownloadBundle}
            className="font-bold bg-[#E05822] hover:bg-[#c94917] text-white gap-2 shadow-md rounded-xl text-xs h-9"
          >
            <Download className="h-4 w-4" /> {isHi ? "पूरा ZIP डाउनलोड करें" : "Download Complete ZIP"}
          </Button>
        </div>
      </div>

      {/* Live Re-edit Progress Banner */}
      {(listing as any).reEditStatus?.status === "processing" && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-[#E05822]/40 bg-[#E05822]/10 text-[#E05822] text-sm animate-pulse">
          <RefreshCw className="h-5 w-5 animate-spin shrink-0 text-[#E05822]" />
          <div className="flex-1">
            <span className="font-semibold block text-foreground">
              {isHi ? "AI फ़ोटो री-एडिट प्रक्रिया जारी है..." : "AI Photo Re-edit in Progress..."}
            </span>
            <span className="text-xs text-muted-foreground">
              {isHi
                ? "आपका संशोधित स्टूडियो इमेज प्रोसेस हो रहा है। पूरा होते ही यह पेज अपने आप अपडेट हो जाएगा।"
                : "A refined studio image is currently generating on the worker. This page will update automatically once it is finished."}
            </span>
          </div>
        </div>
      )}

      {/* 6 Constant Standard Deliverables Tabs */}
      <ListingDeliverablesTabs listing={listing} />
    </div>
  );
}
