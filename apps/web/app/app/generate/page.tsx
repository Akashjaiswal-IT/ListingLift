"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { trpc } from "~/trpc/client";
import { useCreditStore } from "~/stores/useCreditStore";
import { useGenerationStore } from "~/stores/useGenerationStore";
import { TemplateSelector } from "~/components/generate/TemplateSelector";
import { SmallPrintTip } from "~/components/generate/SmallPrintTip";
import { DEFAULT_TEMPLATE_ID, TemplateId } from "~/lib/card-templates";
import { toast } from "sonner";
import { ListingDeliverablesTabs } from "~/components/listing/ListingDeliverablesTabs";
import { useLanguage } from "~/providers/LanguageContext";
import { downloadFile } from "~/lib/download";
import { trackEvent, captureError } from "~/lib/analytics";
import { calculateGenerationCredits, calculateProQualitySurcharge } from "~/lib/pricing";
import { Checkbox } from "~/components/ui/checkbox";
import { adaptiveStatusInterval } from "~/lib/polling";
import { GenerationProgressCard } from "~/components/generate/GenerationProgressCard";
import { compressImage, putWithProgress } from "~/lib/upload-image";
import { InsufficientCreditsDialog } from "~/components/credits/InsufficientCreditsDialog";

// Matches the dropzone copy ("up to 10MB") so oversized photos are caught
// before a slow mobile upload instead of failing afterwards.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { balance, deductLocal } = useCreditStore();
  const { language } = useLanguage();
  const isHi = language === "hi";
  const utils = trpc.useUtils();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedType, setSelectedType] = useState<"listing_product" | "listing_kit">("listing_product");
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; preview: string }[]>([]);
  const selectedFilesRef = useRef(selectedFiles);
  selectedFilesRef.current = selectedFiles;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [mrp, setMrp] = useState<string>("");
  const [sellingPrice, setSellingPrice] = useState<string>("");
  // Empty by default: most products (bags, watches, decor…) have no sizes, and
  // whatever is typed here is printed on the cards.
  const [sizes, setSizes] = useState<string>("");
  const [titleError, setTitleError] = useState(false);
  // In-page "buy credits" dialog (keeps the uploaded photos and typed details)
  const [buyCreditsNeeded, setBuyCreditsNeeded] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>(DEFAULT_TEMPLATE_ID);
  const [keepWear, setKeepWear] = useState(false);
  const [qualityMode, setQualityMode] = useState<"standard" | "pro">("standard");
  const creditsNeeded = calculateGenerationCredits(selectedType, selectedFiles.length, qualityMode);
  const proSurcharge = calculateProQualitySurcharge(selectedType, selectedFiles.length);
  const sellingExceedsMrp = !!mrp && !!sellingPrice && parseFloat(sellingPrice) > parseFloat(mrp);
  const priceErrorMessage = isHi ? "बिक्री मूल्य MRP से ज़्यादा नहीं हो सकता" : "Selling price can't be higher than MRP";

  // User profile query for default branding & CTA
  const profileQuery = trpc.user.getProfile.useQuery();
  const userProfile = profileQuery.data as any;
  const [hasUserEditedCta, setHasUserEditedCta] = useState(false);
  const [ctaText, setCtaText] = useState("");

  // Sync profile's default CTA once loaded, unless the user has already typed a custom one
  useEffect(() => {
    if (userProfile && !hasUserEditedCta) {
      if (userProfile.defaultCta?.text) {
        setCtaText(userProfile.defaultCta.text);
      } else {
        setCtaText(isHi ? "व्हाट्सएप पर ऑर्डर करें" : "Order Now via WhatsApp");
      }
    }
  }, [userProfile, hasUserEditedCta, isHi]);

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
        if (s === "completed" || s === "failed" || s === "uploaded") return false;
        return adaptiveStatusInterval(query.state.dataUpdateCount);
      },
    }
  );
  const getResultQuery = trpc.generate.getResult.useQuery(
    { listingObjectId: activeListingId || "" },
    {
      enabled: step === 4 && !!activeListingId,
    }
  );
  const retryMutation = trpc.generate.retry.useMutation();
  const reEditMutation = trpc.generate.reEditImage.useMutation();
  const downloadBundleMutation = trpc.download.downloadBundle.useMutation();

  // Resume an in-progress generation after a refresh. If the URL carries
  // ?listing=<id> and we have no active listing in memory, adopt it and jump to
  // the progress step; the status query then takes over and the completion
  // effect will forward to the finished listing page once it's done.
  useEffect(() => {
    const resumeId = searchParams.get("listing");
    if (resumeId && !activeListingId) {
      setActiveListingId(resumeId);
      setStep(3);
    } else if (!resumeId && searchParams.get("sample") === "1") {
      // "Try with a sample photo" links: preload the bundled sample.
      void handleUseSample();
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared helper to add valid image files
  const addFiles = (files: File[]) => {
    const isImage = (f: File) => ALLOWED_TYPES.includes(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);
    const validFiles = files.filter((f) => isImage(f) && f.size <= MAX_UPLOAD_BYTES);
    if (validFiles.length < files.length) {
      toast.error(
        isHi
          ? "कुछ फ़ाइलें छोड़ दी गईं: सिर्फ़ JPG, PNG, WEBP या HEIC फ़ोटो, अधिकतम 10MB।"
          : "Some files were skipped: only JPG, PNG, WEBP or HEIC photos up to 10MB."
      );
    }
    if (!validFiles.length) return;
    const newItems = validFiles.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));

    if (selectedType === "listing_product") {
      setSelectedFiles([newItems[0]!]);
    } else {
      setSelectedFiles((prev) => {
        if (prev.length + newItems.length > 5) {
          toast.info(isHi ? "एक किट में ज़्यादा से ज़्यादा 5 फ़ोटो रखी गई हैं।" : "A kit takes up to 5 photos; the first 5 were kept.");
        }
        return [...prev, ...newItems].slice(0, 5);
      });
    }
  };

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // Handle image files selection
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(Array.from(e.target.files));
    }
    // Always reset the input's value so selecting the exact same file again triggers onChange
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      // Free the blob URL we created for the preview, or it leaks memory until
      // the tab is closed (each createObjectURL holds the file in memory).
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });

    // Reset file input value so re-selecting the removed file immediately triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      selectedFilesRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, []);

  // Onboarding helper: load a bundled sample product photo so a first-time user
  // can run the whole flow immediately without hunting for a photo. It behaves
  // exactly like a normally-selected file from here on.
  const handleUseSample = async () => {
    try {
      const res = await fetch("/images/hero-before.jpg");
      if (!res.ok) throw new Error("sample unavailable");
      const blob = await res.blob();
      const file = new File([blob], "sample-product.jpg", {
        type: blob.type || "image/jpeg",
      });
      selectedFiles.forEach((it) => URL.revokeObjectURL(it.preview));
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedType("listing_product");
      setSelectedFiles([{ file, preview: URL.createObjectURL(file) }]);
      toast.success(
        isHi ? "सैंपल फ़ोटो लोड हो गई — अब जनरेट करें!" : "Sample photo loaded — try generating it!"
      );
    } catch {
      toast.error(isHi ? "सैंपल लोड करने में विफल" : "Couldn't load the sample photo");
    }
  };

  // Upload to R2 and transition to Step 2
  const handleProceedToDetails = async () => {
    if (selectedFiles.length === 0) {
      toast.error(isHi ? "कम से कम एक प्रोडक्ट फ़ोटो डालें" : "Please add at least one product photo");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const uploadedOriginals = [];
      const total = selectedFiles.length;
      for (let i = 0; i < selectedFiles.length; i++) {
        const item = selectedFiles[i]!;

        // 1. Compress/resize in the browser first (saves the user's data and
        //    speeds up slow mobile connections). Falls back to the original on
        //    failure, and passes HEIC through untouched.
        const fileToUpload = await compressImage(item.file);
        const contentType = fileToUpload.type || "image/jpeg";

        const presigned = await getPresignedUrlMutation.mutateAsync({
          fileName: fileToUpload.name,
          mimeType: contentType,
        });

        // 2. Upload via XHR so we get real progress. Aggregate per-file progress
        //    into an overall percentage across all selected photos.
        await putWithProgress(presigned.uploadUrl, fileToUpload, contentType, (pct) => {
          setUploadProgress(Math.round(((i + pct / 100) / total) * 100));
        });

        uploadedOriginals.push({
          s3Key: presigned.s3Key,
          fileName: fileToUpload.name,
          url: presigned.publicUrl,
        });
      }
      setUploadProgress(100);

      // Confirm upload and initialize/update listingObject in MongoDB
      const res = await confirmUploadMutation.mutateAsync({
        type: selectedType,
        originalImages: uploadedOriginals,
        listingObjectId: activeListingId || undefined,
      });

      setActiveListingId(res.listingObjectId);
      trackEvent("photos_uploaded", {
        count: uploadedOriginals.length,
        type: selectedType,
      });
      setStep(2);
      toast.success(isHi ? "फ़ोटो अपलोड हो गईं!" : "Photos uploaded!");
    } catch (err: any) {
      toast.error(err.message || (isHi ? "फ़ोटो अपलोड नहीं हो सकीं" : "Failed to upload photos"));
      captureError(err, { where: "handleProceedToDetails", type: selectedType });
    } finally {
      setIsUploading(false);
    }
  };

  // Step 2 -> Step 3: Trigger generation
  const handleStartGeneration = async () => {
    if (!activeListingId) return;
    if (!title.trim()) {
      setTitleError(true);
      document.getElementById("gen-title")?.focus();
      toast.error(isHi ? "प्रोडक्ट का नाम डालें" : "Please enter a product title");
      return;
    }
    if (sellingExceedsMrp) {
      toast.error(priceErrorMessage);
      return;
    }

    // creditsNeeded comes from the shared pricing helper (see lib/pricing.ts) so
    // the quote here always matches what the server actually charges.
    if (balance < creditsNeeded) {
      // Buy in place instead of leaving the page (which would lose the form).
      setBuyCreditsNeeded(creditsNeeded);
      return;
    }

    try {
      setStep(3);
      trackEvent("listing_generation_started", {
        listingId: activeListingId,
        type: selectedType,
        templateId: selectedTemplateId,
        creditsNeeded,
        keepWear,
        qualityMode,
      });

      const genRes = await startGenerationMutation.mutateAsync({
        listingObjectId: activeListingId,
        userTitle: title,
        userDescription: description,
        userPrompt: customPrompt,
        templateId: selectedTemplateId,
        // DB/API semantics: price = MRP (struck-through), discountPrice = selling price
        price: mrp ? parseFloat(mrp) : undefined,
        discountPrice: sellingPrice ? parseFloat(sellingPrice) : undefined,
        sizes: sizes ? sizes.split(",").map((s) => s.trim()) : undefined,
        ctaText: ctaText.trim() || undefined,
        keepWear,
        qualityMode,
      });

      // Generation successfully queued on server! Reflect in URL so user can safely refresh to resume
      router.replace(`/app/generate?listing=${activeListingId}`);
      deductLocal(creditsNeeded);
      utils.credits.getBalance.invalidate();
      utils.user.getCreditBalance.invalidate();

      toast.info(
        isHi
          ? `जेनरेशन शुरू हो गया! ${genRes.creditsCharged} क्रेडिट लगे।`
          : `Generation started! ${genRes.creditsCharged} credits used.`
      );
    } catch (err: any) {
      trackEvent("listing_generation_failed", {
        listingId: activeListingId,
        error: err.message,
      });
      // Clean up URL so refresh cannot get stuck in progress for a job that never started
      router.replace("/app/generate");
      toast.error(err.message || (isHi ? "जेनरेशन शुरू नहीं हो सका" : "Failed to start generation"));
      setStep(2);
      utils.user.getCreditBalance.invalidate();
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
        trackEvent("listing_generation_completed", {
          listingId: activeListingId,
          type: selectedType,
        });
        toast.success(isHi ? "स्टूडियो फ़ोटो और लिस्टिंग तैयार हैं!" : "Studio photos and listing are ready!");
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
        trackEvent("listing_generation_failed", {
          listingId: activeListingId,
          error: errorMessage,
        });
        Promise.allSettled([
          utils.credits.getBalance.invalidate(),
          utils.user.getCreditBalance.invalidate(),
          utils.user.getCreditHistory.invalidate(),
        ]);
        toast.error(
          getStatusQuery.data.creditsRefunded
            ? isHi
              ? "जेनरेशन असफल रहा। आपके क्रेडिट वापस कर दिए गए हैं।"
              : "Generation failed. Your credits were refunded."
            : isHi
              ? "जेनरेशन असफल रहा। आपका रिफंड प्रोसेस हो रहा है।"
              : "Generation failed. We're processing your refund."
        );
      } else if (status === "uploaded") {
        // Generation was never started on the server; escape the endless progress loop
        router.replace("/app/generate");
        setActiveListingId(null);
        setStep(1);
        toast.info(isHi ? "यह जेनरेशन शुरू नहीं हुई थी।" : "This generation was not started.");
      }
    }
  }, [step, getStatusQuery.data, activeListingId, router, utils, isHi]);

  // If status query errors (e.g. invalid or deleted listing ID in URL), escape to Step 1
  useEffect(() => {
    if (step === 3 && getStatusQuery.isError) {
      router.replace("/app/generate");
      setActiveListingId(null);
      setStep(1);
      toast.error(isHi ? "कैटलॉग नहीं मिला" : "Listing not found");
    }
  }, [step, getStatusQuery.isError, router, isHi]);

  // Failed generation: re-queue it (the server re-charges only if the credits were refunded)
  const handleRetryGeneration = async () => {
    if (!activeListingId) return;
    try {
      await retryMutation.mutateAsync({ listingObjectId: activeListingId });
      setImageGenStatus("queued");
      // Reset the status query so polling restarts (fast) from the fresh "queued" state
      await utils.generate.getStatus.reset({ listingObjectId: activeListingId });
      Promise.allSettled([
        utils.credits.getBalance.invalidate(),
        utils.user.getCreditBalance.invalidate(),
        utils.user.getCreditHistory.invalidate(),
      ]);
      toast.success(isHi ? "जनरेशन फिर से शुरू हो गया" : "Generation restarted");
    } catch (err: any) {
      toast.error(err.message || (isHi ? "फिर से शुरू नहीं हो सका" : "Couldn't restart generation"));
    }
  };

  // Failed generation: go back to the form (entered details are kept)
  const handleEditDetails = async () => {
    if (activeListingId) {
      await utils.generate.getStatus.reset({ listingObjectId: activeListingId });
    }
    setImageGenStatus("pending");
    setStep(2);
  };

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
      toast.info(isHi ? "ZIP पैकेज तैयार हो रहा है..." : "Preparing ZIP package...");
      const res = await downloadBundleMutation.mutateAsync({
        listingObjectId: activeListingId,
      });
      trackEvent("listing_downloaded", {
        listingId: activeListingId,
        type: "zip_bundle",
      });
      await downloadFile(res.downloadUrl, "listing-bundle.zip");
      toast.success(isHi ? "डाउनलोड पूरा हुआ!" : "Download complete!");
    } catch (err: any) {
      toast.error(err.message || (isHi ? "ZIP नहीं बन सका" : "Failed to create bundle"));
    }
  };

  // Handle Re-edit image modal
  const handleExecuteReEdit = async () => {
    if (!reEditTarget || !reEditPrompt.trim() || !activeListingId) return;
    if (balance < 1) {
      setBuyCreditsNeeded(1);
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
      toast.success(isHi ? "री-एडिट शुरू हुआ! फ़ोटो पीछे अपडेट हो रही है।" : "Re-edit started! Your image is updating in the background.");
      setReEditTarget(null);
      setReEditPrompt("");
      // Refetch result
      getResultQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || (isHi ? "री-एडिट नहीं हो सका" : "Failed to re-edit image"));
    } finally {
      setIsReEditing(false);
    }
  };

  // Helper copy to clipboard
  const copyText = async (txt: string, label: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      toast.success(isHi ? `${label} कॉपी हो गया!` : `Copied ${label}!`);
    } catch {
      toast.error(isHi ? "कॉपी नहीं हो सका" : "Couldn't copy");
    }
  };

  const genInfo = getStatusQuery.data;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-8">
      <InsufficientCreditsDialog
        open={buyCreditsNeeded !== null}
        onOpenChange={(open) => {
          if (!open) setBuyCreditsNeeded(null);
        }}
        needed={buyCreditsNeeded ?? creditsNeeded}
        balance={balance}
      />
      {/* Progress Steps Header */}
      <div className="border-b border-border/40 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-black tracking-tight flex items-center gap-2 text-foreground">
              <Sparkles className="h-6 w-6 text-primary" />
              {isHi ? "AI स्टूडियो लिस्टिंग जनरेटर" : "AI Studio Listing Generator"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {isHi
                ? "एक अपलोड → स्टूडियो-क्वालिटी फ़ोटो, अमेज़ॅन/मीशो कैटलॉग, और व्हाट्सएप व इंस्टाग्राम स्टोरी कार्ड्स।"
                : "One upload → Studio-Quality Photos, Marketplace Catalog, and WhatsApp & Instagram Story Cards."}
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
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : step > s.num
                      ? "bg-success/20 text-success border border-success/30"
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
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            role="radiogroup"
            aria-label={isHi ? "जनरेशन प्रकार चुनें" : "Choose generation type"}
          >
            <Card
              role="radio"
              aria-checked={selectedType === "listing_product"}
              tabIndex={0}
              aria-label={isHi ? "क्विक स्टूडियो" : "Quick Generate"}
              onClick={() => {
                setSelectedType("listing_product");
                if (selectedFiles.length > 1) setSelectedFiles([selectedFiles[0]!]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              onKeyDown={(e) => {
                // Enter/Space select the option, matching native radio behaviour.
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedType("listing_product");
                  if (selectedFiles.length > 1) setSelectedFiles([selectedFiles[0]!]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }
              }}
              className={`cursor-pointer transition-all border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                selectedType === "listing_product"
                  ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/30"
                  : "hover:border-border"
              }`}
            >
              <CardContent className="p-5 flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">{isHi ? "क्विक स्टूडियो" : "Quick Generate"}</h3>
                    <Badge className="bg-primary text-primary-foreground text-xs">
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
              role="radio"
              aria-checked={selectedType === "listing_kit"}
              tabIndex={0}
              aria-label={isHi ? "फुल लिस्टिंग किट" : "Full Listing Kit"}
              onClick={() => setSelectedType("listing_kit")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedType("listing_kit");
                }
              }}
              className={`cursor-pointer transition-all border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                selectedType === "listing_kit"
                  ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/30"
                  : "hover:border-border"
              }`}
            >
              <CardContent className="p-5 flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-credit/10 flex items-center justify-center text-credit shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">{isHi ? "फुल लिस्टिंग किट" : "Full Listing Kit"}</h3>
                    <Badge variant="secondary" className="text-xs font-bold">
                      {isHi
                        ? `${calculateGenerationCredits("listing_kit", 1)}–${calculateGenerationCredits("listing_kit", 5)} क्रेडिट्स`
                        : `${calculateGenerationCredits("listing_kit", 1)}–${calculateGenerationCredits("listing_kit", 5)} Credits`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isHi
                      ? "1 से 5 फ़ोटो (3+ बेहतर: अलग कोण, क्लोज़-अप, फैब्रिक) डालें। अमेज़ॅन और फ्लिपकार्ट व्हाइट बैकग्राउंड के साथ पूरा किट बनाएं।"
                      : "Add 1 to 5 photos (3+ works best: angles, close-ups, fabric). Generates a complete catalog suite with pure white Amazon/Flipkart outputs."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upload Dropzone */}
          <div
            role="button"
            tabIndex={0}
            aria-label={isHi ? "फ़ोटो अपलोड करें" : "Upload photos"}
            onClick={openFilePicker}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openFilePicker();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.length) {
                addFiles(Array.from(e.dataTransfer.files));
                if (fileInputRef.current) fileInputRef.current.value = "";
              }
            }}
            className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              isDragging
                ? "border-primary bg-primary/10 shadow-inner"
                : "border-border/80 hover:border-primary/80 bg-muted/20 hover:bg-primary/5"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple={selectedType === "listing_kit"}
              onChange={handleFilesSelected}
              className="hidden"
            />
            {/* Opens the phone camera directly (rear camera) */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFilesSelected}
              className="hidden"
            />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
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

          {/* Phones: take the photo right now */}
          <div className="sm:hidden">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 gap-2 rounded-xl text-base font-semibold"
              onClick={() => {
                if (cameraInputRef.current) {
                  cameraInputRef.current.value = "";
                  cameraInputRef.current.click();
                }
              }}
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
              {isHi ? "कैमरा से फ़ोटो खींचें" : "Take a photo"}
            </Button>
          </div>

          {/* Onboarding: try a sample photo (only before anything is selected) */}
          {selectedFiles.length === 0 && (
            <div className="text-center">
              <button
                type="button"
                onClick={handleUseSample}
                className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded py-2"
              >
                {isHi ? "फ़ोटो नहीं है? एक सैंपल आज़माएँ →" : "No photo handy? Try a sample →"}
              </button>
            </div>
          )}

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
                    <img src={item.preview} alt={isHi ? `चुनी गई फ़ोटो ${index + 1}` : `Selected photo ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      aria-label={isHi ? `फ़ोटो ${index + 1} हटाएँ` : `Remove photo ${index + 1}`}
                      className="absolute top-1.5 right-1.5 h-8 w-8 rounded-full bg-black/70 text-white flex items-center justify-center transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <div className="absolute bottom-1.5 left-1.5">
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        #{index + 1}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div className="space-y-2 pt-2" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{isHi ? "फ़ोटो अपलोड हो रही हैं..." : "Uploading photos..."}</span>
                <span className="font-semibold tabular-nums">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end pt-4">
            <Button
              size="lg"
              disabled={selectedFiles.length === 0 || isUploading}
              onClick={handleProceedToDetails}
              className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 px-8 rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />{" "}
                  {isHi ? `अपलोड हो रहा है... ${uploadProgress}%` : `Uploading... ${uploadProgress}%`}
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
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <span className="text-sm font-bold block">
                  {selectedType === "listing_product"
                    ? isHi ? `क्विक स्टूडियो जेनरेशन (${creditsNeeded} क्रेडिट्स)` : `Quick Studio Generate (${creditsNeeded} Credits)`
                    : isHi ? `फुल लिस्टिंग किट (${creditsNeeded} क्रेडिट्स)` : `Full Listing Kit (${creditsNeeded} Credits)`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isHi
                    ? "क्रेडिट्स केवल 'स्टूडियो जेनरेशन शुरू करें' पर क्लिक करने के बाद ही कटेंगे।"
                    : "Credits will be deducted only upon clicking Start Generation."}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-primary text-sm">
              <Coins className="h-4 w-4" />
              <span>{isHi ? "शेष क्रेडिट:" : "Balance:"} {balance}</span>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
            <div className="space-y-1.5">
              <label htmlFor="gen-title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "उत्पाद का नाम" : "Product Title"} <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <Input
                id="gen-title"
                required
                aria-required="true"
                aria-invalid={titleError && !title.trim() ? true : undefined}
                aria-describedby={titleError && !title.trim() ? "gen-title-error" : undefined}
                placeholder={isHi ? "उदा. प्योर कॉटन फ्लोरल प्रिंटेड अनारकली कुर्ती दुपट्टे के साथ" : "e.g. Pure Cotton Floral Printed Anarkali Kurti with Dupatta"}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (e.target.value.trim()) setTitleError(false);
                }}
                className="text-base font-medium"
              />
              {titleError && !title.trim() && (
                <p id="gen-title-error" className="text-sm font-medium text-destructive">
                  {isHi ? "प्रोडक्ट का नाम ज़रूरी है" : "Product title is required"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="gen-selling-price" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isHi ? "बिक्री मूल्य (₹)" : "Selling Price (₹)"}
                </label>
                <Input
                  id="gen-selling-price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="e.g. 599"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="gen-mrp" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isHi ? "मूल / MRP मूल्य (₹)" : "Original / MRP Price (₹)"} <span className="text-muted-foreground text-xs">({isHi ? "डिस्काउंट टैग के लिए वैकल्पिक" : "Optional for discount tag"})</span>
                </label>
                <Input
                  id="gen-mrp"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="e.g. 999"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                />
              </div>
            </div>
            {sellingExceedsMrp && (
              <p role="alert" className="text-sm font-medium text-destructive">{priceErrorMessage}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="gen-sizes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isHi ? "उपलब्ध साइज़" : "Sizes Available"}{" "}
                  <span className="font-normal normal-case">({isHi ? "वैकल्पिक" : "Optional"})</span>
                </label>
                <Input
                  id="gen-sizes"
                  placeholder={isHi ? "उदा. S, M, L, XL, XXL या फ्री साइज़" : "e.g. S, M, L, XL, XXL or Free Size"}
                  value={sizes}
                  onChange={(e) => setSizes(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="gen-cta" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>{isHi ? "कॉल टू एक्शन (CTA) बटन" : "Call To Action (CTA) Button"}</span>
                  {userProfile?.defaultCta?.text && (
                    <span className="text-xs text-muted-foreground font-normal">
                      {isHi ? "(प्रोफ़ाइल डिफ़ॉल्ट)" : "(from profile)"}
                    </span>
                  )}
                </label>
                <Input
                  id="gen-cta"
                  placeholder={
                    userProfile?.defaultCta?.text ||
                    (isHi ? "उदा. व्हाट्सएप पर ऑर्डर करें" : "e.g. Order Now via WhatsApp")
                  }
                  value={ctaText}
                  onChange={(e) => {
                    setHasUserEditedCta(true);
                    setCtaText(e.target.value);
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="gen-prompt" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>{isHi ? "कस्टम स्टूडियो आर्ट डायरेक्शन / प्रॉम्प्ट" : "Custom Studio Art Direction / Prompt"} <span className="text-primary font-normal">({isHi ? "वैकल्पिक" : "Optional"})</span></span>
              </label>
              <Input
                id="gen-prompt"
                placeholder={isHi ? "उदा. क्लीन व्हाइट मार्बल पोडियम, सॉफ्ट सुबह की धूप, लक्ज़री स्टाइल" : "e.g. Clean white marble podium, soft morning sunlight, luxury aesthetic"}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="gen-notes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isHi ? "उत्पाद सामग्री / कपड़ा / नोट्स" : "Product Fabric / Material / Notes"} <span className="text-muted-foreground font-normal">({isHi ? "वैकल्पिक" : "Optional"})</span>
              </label>
              <Textarea
                id="gen-notes"
                placeholder={isHi ? "उदा. 100% रेयान कॉटन, आरामदायक कपड़ा, फेस्टिव वियर..." : "e.g. 100% Rayon Cotton, breathy fabric, flared hemline, festive wear..."}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <SmallPrintTip />

            {/* Generation options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                htmlFor="opt-keep-wear"
                className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
                  keepWear ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"
                }`}
              >
                <Checkbox
                  id="opt-keep-wear"
                  checked={keepWear}
                  onCheckedChange={(v) => setKeepWear(v === true)}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-bold text-foreground">
                    {isHi ? "इस्तेमाल के निशान रखें" : "Keep signs of use"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {isHi
                      ? "पुराने या इस्तेमाल किए गए सामान के लिए। खरोंच और घिसाव आपकी फ़ोटो जैसे ही रहेंगे — बाकी सब कुछ साफ़ और सुंदर तरीके से दिखाया जाएगा।"
                      : "For used or pre-owned items. Scuffs and wear stay exactly as in your photo — everything else is still cleaned up and presented well."}
                  </span>
                </span>
              </label>

              <label
                htmlFor="opt-pro-quality"
                className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
                  qualityMode === "pro" ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"
                }`}
              >
                <Checkbox
                  id="opt-pro-quality"
                  checked={qualityMode === "pro"}
                  onCheckedChange={(v) => setQualityMode(v === true ? "pro" : "standard")}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-bold text-foreground">
                    {isHi ? `प्रो क्वालिटी (+${proSurcharge} क्रेडिट)` : `Pro quality (+${proSurcharge} ${proSurcharge === 1 ? "credit" : "credits"})`}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {isHi
                      ? "ज़्यादा शार्प 2K मुख्य फ़ोटो, गहरी AI सोच और एक अतिरिक्त क्वालिटी-चेक प्रयास। Amazon और Flipkart के लिए सबसे अच्छा।"
                      : "Sharper 2K main image, deeper AI thinking and one extra quality-check attempt. Best for Amazon & Flipkart."}
                  </span>
                </span>
              </label>
            </div>

            {/* Visual Card & Story Design Template Selector (10 Sleek Styles) */}
            <div className="pt-4 border-t border-border/40">
              <TemplateSelector
                selectedTemplateId={selectedTemplateId}
                onSelectTemplate={setSelectedTemplateId}
                previewTitle={title}
                previewPrice={mrp}
                previewDiscountPrice={sellingPrice}
                previewCta={
                  ctaText ||
                  userProfile?.defaultCta?.text ||
                  (isHi ? "व्हाट्सएप पर ऑर्डर करें" : "Order Now via WhatsApp")
                }
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={() => setStep(1)} className="rounded-xl">
              {isHi ? "← वापस फ़ोटो पर" : "← Back to Photos"}
            </Button>
            <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
              <Button
                size="lg"
                onClick={handleStartGeneration}
                className="h-12 font-bold gap-2 px-8 rounded-xl shadow-md transition-all active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {isHi ? `जेनरेट करें · ${creditsNeeded} क्रेडिट` : `Generate · ${creditsNeeded} credits`}
              </Button>
              <span className="text-center text-xs text-muted-foreground sm:text-right">
                {balance >= creditsNeeded
                  ? isHi
                    ? `इसके बाद बचेंगे: ${balance - creditsNeeded} क्रेडिट`
                    : `Balance after: ${balance - creditsNeeded} credits`
                  : isHi
                    ? `आपके पास ${balance} क्रेडिट हैं — ${creditsNeeded - balance} और चाहिए`
                    : `You have ${balance} credits — ${creditsNeeded - balance} more needed`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 3: GENERATING (SSE & Polling) ================= */}
      {step === 3 && (
        <div className="space-y-8 max-w-4xl mx-auto py-8">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary motion-safe:animate-pulse">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-serif font-black text-foreground">
              {isHi ? "AI स्टूडियो आपका कैटलॉग तैयार कर रहा है" : "AI Studio is Crafting Your Catalog"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              {isHi
                ? "आपकी फ़ोटो से बैकग्राउंड हटाया जा रहा है, स्टूडियो लाइटिंग दी जा रही है और लिस्टिंग टेक्स्ट लिखा जा रहा है।"
                : "We're cleaning up the background, adding studio lighting and writing your listing text."}
            </p>
            {imageGenStatus !== "failed" && (
              <div className="mx-auto max-w-md rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-foreground space-y-1">
                <p className="font-semibold">
                  {isHi ? "आमतौर पर 1–3 मिनट लगते हैं।" : "Usually takes 1–3 minutes."}
                </p>
                <p className="text-muted-foreground">
                  {isHi ? (
                    <>
                      आप यह पेज छोड़ सकते हैं — काम चलता रहेगा और तैयार होने पर यह{" "}
                      <Link href="/app/history" className="font-semibold text-primary underline underline-offset-2">
                        मेरे उत्पाद
                      </Link>{" "}
                      में दिखेगा।
                    </>
                  ) : (
                    <>
                      You can leave this page — we&apos;ll keep working, and it will appear in{" "}
                      <Link href="/app/history" className="font-semibold text-primary underline underline-offset-2">
                        My Products
                      </Link>
                      .
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Real-time Streaming Copy Preview */}
            <Card className="border-border/60 bg-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm text-foreground">
                    {isHi ? "लिस्टिंग कॉपी (लाइव)" : "Listing Copy (Streaming)"}
                  </span>
                </div>
                {imageGenStatus !== "failed" && (
                  <Badge variant="outline" className="text-xs text-success border-success/30 animate-pulse">
                    {isHi ? "लाइव" : "Live"}
                  </Badge>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-muted-foreground block text-xs uppercase">
                    {isHi ? "टाइटल" : "Title"}
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {streamedText?.seoTitle ||
                      (imageGenStatus === "failed"
                        ? isHi ? "जनरेट नहीं हुआ" : "Not generated"
                        : title || (isHi ? "एसईओ टाइटल जनरेट हो रहा है..." : "Generating SEO Title..."))}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-muted-foreground block text-xs uppercase">
                    {isHi ? "मुख्य फ़ीचर्स" : "Features"}
                  </span>
                  <ul className="space-y-1 text-muted-foreground mt-1">
                    {streamedText?.keyFeatures?.map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    )) || (
                      <li>
                        {imageGenStatus === "failed"
                          ? isHi ? "जनरेट नहीं हुआ" : "Not generated"
                          : isHi ? "प्रोडक्ट को समझा जा रहा है..." : "Understanding your product..."}
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>

            {/* Right: Studio Photo Generation Steps */}
            <GenerationProgressCard
              isHi={isHi}
              status={imageGenStatus}
              info={genInfo}
              isRetrying={retryMutation.isPending}
              onRetry={handleRetryGeneration}
              onEditDetails={handleEditDetails}
            />
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
                <Badge className="bg-success text-success-foreground font-bold text-xs">
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
                className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-md rounded-xl text-xs h-9"
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
              <RotateCw className="h-5 w-5 text-primary" />
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
              {/* Preset prompts: a blank box is intimidating. One tap fills a
                  common edit so users discover what re-editing can do. */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(isHi
                  ? [
                      "प्योर व्हाइट बैकग्राउंड",
                      "लाइटिंग ब्राइट करें",
                      "सॉफ्ट पिंक बैकग्राउंड",
                      "लक्ज़री स्टूडियो लुक",
                      "फेस्टिव दिवाली थीम",
                    ]
                  : [
                      "Pure white background",
                      "Brighten the lighting",
                      "Soft pink background",
                      "Luxury studio look",
                      "Festive Diwali theme",
                    ]
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReEditPrompt(preset)}
                    className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {isHi
                ? "AI आपके निर्देश के अनुसार फ़ोटो बदलेगा। नई फ़ोटो इस वर्ज़न की जगह ले लेगी।"
                : "AI will edit the photo following your instructions. The new photo will replace this version."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReEditTarget(null)}>
              {isHi ? "रद्द करें" : "Cancel"}
            </Button>
            <Button
              onClick={handleExecuteReEdit}
              disabled={isReEditing || !reEditPrompt.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              {isReEditing ? <Loader2 className="h-4 w-4 animate-spin" /> : isHi ? "पुनः जनरेट करें (1 क्रेडिट)" : "Regenerate (1 Credit)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
