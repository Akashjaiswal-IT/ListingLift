"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { ListingDeliverablesTabs } from "~/components/listing/ListingDeliverablesTabs";
import { useLanguage } from "~/providers/LanguageContext";
import { downloadFile } from "~/lib/download";

export default function GeneratePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { balance, deductLocal } = useCreditStore();
  const { language } = useLanguage();
  const isHi = language === "hi";
  const utils = trpc.useUtils();

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
      utils.credits.getBalance.invalidate();
      utils.user.getCreditBalance.invalidate();

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
        Promise.allSettled([
          utils.credits.getBalance.invalidate(),
          utils.user.getCreditBalance.invalidate(),
          utils.listing.list.invalidate(),
          utils.listing.getById.invalidate({ id: activeListingId! }),
        ]);
        setStep(4);
        if (activeListingId) {
          router.push(`/app/listing/${activeListingId}`);
        }
      } else if (status === "failed") {
        Promise.allSettled([
          utils.credits.getBalance.invalidate(),
          utils.user.getCreditBalance.invalidate(),
          utils.user.getCreditHistory.invalidate(),
        ]);
        toast.error(`Generation failed: ${errorMessage || "Unknown error"}. Credits have been refunded.`);
      }
    }
  }, [step, getStatusQuery.data, activeListingId, router, utils]);

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
      await downloadFile(res.downloadUrl, "listing-bundle.zip");
      toast.success("Download complete!");
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
            <h1 className="text-3xl font-serif font-black tracking-tight flex items-center gap-2 text-foreground">
              <Sparkles className="h-6 w-6 text-[#E05822]" />
              {isHi ? "AI स्टूडियो लिस्टिंग जनरेटर" : "AI Studio Listing Generator"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {isHi
                ? "एक अपलोड → 8K स्टूडियो फ़ोटो, अमेज़ॅन/मीशो कैटलॉग, और व्हाट्सएप व इंस्टाग्राम स्टोरी कार्ड्स।"
                : "One upload → 8K Studio Photos, Marketplace Catalog, and WhatsApp & Instagram Story Cards."}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {[
              { num: 1, label: isHi ? "अपलोड" : "Upload" },
              { num: 2, label: isHi ? "विवरण" : "Details" },
              { num: 3, label: isHi ? "जेनरेशन" : "Generating" },
              { num: 4, label: isHi ? "परिणाम" : "Results" },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    step === s.num
                      ? "bg-[#E05822] text-white shadow-md shadow-[#E05822]/20"
                      : step > s.num
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
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
                  ? "border-[#E05822] bg-[#E05822]/5 shadow-md ring-1 ring-[#E05822]/30"
                  : "hover:border-border"
              }`}
            >
              <CardContent className="p-5 flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-[#E05822]/10 flex items-center justify-center text-[#E05822] shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">{isHi ? "क्विक स्टूडियो" : "Quick Generate"}</h3>
                    <Badge className="bg-[#E05822] text-white text-[10px]">
                      {isHi ? "2 क्रेडिट्स" : "2 Credits"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isHi
                      ? "1 फ़ोन फ़ोटो अपलोड करें। 2 स्टूडियो वेरिएशन (प्योर व्हाइट + लक्ज़री पोडियम), मार्केटप्लेस कॉपी और स्टोरी कार्ड्स तैयार करता है।"
                      : "Upload 1 photo. Generates 2 studio photo variations (1 Pure White + 1 Luxury Studio), marketplace catalog copy, and social cards."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              onClick={() => setSelectedType("listing_kit")}
              className={`cursor-pointer transition-all border-border/60 ${
                selectedType === "listing_kit"
                  ? "border-[#E05822] bg-[#E05822]/5 shadow-md ring-1 ring-[#E05822]/30"
                  : "hover:border-border"
              }`}
            >
              <CardContent className="p-5 flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">{isHi ? "फुल लिस्टिंग किट" : "Full Listing Kit"}</h3>
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {isHi ? "5-7 क्रेडिट्स" : "5-7 Credits"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isHi
                      ? "3 से 5 फ़ोटो (विभिन्न कोण, क्लोज़-अप, फैब्रिक) अपलोड करें। अमेज़ॅन और फ्लिपकार्ट व्हाइट बैकग्राउंड के साथ पूरा किट बनाएं।"
                      : "Upload 3 to 5 photos (angles, close-ups, fabric). Generates complete catalog suite with pure white Amazon/Flipkart outputs."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative cursor-pointer rounded-2xl border-2 border-dashed border-border/80 hover:border-[#E05822]/80 bg-muted/20 hover:bg-[#E05822]/5 p-10 text-center transition-all space-y-4"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple={selectedType === "listing_kit"}
              onChange={handleFilesSelected}
              className="hidden"
            />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E05822]/10 text-[#E05822] group-hover:scale-110 transition-transform">
              <Upload className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-bold">
                {selectedType === "listing_product"
                  ? isHi ? "1 उत्पाद फ़ोटो अपलोड करें" : "Upload 1 Product Photo"
                  : isHi ? "3 से 5 उत्पाद फ़ोटो अपलोड करें" : "Upload 3 to 5 Product Photos"}
              </h4>
              <p className="text-xs text-muted-foreground">
                {isHi
                  ? "फ़ोन कैमरे से ली गई फ़ोटो यहाँ खींचकर छोड़ें या फ़ाइल चुनें (JPG, PNG, WEBP, HEIC अधिकतम 10MB)"
                  : "Drag and drop raw camera photos here, or click to browse (JPG, PNG, WEBP, HEIC up to 10MB)"}
              </p>
            </div>
          </div>

          {/* Selected Previews */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-muted-foreground">
                {isHi ? `चुनी गई फ़ोटो (${selectedFiles.length})` : `Selected Photos (${selectedFiles.length})`}
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
              className="font-bold bg-[#E05822] hover:bg-[#c94917] text-white gap-2 px-8 rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {isHi ? "क्लाउड पर अपलोड हो रहा है..." : "Uploading to R2..."}
                </>
              ) : (
                <>
                  {isHi ? "विवरण जोड़ें" : "Continue to Details"} <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: DETAILS FORM ================= */}
      {step === 2 && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="p-4 rounded-xl border border-[#E05822]/20 bg-[#E05822]/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#E05822]" />
              <div>
                <span className="text-sm font-bold block">
                  {selectedType === "listing_product"
                    ? isHi ? "क्विक स्टूडियो जेनरेशन (2 क्रेडिट्स)" : "Quick Studio Generate (2 Credits)"
                    : isHi ? "फुल लिस्टिंग किट (5 क्रेडिट्स)" : "Full Listing Kit (5 Credits)"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isHi
                    ? "क्रेडिट्स केवल 'स्टूडियो जेनरेशन शुरू करें' पर क्लिक करने के बाद ही कटेंगे।"
                    : "Credits will be deducted only upon clicking Start Generation."}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-[#E05822] text-sm">
              <Coins className="h-4 w-4" />
              <span>{isHi ? "शेष क्रेडिट:" : "Balance:"} {balance}</span>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "उत्पाद का नाम" : "Product Title"} <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder={isHi ? "उदा. प्योर कॉटन फ्लोरल प्रिंटेड अनारकली कुर्ती दुपट्टे के साथ" : "e.g. Pure Cotton Floral Printed Anarkali Kurti with Dupatta"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-base font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isHi ? "बिक्री मूल्य (₹)" : "Selling Price (₹)"}
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
                  {isHi ? "मूल / MRP मूल्य (₹)" : "Original / MRP Price (₹)"} <span className="text-muted-foreground text-[10px]">({isHi ? "डिस्काउंट टैग के लिए वैकल्पिक" : "Optional for discount tag"})</span>
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
                  {isHi ? "उपलब्ध साइज़" : "Sizes Available"}
                </label>
                <Input
                  placeholder={isHi ? "उदा. S, M, L, XL, XXL या फ्री साइज़" : "e.g. S, M, L, XL, XXL or Free Size"}
                  value={sizes}
                  onChange={(e) => setSizes(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isHi ? "कॉल टू एक्शन (CTA) बटन" : "Call To Action (CTA) Button"}
                </label>
                <Input
                  placeholder={isHi ? "उदा. व्हाट्सएप पर ऑर्डर करें" : "e.g. Order Now via WhatsApp"}
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>{isHi ? "कस्टम स्टूडियो आर्ट डायरेक्शन / प्रॉम्प्ट" : "Custom Studio Art Direction / Prompt"} <span className="text-[#E05822] font-normal">({isHi ? "वैकल्पिक" : "Optional"})</span></span>
              </label>
              <Input
                placeholder={isHi ? "उदा. क्लीन व्हाइट मार्बल पोडियम, सॉफ्ट सुबह की धूप, लक्ज़री स्टाइल" : "e.g. Clean white marble podium, soft morning sunlight, luxury aesthetic"}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "उत्पाद सामग्री / कपड़ा / नोट्स" : "Product Fabric / Material / Notes"} <span className="text-muted-foreground font-normal">({isHi ? "वैकल्पिक" : "Optional"})</span>
              </label>
              <Textarea
                placeholder={isHi ? "उदा. 100% रेयान कॉटन, आरामदायक कपड़ा, फेस्टिव वियर..." : "e.g. 100% Rayon Cotton, breathy fabric, flared hemline, festive wear..."}
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
            <Button variant="ghost" onClick={() => setStep(1)} className="rounded-xl">
              {isHi ? "← वापस फ़ोटो पर" : "← Back to Photos"}
            </Button>
            <Button
              size="lg"
              onClick={handleStartGeneration}
              className="font-bold bg-[#E05822] hover:bg-[#c94917] text-white gap-2 px-8 rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" /> {isHi ? "स्टूडियो जेनरेशन शुरू करें" : "Start Studio Generation"}
            </Button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: GENERATING (SSE & Polling) ================= */}
      {step === 3 && (
        <div className="space-y-8 max-w-4xl mx-auto py-8">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E05822]/10 text-[#E05822] animate-bounce">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-serif font-black text-foreground">
              {isHi ? "AI स्टूडियो आपका कैटलॉग तैयार कर रहा है" : "AI Studio is Crafting Your Catalog"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              {isHi
                ? "हमारे मॉडल्स सामान्य बैकग्राउंड हटा रहे हैं, 8K स्टूडियो लाइटिंग रेंडर कर रहे हैं और रियल-टाइम में आपकी लिस्टिंग कॉपी जनरेट कर रहे हैं।"
                : "Our models are removing raw backgrounds, rendering 8K lighting, and generating your marketplace copy in real time."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Real-time Streaming Copy Preview */}
            <Card className="border-border/60 bg-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-[#E05822]" />
                  <span className="font-bold text-sm text-foreground">
                    {isHi ? "लिस्टिंग कॉपी (लाइव)" : "Listing Copy (Streaming)"}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 animate-pulse">
                  {isHi ? "लाइव" : "Live"}
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-muted-foreground block text-[10px] uppercase">
                    {isHi ? "टाइटल" : "Title"}
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {streamedText?.seoTitle || title || (isHi ? "एसईओ टाइटल जनरेट हो रहा है..." : "Generating SEO Title...")}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-muted-foreground block text-[10px] uppercase">
                    {isHi ? "मुख्य फ़ीचर्स" : "Features"}
                  </span>
                  <ul className="space-y-1 text-muted-foreground mt-1">
                    {streamedText?.keyFeatures?.map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    )) || <li>{isHi ? "उत्पाद विवरण का विश्लेषण हो रहा है..." : "Analyzing product geometry and fabric..."}</li>}
                  </ul>
                </div>
              </div>
            </Card>

            {/* Right: Studio Photo Generation Steps */}
            <Card className="border-border/60 bg-card p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#E05822]" />
                  <span className="font-bold text-sm text-foreground">
                    {isHi ? "स्टूडियो फ़ोटो और कार्ड्स" : "Studio Photos & Cards"}
                  </span>
                </div>
                <Badge variant="secondary" className="capitalize text-[10px]">
                  {isHi
                    ? imageGenStatus === "completed" ? "पूर्ण" : imageGenStatus === "failed" ? "असफल" : "प्रगति पर"
                    : imageGenStatus}
                </Badge>
              </div>

              <div className="space-y-4 text-xs">
                {[
                  {
                    label: isHi ? "सामान्य बैकग्राउंड क्लीनअप और संरेखण" : "Crop & Cleanse Raw Backdrop",
                    done: true,
                  },
                  {
                    label: isHi ? "विज़न प्रॉम्प्ट विश्लेषण" : "OpenAI Vision Prompt Enhancement",
                    done: true,
                  },
                  {
                    label: isHi ? "Gemini 2.0 8K स्टूडियो रेंडरिंग" : "Gemini 2.0 8K Studio Rendering",
                    done: imageGenStatus === "completed",
                  },
                  {
                    label: isHi ? "व्हाट्सएप व इंस्टाग्राम स्टोरी कार्ड कम्पोज़िंग" : "WhatsApp & Instagram Story Card Compositing",
                    done: imageGenStatus === "completed",
                  },
                ].map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{s.label}</span>
                    {s.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-[#E05822] animate-spin" />
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
          {/* Top Actions: Title + Hub Link + Download ZIP */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                  {isHi ? "पब्लिश के लिए तैयार" : "Ready to Publish"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  • {selectedType === "listing_product"
                    ? isHi ? "क्विक स्टूडियो" : "Quick Product"
                    : isHi ? "फुल लिस्टिंग किट" : "Listing Kit"}
                </span>
              </div>
              <h2 className="text-2xl font-serif font-black mt-1 text-foreground">
                {listingResult?.userTitle || title}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {activeListingId && (
                <Link href={`/app/listing/${activeListingId}`}>
                  <Button variant="outline" size="sm" className="gap-1.5 font-semibold text-xs h-9 rounded-xl border-border">
                    <ExternalLink className="h-4 w-4" /> {isHi ? "कैटलॉग हब में खोलें" : "Open in Deliverables Hub"}
                  </Button>
                </Link>
              )}
              <Button
                onClick={handleDownloadBundle}
                className="font-bold bg-[#E05822] hover:bg-[#c94917] text-white gap-2 shadow-md rounded-xl text-xs h-9"
              >
                <Download className="h-4 w-4" /> {isHi ? "पूरा ZIP डाउनलोड करें" : "Download Complete ZIP"}
              </Button>
            </div>
          </div>

          {/* 6 Constant Standard Deliverables Tabs */}
          <ListingDeliverablesTabs
            listing={listingResult}
            onReEditClick={(img) => {
              setReEditTarget(img);
              setReEditPrompt("");
            }}
          />
        </div>
      )}

      {/* Re-Edit Modal Dialog */}
      <Dialog open={!!reEditTarget} onOpenChange={() => setReEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif font-bold text-foreground">
              <RotateCw className="h-5 w-5 text-[#E05822]" />
              {isHi ? "स्टूडियो फ़ोटो री-एडिट करें (1 क्रेडिट)" : "Re-Edit Studio Photo (1 Credit)"}
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
                {isHi ? "आप क्या बदलाव करना चाहते हैं?" : "What changes would you like to make?"}
              </label>
              <Input
                placeholder={isHi ? "उदा. पेडस्टल को डार्क वुड में बदलें, लाइटिंग ब्राइट करें, सॉफ्ट पिंक बैकग्राउंड..." : "e.g. Change pedestal to dark wood, brighten lighting, soft pink background..."}
                value={reEditPrompt}
                onChange={(e) => setReEditPrompt(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isHi
                ? "Gemini आपके प्रॉम्प्ट के अनुसार फ़ोटो को संशोधित करेगा। नया संशोधित फ़ोटो इस वर्ज़न को रिप्लेस कर देगा।"
                : "Gemini will continue the photo session with your prompt guidance. The newly edited photo will replace this version."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReEditTarget(null)}>
              {isHi ? "रद्द करें" : "Cancel"}
            </Button>
            <Button
              onClick={handleExecuteReEdit}
              disabled={isReEditing || !reEditPrompt.trim()}
              className="bg-[#E05822] hover:bg-[#c94917] text-white font-bold"
            >
              {isReEditing ? <Loader2 className="h-4 w-4 animate-spin" /> : isHi ? "पुनः जनरेट करें (1 क्रेडिट)" : "Regenerate (1 Credit)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
