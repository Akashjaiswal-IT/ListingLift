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

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const listingId = resolvedParams.id;

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
    toast.success(`Copied ${label || "text"} to clipboard!`);
  };

  const handleDownloadBundle = async () => {
    try {
      toast.info("Preparing ZIP package...");
      const res = await downloadBundleMutation.mutateAsync({
        listingObjectId: listingId,
      });
      window.open(res.downloadUrl, "_blank");
      toast.success("Download started!");
    } catch (err: any) {
      toast.error(err.message || "Failed to download bundle");
    }
  };

  const handleRegenerateText = async () => {
    setIsRegenerating(true);
    try {
      toast.info("Regenerating SEO copy with OpenAI...");
      await regenerateTextMutation.mutateAsync({ id: listingId });
      await Promise.allSettled([
        listingQuery.refetch(),
        utils.listing.getById.invalidate({ id: listingId }),
        utils.listing.list.invalidate(),
      ]);
      toast.success("SEO copy updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate copy");
    } finally {
      setIsRegenerating(false);
    }
  };

  if (listingQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-5xl py-20 text-center">
        <div className="h-10 w-10 mx-auto rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Loading listing deliverables...</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container mx-auto max-w-md py-20 text-center space-y-4">
        <h2 className="text-xl font-bold">Listing not found</h2>
        <Link href="/app/history">
          <Button variant="outline">Back to History</Button>
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
              <ArrowLeft className="h-4 w-4" /> Back to History
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize text-[10px]">
              {listing.type === "listing_product" ? "Quick Product" : "Listing Kit"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Created {new Date(listing.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
            {listing.userTitle || "Listing Deliverables"}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerateText}
            disabled={isRegenerating}
            className="gap-2 font-medium"
          >
            <RefreshCw className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} />
            {isRegenerating ? "Rewriting with AI..." : "Regenerate SEO Copy"}
          </Button>

          <Button
            onClick={handleDownloadBundle}
            className="font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md"
          >
            <Download className="h-4 w-4" /> Download Complete ZIP
          </Button>
        </div>
      </div>

      {/* Live Re-edit Progress Banner */}
      {(listing as any).reEditStatus?.status === "processing" && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-indigo-500/40 bg-indigo-500/10 text-indigo-400 text-sm animate-pulse">
          <RefreshCw className="h-5 w-5 animate-spin shrink-0 text-indigo-500" />
          <div className="flex-1">
            <span className="font-semibold block text-foreground">AI Photo Re-edit in Progress...</span>
            <span className="text-xs text-muted-foreground">
              A refined studio image is currently generating on the worker. This page will update automatically once it is finished.
            </span>
          </div>
        </div>
      )}

      {/* 6 Constant Standard Deliverables Tabs */}
      <ListingDeliverablesTabs listing={listing} />
    </div>
  );
}
