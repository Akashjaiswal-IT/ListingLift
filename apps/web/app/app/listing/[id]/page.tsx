"use client";

import { use } from "react";
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
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { trpc } from "~/trpc/client";
import { toast } from "sonner";

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const listingId = resolvedParams.id;

  const listingQuery = trpc.listing.getById.useQuery({ id: listingId });
  const downloadBundleMutation = trpc.download.downloadBundle.useMutation();

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

        <Button
          onClick={handleDownloadBundle}
          className="font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md"
        >
          <Download className="h-4 w-4" /> Download Complete ZIP
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="photos" className="space-y-6">
        <TabsList className="grid grid-cols-4 max-w-xl">
          <TabsTrigger value="photos" className="gap-1.5 text-xs font-bold">
            <Sparkles className="h-3.5 w-3.5" /> Studio Photos
          </TabsTrigger>
          <TabsTrigger value="meesho" className="gap-1.5 text-xs font-bold">
            <ShoppingBag className="h-3.5 w-3.5" /> Meesho Copy
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5 text-xs font-bold">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="cards" className="gap-1.5 text-xs font-bold">
            <Instagram className="h-3.5 w-3.5" /> Social Cards
          </TabsTrigger>
        </TabsList>

        {/* Photos Tab */}
        <TabsContent value="photos" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {(listing.generatedImages || []).filter((img: any) => img.isLatest !== false).map((img: any, idx: number) => (
              <Card key={img._id || idx} className="overflow-hidden border-border/60 flex flex-col justify-between">
                <div className="relative aspect-square bg-muted">
                  <img src={img.url} alt={`Studio variation ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {img.variationType?.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-3.5 flex items-center justify-between border-t border-border/40">
                  <span className="text-xs text-muted-foreground font-medium">Variation #{idx + 1}</span>
                  <div className="flex items-center gap-1.5">
                    <Link href={`/app/re-edit/${listingId}/${img._id}`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10">
                        <RotateCw className="h-3 w-3" /> Re-edit
                      </Button>
                    </Link>
                    <a href={img.url} download target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                        <Download className="h-3 w-3" /> Save
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Meesho Tab */}
        <TabsContent value="meesho" className="space-y-6 max-w-3xl">
          <Card className="border-border/60 p-6 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Meesho Optimized Title
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyText(text?.meeshoListing?.title || text?.seoTitle, "Title")}
                  className="h-7 text-xs gap-1 font-semibold"
                >
                  <Copy className="h-3 w-3" /> Copy Title
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 font-medium text-sm border border-border/40">
                {text?.meeshoListing?.title || text?.seoTitle || "N/A"}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Meesho Description & Attributes
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyText(text?.meeshoListing?.description, "Description")}
                  className="h-7 text-xs gap-1 font-semibold"
                >
                  <Copy className="h-3 w-3" /> Copy Description
                </Button>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-xs text-muted-foreground whitespace-pre-wrap font-mono border border-border/40">
                {text?.meeshoListing?.description || "N/A"}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-6 max-w-2xl">
          <Card className="border-border/60 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                WhatsApp Broadcast Copy
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs font-semibold text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={() => {
                  copyText(text?.whatsappCaption, "WhatsApp Caption");
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text?.whatsappCaption || "")}`, "_blank");
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" /> Share to WhatsApp
              </Button>
            </div>
            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs font-medium whitespace-pre-wrap leading-relaxed">
              {text?.whatsappCaption || "N/A"}
            </div>
          </Card>
        </TabsContent>

        {/* Cards Tab */}
        <TabsContent value="cards" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {listing.whatsappCard?.url && (
              <Card className="overflow-hidden border-border/60">
                <div className="aspect-square bg-muted">
                  <img src={listing.whatsappCard.url} alt="WhatsApp Card" className="w-full h-full object-cover" />
                </div>
                <CardContent className="p-3.5 flex items-center justify-between">
                  <span className="text-xs font-semibold">WhatsApp Card</span>
                  <a href={listing.whatsappCard.url} download target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                      <Download className="h-3 w-3" /> Download
                    </Button>
                  </a>
                </CardContent>
              </Card>
            )}

            {listing.instagramPost?.url && (
              <Card className="overflow-hidden border-border/60">
                <div className="aspect-square bg-muted">
                  <img src={listing.instagramPost.url} alt="Instagram Post" className="w-full h-full object-cover" />
                </div>
                <CardContent className="p-3.5 flex items-center justify-between">
                  <span className="text-xs font-semibold">Instagram Post (1:1)</span>
                  <a href={listing.instagramPost.url} download target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                      <Download className="h-3 w-3" /> Download
                    </Button>
                  </a>
                </CardContent>
              </Card>
            )}

            {listing.instagramStory?.url && (
              <Card className="overflow-hidden border-border/60">
                <div className="aspect-[9/16] bg-muted max-h-[400px]">
                  <img src={listing.instagramStory.url} alt="Instagram Story" className="w-full h-full object-cover" />
                </div>
                <CardContent className="p-3.5 flex items-center justify-between">
                  <span className="text-xs font-semibold">Instagram Story (9:16)</span>
                  <a href={listing.instagramStory.url} download target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                      <Download className="h-3 w-3" /> Download
                    </Button>
                  </a>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
