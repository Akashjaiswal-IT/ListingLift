"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { trpc } from "~/trpc/client";
import { toast } from "sonner";
import { ListingDeliverablesTabs } from "~/components/listing/ListingDeliverablesTabs";
import { useLanguage } from "~/providers/LanguageContext";
import { downloadFile } from "~/lib/download";
import { trackEvent } from "~/lib/analytics";
import { adaptiveStatusInterval } from "~/lib/polling";
import { formatDate } from "~/lib/format-date";
import { ShareButton } from "~/components/common/ShareButton";
import { ErrorState } from "~/components/common/ErrorState";

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
          return adaptiveStatusInterval(query.state.dataUpdateCount);
        }
        return false;
      },
    }
  );
  const downloadBundleMutation = trpc.download.downloadBundle.useMutation();
  const regenerateTextMutation = trpc.listing.regenerateText.useMutation();
  const exportExcelMutation = trpc.listing.exportExcel.useMutation();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const listing = listingQuery.data;

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      toast.info(isHi ? "एक्सेल कैटलॉग शीट तैयार की जा रही है..." : "Generating marketplace Excel sheet...");
      const res = await exportExcelMutation.mutateAsync({ id: listingId });
      trackEvent("listing_downloaded", { listingId, type: "excel_catalog" });
      await downloadFile(res.downloadUrl, res.fileName);
      toast.success(isHi ? "एक्सेल शीट डाउनलोड हो गई!" : "Marketplace Excel downloaded successfully!");
    } catch (err: any) {
      toast.error(err.message || (isHi ? "एक्सेल डाउनलोड करने में विफल" : "Failed to export Excel"));
    } finally {
      setIsExportingExcel(false);
    }
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
      toast.info(isHi ? "लिस्टिंग टेक्स्ट फिर से लिखा जा रहा है..." : "Rewriting your listing text...");
      trackEvent("listing_text_regenerated", { listingId });
      await regenerateTextMutation.mutateAsync({ id: listingId });
      await Promise.allSettled([
        listingQuery.refetch(),
        utils.listing.getById.invalidate({ id: listingId }),
        utils.listing.list.invalidate(),
      ]);
      toast.success(isHi ? "एसईओ कॉपी सफलतापूर्वक अपडेट की गई!" : "SEO copy updated successfully!");
    } catch (err: any) {
      // The limit message is specific; anything else means the AI call failed and the old text was kept.
      if (err?.data?.code === "TOO_MANY_REQUESTS") {
        toast.error(err.message);
      } else {
        toast.error(
          isHi
            ? "अभी कॉपी फिर से नहीं लिखी जा सकी। आपका मौजूदा टेक्स्ट वैसा ही है - एक मिनट बाद फिर कोशिश करें।"
            : "Couldn't rewrite the copy right now. Your current text is unchanged - please try again in a minute."
        );
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  if (listingQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-5xl py-20 text-center">
        <div className="h-10 w-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-muted-foreground text-sm font-medium">
          {isHi ? "कैटलॉग परिणाम लोड हो रहे हैं..." : "Loading listing deliverables..."}
        </p>
      </div>
    );
  }

  if (!listing && listingQuery.isError && listingQuery.error?.data?.code !== "NOT_FOUND") {
    return (
      <div className="container mx-auto max-w-md px-4 py-20">
        <ErrorState onRetry={() => listingQuery.refetch()} />
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
  const maxRegenerations = listing.type === "listing_product" ? 2 : 5;
  const regenerationsUsed = (listing as any).seoRegenerateCount ?? 0;
  const regenerationsRemaining = Math.max(0, maxRegenerations - regenerationsUsed);
  const isRegenLimitReached = regenerationsRemaining <= 0;

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
            <Badge variant="secondary" className="capitalize text-xs">
              {listing.type === "listing_product"
                ? isHi ? "क्विक स्टूडियो" : "Quick Product"
                : isHi ? "फुल लिस्टिंग किट" : "Listing Kit"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {isHi ? "बनाया गया" : "Created"} {formatDate(listing.createdAt, isHi)}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight mt-1 text-foreground">
            {listing.userTitle || (isHi ? "कैटलॉग परिणाम" : "Listing Deliverables")}
          </h1>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center [&>button]:h-auto [&>button]:min-h-10 [&>button]:whitespace-normal sm:[&>button]:whitespace-nowrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerateText}
            disabled={isRegenerating || isRegenLimitReached}
            title={
              isRegenLimitReached
                ? isHi
                  ? `एसईओ सीमा समाप्त (${maxRegenerations}/${maxRegenerations} इस्तेमाल किए गए)`
                  : `Limit reached (${maxRegenerations}/${maxRegenerations} regenerations used for this listing)`
                : undefined
            }
            className={`gap-2 font-semibold text-xs h-9 rounded-xl border-border ${
              isRegenLimitReached ? "opacity-60 cursor-not-allowed text-muted-foreground" : ""
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${isRegenerating ? "animate-spin text-primary" : ""}`} />
            {isRegenerating
              ? isHi
                ? "AI द्वारा फिर से लिखा जा रहा है..."
                : "Rewriting with AI..."
              : isRegenLimitReached
                ? isHi
                  ? `एसईओ सीमा समाप्त (${regenerationsUsed}/${maxRegenerations})`
                  : `SEO Limit Reached (${regenerationsUsed}/${maxRegenerations})`
                : isHi
                  ? `एसईओ कॉपी दोबारा लिखें (${regenerationsRemaining}/${maxRegenerations})`
                  : `Regenerate SEO Copy (${regenerationsRemaining}/${maxRegenerations})`}
          </Button>

          {/* Share the studio photos + WhatsApp caption through the phone's share sheet */}
          <ShareButton
            imageUrls={(listing.generatedImages || [])
              .filter((img: any) => img.isLatest !== false && img.url)
              .map((img: any) => img.url)}
            caption={text?.whatsappCaption}
            fileBaseName={listing.userTitle}
            isHi={isHi}
            onShared={() => trackEvent("listing_copied", { label: "share_header", listingId })}
            className="order-first sm:order-none rounded-xl text-xs bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90 shadow-xs"
            label={isHi ? "व्हाट्सएप पर शेयर करें" : "Share to WhatsApp"}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="gap-1.5 font-bold text-xs h-9 rounded-xl text-success border-success/30 hover:bg-success/10 shadow-xs"
          >
            <FileSpreadsheet className={`h-4 w-4 ${isExportingExcel ? "animate-spin text-success" : "text-success"}`} />
            {isExportingExcel
              ? isHi ? "एक्सेल तैयार हो रहा है..." : "Exporting..."
              : isHi ? "मीशो एक्सेल (.xlsx)" : "Export Excel (.xlsx)"}
          </Button>

          <Button
            onClick={handleDownloadBundle}
            className="order-[-1] sm:order-none font-bold gap-2 shadow-md rounded-xl text-xs h-9"
          >
            <Download className="h-4 w-4" /> {isHi ? "पूरा ZIP डाउनलोड करें" : "Download Complete ZIP"}
          </Button>
        </div>
      </div>

      {/* Live Re-edit Progress Banner */}
      {(listing as any).reEditStatus?.status === "processing" && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/40 bg-primary/10 text-primary text-sm animate-pulse">
          <RefreshCw className="h-5 w-5 animate-spin shrink-0 text-primary" />
          <div className="flex-1">
            <span className="font-semibold block text-foreground">
              {isHi ? "AI फ़ोटो री-एडिट प्रक्रिया जारी है..." : "AI Photo Re-edit in Progress..."}
            </span>
            <span className="text-xs text-muted-foreground">
              {isHi
                ? "आपका संशोधित स्टूडियो इमेज प्रोसेस हो रहा है। पूरा होते ही यह पेज अपने आप अपडेट हो जाएगा।"
                : "Your edited studio photo is being created. This page updates automatically when it is ready."}
            </span>
          </div>
        </div>
      )}

      {/* Re-edit Failed Banner */}
      {(listing as any).reEditStatus?.status === "failed" && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold block text-foreground">
              {isHi ? "फ़ोटो री-एडिट विफल रहा" : "Photo Re-edit Failed"}
            </span>
            <span className="text-xs text-muted-foreground">
              {isHi
                ? "री-एडिट पूरा नहीं हो सका। आपका 1 क्रेडिट वापस कर दिया गया है।"
                : "Re-edit generation could not be completed. Your 1 credit has been refunded."}
            </span>
          </div>
        </div>
      )}

      {/* 6 Constant Standard Deliverables Tabs */}
      <ListingDeliverablesTabs listing={listing} />
    </div>
  );
}
