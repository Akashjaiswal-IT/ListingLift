"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowLeft,
  RotateCw,
  Coins,
  CheckCircle2,
  Wand2,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { trpc } from "~/trpc/client";
import { useCreditStore } from "~/stores/useCreditStore";
import { toast } from "sonner";

export default function ReEditPage({
  params,
}: {
  params: Promise<{ listingId: string; imageId: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { listingId, imageId } = resolvedParams;

  const { balance, deductLocal } = useCreditStore();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const utils = trpc.useUtils();
  const listingQuery = trpc.listing.getById.useQuery({ id: listingId });
  const reEditMutation = trpc.generate.reEditImage.useMutation();

  const listing = listingQuery.data;
  const currentImage = listing?.generatedImages?.find(
    (img: any) => String(img._id) === imageId
  );
  const originalImage = listing?.originalImages?.[0];

  const presetPrompts = [
    "Clean minimal white studio with soft ambient shadows",
    "Luxury dark marble countertop with subtle rim lighting",
    "Warm lifestyle sunlight streaming through a window",
    "Festive Indian backdrop with brass accents and marigold flowers",
    "Modern Scandinavian wooden surface with natural daylight",
  ];

  const handleReEdit = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter instructions for the re-edit");
      return;
    }

    if (balance < 1) {
      toast.error("Insufficient credits. Please top up to re-edit.");
      return;
    }

    try {
      setIsSubmitting(true);
      await reEditMutation.mutateAsync({
        listingObjectId: listingId,
        generatedImageId: imageId,
        newPrompt: prompt,
      });

      toast.success("Re-edit started! Processing with AI...");
      deductLocal(1);
      utils.credits.getBalance.invalidate();
      utils.user.getCreditBalance.invalidate();
      setIsPolling(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to start re-edit");
      setIsSubmitting(false);
    }
  };

  // Poll for completion while isPolling is true
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      const res = await listingQuery.refetch();
      const updatedListing = res.data;
      if (!updatedListing) return;

      const reEdit = (updatedListing as any).reEditStatus;
      const targetMatches = !reEdit?.targetImageId || reEdit.targetImageId === imageId;

      // Check if image was replaced in generatedImages
      const replaced = updatedListing.generatedImages?.some(
        (img: any) => String(img._id) === imageId && !img.isLatest
      );

      // 1. Success condition: reEdit marked completed for this image OR old image marked replaced
      if ((reEdit?.status === "completed" && targetMatches) || replaced) {
        clearInterval(interval);
        setIsPolling(false);
        setIsSubmitting(false);
        await Promise.allSettled([
          utils.credits.getBalance.invalidate(),
          utils.user.getCreditBalance.invalidate(),
          utils.listing.getById.invalidate({ id: listingId }),
          utils.listing.list.invalidate(),
        ]);
        toast.success("Image re-edited successfully! Loading updated deliverables...");
        router.push(`/app/listing/${listingId}`);
        return;
      }

      // 2. Failure condition: reEdit marked failed
      if (reEdit?.status === "failed" && targetMatches) {
        clearInterval(interval);
        setIsPolling(false);
        setIsSubmitting(false);
        await Promise.allSettled([
          utils.credits.getBalance.invalidate(),
          utils.user.getCreditBalance.invalidate(),
          utils.user.getCreditHistory.invalidate(),
          utils.listing.getById.invalidate({ id: listingId }),
        ]);
        toast.error(
          reEdit.errorMessage || "Re-edit generation failed. Your 1 credit has been refunded."
        );
        return;
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isPolling, listingId, imageId, listingQuery, router, utils]);

  if (listingQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-20 text-center">
        <div className="h-10 w-10 mx-auto rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Loading studio image for re-edit...</p>
      </div>
    );
  }

  if (!listing || !currentImage) {
    return (
      <div className="container mx-auto max-w-md py-20 text-center space-y-4">
        <h2 className="text-xl font-bold">Image not found</h2>
        <Link href={`/app/listing/${listingId}`}>
          <Button variant="outline">Back to Listing</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <Link href={`/app/listing/${listingId}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-3 text-muted-foreground mb-2">
              <ArrowLeft className="h-4 w-4" /> Back to Listing Deliverables
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize text-[10px]">
              AI Photo Re-Edit
            </Badge>
            <span className="text-xs text-muted-foreground">Session: {currentImage.interactionId}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
            Refine & Re-generate Studio Shot
          </h1>
        </div>

        {/* Credit cost badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
            <Coins className="h-4 w-4 text-amber-500" />
            <span>Cost: 1 Credit</span>
            <span className="text-xs opacity-60 font-normal">({balance} available)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Comparison & Control */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Visual Comparison */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Original Input Photo */}
            <Card className="border-border/40 overflow-hidden bg-background/50">
              <CardHeader className="py-3 px-4 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" /> Original Photo
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="aspect-square rounded-lg overflow-hidden bg-muted/40 relative">
                  {originalImage?.url ? (
                    <img
                      src={originalImage.url}
                      alt="Original product"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                      No original preview
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Current Generated Photo */}
            <Card className="border-indigo-500/40 overflow-hidden bg-background/50 shadow-md">
              <CardHeader className="py-3 px-4 border-b border-indigo-500/20 bg-indigo-500/5">
                <CardTitle className="text-xs font-semibold flex items-center justify-between text-indigo-400">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Current Studio Shot
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {currentImage.variationType}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="aspect-square rounded-lg overflow-hidden bg-muted/40 relative">
                  <img
                    src={currentImage.url}
                    alt="Current studio photo"
                    className="w-full h-full object-cover"
                  />
                  {isPolling && (
                    <div className="absolute inset-0 bg-background/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 animate-in fade-in duration-300">
                      <div className="relative mb-4">
                        <div className="h-14 w-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                        <Sparkles className="h-6 w-6 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
                      </div>
                      <p className="text-sm font-bold text-foreground">AI Re-edit in Progress...</p>
                      <p className="text-xs text-muted-foreground mt-1.5 max-w-[240px] leading-relaxed">
                        Gemini & Prompt Enhancer are synthesizing your changes.
                      </p>
                      <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-400 font-medium">
                        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                        Waiting for worker completion...
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Previous Prompt Used */}
          <div className="p-4 rounded-xl border border-border/40 bg-muted/10 text-xs space-y-1">
            <span className="font-semibold text-muted-foreground">Prompt used for this shot:</span>
            <p className="text-foreground/80 font-mono text-[11px] leading-relaxed">
              {currentImage.promptUsed || "Standard studio illumination with realistic shadows"}
            </p>
          </div>
        </div>

        {/* Right Side: Re-edit Instructions & Submission */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border/40 bg-background/60 shadow-lg">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-indigo-400" />
                Describe Your Changes
              </CardTitle>
              <CardDescription className="text-xs">
                Tell the AI what to modify. The core product identity will be strictly preserved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="e.g. Change the background to a soft pastel pink marble surface, make lighting warmer and add subtle floral shadows on the right..."
                className="h-28 text-sm resize-none"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isSubmitting || isPolling}
              />

              {/* Quick Preset Ideas */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Inspiration Presets
                </label>
                <div className="flex flex-col gap-1.5">
                  {presetPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt(p)}
                      disabled={isSubmitting || isPolling}
                      className="text-left text-xs px-2.5 py-1.5 rounded-lg border border-border/40 hover:bg-muted/50 hover:border-indigo-500/40 text-muted-foreground hover:text-foreground transition-all truncate"
                    >
                      + {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Re-editing uses <strong>1 credit</strong>. The regenerated image will replace this shot in your active catalog while keeping full historical records.
                </span>
              </div>

              {/* Action Button */}
              <Button
                onClick={handleReEdit}
                disabled={isSubmitting || isPolling || !prompt.trim() || balance < 1}
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 font-bold shadow-md gap-2"
              >
                {isSubmitting || isPolling ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    Generating Refinement...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Re-generate Shot (1 Credit)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
