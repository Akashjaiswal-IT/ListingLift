"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Sparkles,
  Camera,
  X,
  Plus,
  Coins,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  RotateCw,
  Share2,
  MessageCircle,
  Instagram,
  ShoppingBag,
  ExternalLink,
  Loader2,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { trpc } from "~/trpc/client";
import { useCreditStore } from "~/stores/useCreditStore";
import { useGenerationStore } from "~/stores/useGenerationStore";
import { TemplateSelector } from "~/components/generate/TemplateSelector";
import { TemplateId } from "~/lib/card-templates";
import { toast } from "sonner";

export default function GeneratePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { balance, deductLocal } = useCreditStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedType, setSelectedType] = useState<"listing_product" | "listing_kit">("listing_product");
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; preview: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [price, setPrice] = useState<string>("");
  const [discountPrice, setDiscountPrice] = useState<string>("");
  const [sizes, setSizes] = useState<string>("S, M, L, XL");
  const [ctaText, setCtaText] = useState("Order Now via WhatsApp");
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>("minimal-luxury");

  // Re-edit modal state
  const [reEditTarget, setReEditTarget] = useState<any>(null);
  const [reEditPrompt, setReEditPrompt] = useState("");
  const [isReEditing, setIsReEditing] = useState(false);

  // Active Listing Document State
  const [activeListingId, setActiveListingId] = useState<string | null>(null);
  const [streamedText, setStreamedText] = useState<any>(null);
  const [listingResult, setListingResult] = useState<any>(null);
  const [imageGenStatus, setImageGenStatus] = useState<string>("pending");

  // tRPC mutations & queries
  const getPresignedUrlMutation = trpc.upload.getPresignedUrl.useMutation();
  const confirmUploadMutation = trpc.upload.confirmUpload.useMutation();
  const startGenerationMutation = trpc.generate.startGeneration.useMutation();
  const getStatusQuery = trpc.generate.getStatus.useQuery(
    { listingObjectId: activeListingId || "" },
    {
      enabled: step === 3 && !!activeListingId,
      refetchInterval: (query) => {
        const s = query.state.data?.status;
        if (s === "completed" || s === "failed") return false;
        return 2500;
      },
    }
  );
  const getResultQuery = trpc.generate.getResult.useQuery(
    { listingObjectId: activeListingId || "" },
    {
      enabled: step === 4 && !!activeListingId,
    }
  );
  const reEditMutation = trpc.generate.reEditImage.useMutation();
  const downloadBundleMutation = trpc.download.downloadBundle.useMutation();

  // Handle image files selection
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    const newItems = files.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));

    if (selectedType === "listing_product") {
      setSelectedFiles([newItems[0]!]);
    } else {
      setSelectedFiles((prev) => [...prev, ...newItems].slice(0, 5));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload to R2 and transition to Step 2
  const handleProceedToDetails = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please upload at least one product photo");
      return;
    }

    setIsUploading(true);
    try {
      const uploadedOriginals = [];
      for (const item of selectedFiles) {
        const presigned = await getPresignedUrlMutation.mutateAsync({
          fileName: item.file.name,
          mimeType: item.file.type || "image/jpeg",
        });

        // Direct PUT to Cloudflare R2
        await fetch(presigned.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": item.file.type || "image/jpeg" },
          body: item.file,
        });

        uploadedOriginals.push({
          s3Key: presigned.s3Key,
          fileName: item.file.name,
          url: presigned.publicUrl,
        });
      }

      // Confirm upload and initialize listingObject in MongoDB
      const res = await confirmUploadMutation.mutateAsync({
        type: selectedType,
        originalImages: uploadedOriginals,
      });

      setActiveListingId(res.listingObjectId);
      setStep(2);
      toast.success("Photos uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photos");
    } finally {
      setIsUploading(false);
    }
  };

  // Step 2 -> Step 3: Trigger generation & SSE streaming
  const handleStartGeneration = async () => {
    if (!activeListingId) return;
    if (!title.trim()) {
      toast.error("Please enter a product title");
      return;
    }

    const creditsNeeded = selectedType === "listing_product" ? 2 : selectedFiles.length <= 3 ? 5 : 6;
    if (balance < creditsNeeded) {
      toast.error(`You need at least ${creditsNeeded} credits. Current balance: ${balance}`);
      router.push("/pricing");
      return;
    }

    try {
      setStep(3);
      deductLocal(creditsNeeded);

      const genRes = await startGenerationMutation.mutateAsync({
        listingObjectId: activeListingId,
        userTitle: title,
        userDescription: description,
        userPrompt: customPrompt,
        templateId: selectedTemplateId,
        price: price ? parseFloat(price) : undefined,
        discountPrice: discountPrice ? parseFloat(discountPrice) : undefined,
        sizes: sizes ? sizes.split(",").map((s) => s.trim()) : undefined,
        ctaText,
      });

      toast.info(`Generation started! Charged ${genRes.creditsCharged} credits.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to start generation");
      setStep(2);
    }
  };

  // Monitor BullMQ worker image & SEO text generation status in Step 3
  useEffect(() => {
    if (step === 3 && getStatusQuery.data) {
      const { status, errorMessage, aiGeneratedText } = getStatusQuery.data;
      setImageGenStatus(status);

      if (aiGeneratedText) {
        setStreamedText(aiGeneratedText);
      }

      if (status === "completed") {
        toast.success("Studio images and SEO deliverables ready!");
        if (aiGeneratedText) {
          setStreamedText(aiGeneratedText);
        }
        setStep(4);
      } else if (status === "failed") {
        toast.error(`Generation failed: ${errorMessage || "Unknown error"}. Credits have been refunded.`);
      }
    }
  }, [step, getStatusQuery.data]);

  // Keep result updated in Step 4
  useEffect(() => {
    if (step === 4 && getResultQuery.data) {
      setListingResult(getResultQuery.data);
      if (getResultQuery.data.aiGeneratedText) {
        setStreamedText(getResultQuery.data.aiGeneratedText);
      }
    }
  }, [step, getResultQuery.data]);

  // Handle Download Bundle ZIP
  const handleDownloadBundle = async () => {
    if (!activeListingId) return;
    try {
      toast.info("Generating high-compression ZIP package...");
      const res = await downloadBundleMutation.mutateAsync({
        listingObjectId: activeListingId,
      });
      window.open(res.downloadUrl, "_blank");
      toast.success("Download started!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create bundle");
    }
  };

  // Handle Re-edit image modal
  const handleExecuteReEdit = async () => {
    if (!reEditTarget || !reEditPrompt.trim() || !activeListingId) return;
    if (balance < 1) {
      toast.error("1 credit required for re-editing. Please buy more credits.");
      router.push("/pricing");
      return;
    }

    setIsReEditing(true);
    try {
      await reEditMutation.mutateAsync({
        listingObjectId: activeListingId,
        generatedImageId: String(reEditTarget._id),
        newPrompt: reEditPrompt,
      });
      deductLocal(1);
      toast.success("Re-edit job enqueued! Your image is updating in background.");
      setReEditTarget(null);
      setReEditPrompt("");
      // Refetch result
      getResultQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to re-edit image");
    } finally {
      setIsReEditing(false);
    }
  };

  // Helper copy to clipboard
  const copyText = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`Copied ${label} to clipboard!`);
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-8">
      {/* Progress Steps Header */}
      <div className="border-b border-border/40 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-indigo-400" />
              AI Studio Listing Generator
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              One upload → 8K Studio Photos, Marketplace Catalog, and WhatsApp & Instagram Story Cards.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {[
              { num: 1, label: "Upload" },
              { num: 2, label: "Details" },
              { num: 3, label: "Generating" },
              { num: 4, label: "Results" },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    step === s.num
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : step > s.num
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.num ? "✓" : s.num}
                </div>
                <span className={step === s.num ? "text-foreground font-bold" : "text-muted-foreground hidden md:inline"}>
                  {s.label}
                </span>
                {s.num < 4 && <div className="h-0.5 w-3 bg-border mx-1 hidden sm:block" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= STEP 1: UPLOAD ================= */}
      {step === 1 && (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Generation Type Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card
              onClick={() => {
                setSelectedType("listing_product");
                if (selectedFiles.length > 1) setSelectedFiles([selectedFiles[0]!]);
              }}
              className={`cursor-pointer transition-all border-border/60 ${
                selectedType === "listing_product"
                  ? "border-indigo-500 bg-indigo-950/20 shadow-md"
                  : "hover:border-border"
              }`}
            >
              <CardContent className="p-5 flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">Quick Generate</h3>
                    <Badge className="bg-indigo-600 text-white text-[10px]">2 Credits</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload 1 photo. Generates 2 studio photo variations, marketplace catalog copy, and social cards.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              onClick={() => setSelectedType("listing_kit")}
              className={`cursor-pointer transition-all border-border/60 ${
                selectedType === "listing_kit"
                  ? "border-indigo-500 bg-indigo-950/20 shadow-md"
                  : "hover:border-border"
              }`}
            >
              <CardContent className="p-5 flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">Full Listing Kit</h3>
                    <Badge variant="secondary" className="text-[10px]">5-7 Credits</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload 3 to 5 photos (angles, close-ups, fabric). Generates complete catalog suite.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative cursor-pointer rounded-2xl border-2 border-dashed border-border/80 hover:border-indigo-500/80 bg-muted/20 hover:bg-indigo-500/5 p-10 text-center transition-all space-y-4"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple={selectedType === "listing_kit"}
              onChange={handleFilesSelected}
              className="hidden"
            />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
              <Upload className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-bold">
                {selectedType === "listing_product" ? "Upload 1 Product Photo" : "Upload 3 to 5 Product Photos"}
              </h4>
              <p className="text-xs text-muted-foreground">
                Drag and drop raw camera photos here, or click to browse (JPG, PNG, WEBP, HEIC up to 10MB)
              </p>
            </div>
          </div>

          {/* Selected Previews */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-muted-foreground">
                Selected Photos ({selectedFiles.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {selectedFiles.map((item, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-xl overflow-hidden border border-border group bg-muted"
                  >
                    <img src={item.preview} alt="Upload preview" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute bottom-1.5 left-1.5">
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        #{index + 1}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end pt-4">
            <Button
              size="lg"
              disabled={selectedFiles.length === 0 || isUploading}
              onClick={handleProceedToDetails}
              className="font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-8"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading to R2...
                </>
              ) : (
                <>
                  Continue to Details <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: DETAILS FORM ================= */}
      {step === 2 && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <div>
                <span className="text-sm font-bold block">
                  {selectedType === "listing_product" ? "Quick Studio Generate (2 Credits)" : "Full Listing Kit (5 Credits)"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Credits will be deducted only upon clicking Start Generation.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-amber-400 text-sm">
              <Coins className="h-4 w-4" />
              <span>Balance: {balance}</span>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Product Title <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Pure Cotton Floral Printed Anarkali Kurti with Dupatta"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-base font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Selling Price (₹)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 599"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Original / MRP Price (₹) <span className="text-muted-foreground text-[10px]">(Optional for discount tag)</span>
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 999"
                  value={discountPrice}
                  onChange={(e) => setDiscountPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Sizes Available
                </label>
                <Input
                  placeholder="e.g. S, M, L, XL, XXL or Free Size"
                  value={sizes}
                  onChange={(e) => setSizes(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Call To Action (CTA) Button
                </label>
                <Input
                  placeholder="e.g. Order Now via WhatsApp"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Custom Studio Art Direction / Prompt <span className="text-indigo-400 font-normal">(Optional)</span></span>
              </label>
              <Input
                placeholder="e.g. Clean white marble podium, soft morning sunlight, luxury aesthetic"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Product Fabric / Material / Notes <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <Textarea
                placeholder="e.g. 100% Rayon Cotton, breathy fabric, flared hemline, festive wear..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Visual Card & Story Design Template Selector (10 Sleek Styles) */}
            <div className="pt-4 border-t border-border/40">
              <TemplateSelector
                selectedTemplateId={selectedTemplateId}
                onSelectTemplate={setSelectedTemplateId}
                previewTitle={title}
                previewPrice={price}
                previewDiscountPrice={discountPrice}
                previewCta={ctaText}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← Back to Photos
            </Button>
            <Button
              size="lg"
              onClick={handleStartGeneration}
              className="font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-amber-500 hover:from-indigo-700 text-white gap-2 px-8"
            >
              <Sparkles className="h-4 w-4" /> Start Studio Generation
            </Button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: GENERATING (SSE & Polling) ================= */}
      {step === 3 && (
        <div className="space-y-8 max-w-4xl mx-auto py-8">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 animate-bounce">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-black">AI Studio is Crafting Your Catalog</h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Our models are removing raw backgrounds, rendering 8K lighting, and generating your marketplace copy in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Real-time Streaming Copy Preview */}
            <Card className="border-border/60 bg-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-indigo-400" />
                  <span className="font-bold text-sm">Listing Copy (Streaming)</span>
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 animate-pulse">
                  Live
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-muted-foreground block text-[10px] uppercase">Title</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {streamedText?.seoTitle || title || "Generating SEO Title..."}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-muted-foreground block text-[10px] uppercase">Features</span>
                  <ul className="space-y-1 text-muted-foreground mt-1">
                    {streamedText?.keyFeatures?.map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    )) || <li>Analyzing product geometry and fabric...</li>}
                  </ul>
                </div>
              </div>
            </Card>

            {/* Right: Studio Photo Generation Steps */}
            <Card className="border-border/60 bg-card p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="font-bold text-sm">Studio Photos & Cards</span>
                </div>
                <Badge variant="secondary" className="capitalize text-[10px]">
                  {imageGenStatus}
                </Badge>
              </div>

              <div className="space-y-4 text-xs">
                {[
                  { label: "Crop & Cleanse Raw Backdrop", done: true },
                  { label: "OpenAI Vision Prompt Enhancement", done: true },
                  { label: "Gemini 2.0 8K Studio Rendering", done: imageGenStatus === "completed" },
                  { label: "WhatsApp & Instagram Story Card Compositing", done: imageGenStatus === "completed" },
                ].map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{s.label}</span>
                    {s.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ================= STEP 4: RESULTS VIEW ================= */}
      {step === 4 && (
        <div className="space-y-8">
          {/* Top Actions: Title + Download ZIP */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white font-bold text-[10px]">Ready to Publish</Badge>
                <span className="text-xs text-muted-foreground">• {selectedType === "listing_product" ? "Quick Product" : "Listing Kit"}</span>
              </div>
              <h2 className="text-2xl font-black mt-1">
                {listingResult?.userTitle || title}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleDownloadBundle}
                className="font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md"
              >
                <Download className="h-4 w-4" /> Download Complete ZIP
              </Button>
            </div>
          </div>

          {/* Results Tabs */}
          <Tabs defaultValue="photos" className="space-y-6">
            <TabsList className="grid grid-cols-4 max-w-xl">
              <TabsTrigger value="photos" className="gap-1.5 text-xs font-bold">
                <Sparkles className="h-3.5 w-3.5" /> Studio Photos
              </TabsTrigger>
              <TabsTrigger value="catalog" className="gap-1.5 text-xs font-bold">
                <ShoppingBag className="h-3.5 w-3.5" /> Marketplace Catalog
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-1.5 text-xs font-bold">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </TabsTrigger>
              <TabsTrigger value="cards" className="gap-1.5 text-xs font-bold">
                <Instagram className="h-3.5 w-3.5" /> Social Cards
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: STUDIO PHOTOS & RE-EDIT */}
            <TabsContent value="photos" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {(listingResult?.generatedImages || []).filter((img: any) => img.isLatest !== false).map((img: any, idx: number) => (
                  <Card key={img._id || idx} className="overflow-hidden border-border/60 hover:border-indigo-500/50 transition-all flex flex-col justify-between">
                    <div className="relative aspect-square bg-muted">
                      <img src={img.url} alt={`Studio variation ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="capitalize text-[10px]">
                          {img.variationType?.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-3.5 flex items-center justify-between border-t border-border/40 bg-card/60">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReEditTarget(img);
                          setReEditPrompt("");
                        }}
                        className="h-8 text-xs font-semibold gap-1.5 text-indigo-400 hover:text-indigo-300"
                      >
                        <RotateCw className="h-3.5 w-3.5" /> Re-Edit (1 Cr)
                      </Button>

                      <a href={img.url} download target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                          <Download className="h-3 w-3" /> Save
                        </Button>
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* TAB 2: MARKETPLACE CATALOG COPY */}
            <TabsContent value="catalog" className="space-y-6 max-w-3xl">
              <Card className="border-border/60 p-6 space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Marketplace Optimized Title (Amazon, Flipkart, Meesho, Shopify)
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyText(streamedText?.meeshoListing?.title || streamedText?.seoTitle, "Title")}
                      className="h-7 text-xs gap-1 font-semibold"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 font-medium text-sm border border-border/40">
                    {streamedText?.meeshoListing?.title || streamedText?.seoTitle}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Marketplace Catalog Description & Specifications
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyText(streamedText?.meeshoListing?.description, "Description")}
                      className="h-7 text-xs gap-1 font-semibold"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 text-xs text-muted-foreground whitespace-pre-wrap font-mono border border-border/40">
                    {streamedText?.meeshoListing?.description}
                  </div>
                </div>

                {/* Key Features */}
                {streamedText?.keyFeatures && streamedText.keyFeatures.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        SEO High-Converting Key Features
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyText(streamedText.keyFeatures.map((f: string) => `• ${f}`).join("\n"), "Key Features")}
                        className="h-7 text-xs gap-1 font-semibold"
                      >
                        <Copy className="h-3 w-3" /> Copy Features
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {streamedText.keyFeatures.map((feat: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 border border-border/30 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Keywords */}
                {streamedText?.keywords && streamedText.keywords.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Target Search Keywords
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {streamedText.keywords.map((kw: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs py-1 px-2.5 bg-muted/20">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* TAB 3: WHATSAPP BROADCAST */}
            <TabsContent value="whatsapp" className="space-y-6 max-w-2xl">
              <Card className="border-border/60 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ready-to-Send WhatsApp Catalog Message
                  </span>
                  <Button
                    size="sm"
                    onClick={() => copyText(streamedText?.whatsappCaption, "WhatsApp Caption")}
                    className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" /> One-Click Copy
                  </Button>
                </div>
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-foreground whitespace-pre-wrap leading-relaxed font-sans">
                  {streamedText?.whatsappCaption}
                </div>
              </Card>
            </TabsContent>

            {/* TAB 4: SOCIAL CARDS */}
            <TabsContent value="cards" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* WhatsApp Card */}
                {listingResult?.whatsappCard?.url && (
                  <Card className="overflow-hidden border-border/60">
                    <div className="p-3 bg-muted/40 font-bold text-xs flex items-center justify-between">
                      <span>WhatsApp Catalog Card</span>
                      <a href={listingResult.whatsappCard.url} download target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    </div>
                    <img src={listingResult.whatsappCard.url} alt="WhatsApp Card" className="w-full aspect-square object-cover" />
                  </Card>
                )}

                {/* Instagram 1:1 Post */}
                {listingResult?.instagramPost?.url && (
                  <Card className="overflow-hidden border-border/60">
                    <div className="p-3 bg-muted/40 font-bold text-xs flex items-center justify-between">
                      <span>Instagram Square (1:1)</span>
                      <a href={listingResult.instagramPost.url} download target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    </div>
                    <img src={listingResult.instagramPost.url} alt="Instagram Post" className="w-full aspect-square object-cover" />
                  </Card>
                )}

                {/* Instagram 9:16 Story */}
                {listingResult?.instagramStory?.url && (
                  <Card className="overflow-hidden border-border/60">
                    <div className="p-3 bg-muted/40 font-bold text-xs flex items-center justify-between">
                      <span>Instagram Story (9:16)</span>
                      <a href={listingResult.instagramStory.url} download target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    </div>
                    <img src={listingResult.instagramStory.url} alt="Instagram Story" className="w-full aspect-[9/16] object-cover" />
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Re-Edit Modal Dialog */}
      <Dialog open={!!reEditTarget} onOpenChange={() => setReEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCw className="h-5 w-5 text-indigo-400" />
              Re-Edit Studio Photo (1 Credit)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {reEditTarget?.url && (
              <div className="w-32 h-32 mx-auto rounded-xl overflow-hidden border border-border">
                <img src={reEditTarget.url} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                What changes would you like to make?
              </label>
              <Input
                placeholder="e.g. Change pedestal to dark wood, brighten lighting, soft pink background..."
                value={reEditPrompt}
                onChange={(e) => setReEditPrompt(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Gemini will continue the photo session with your prompt guidance. The newly edited photo will replace this version.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReEditTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecuteReEdit}
              disabled={isReEditing || !reEditPrompt.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {isReEditing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Regenerate (1 Credit)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
