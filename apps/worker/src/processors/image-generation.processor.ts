import { Job } from "bullmq";
import { logger } from "@repo/logger";
import { ListingObject, User } from "@repo/database";
import {
  fetchBufferFromR2,
  uploadBufferToR2,
  optimizeForAi,
  generateThumbnail,
  analyzeProductPhotos,
  generateStudioImages,
  generateListingText,
  renderSocialCards,
  refundCredits,
  captureServerException,
  IMAGE_GENERATION_MAX_ATTEMPTS,
  DEFAULT_TEMPLATE_ID,
} from "@repo/services";

type GenerationStage = "preparing" | "enhancing_prompt" | "rendering_images" | "rendering_cards";

// Cheap progress marker so the UI can show which phase is running (or which one failed)
async function setStage(listingObjectId: string, stage: GenerationStage) {
  try {
    await ListingObject.updateOne({ _id: listingObjectId }, { $set: { generationStage: stage } });
  } catch (err) {
    logger.warn(`Could not record generation stage "${stage}" for listing ${listingObjectId}`, { err });
  }
}

export async function processImageGeneration(job: Job<{ listingObjectId: string }>) {
  const { listingObjectId } = job.data;
  logger.info(`Starting image and SEO text generation for listing: ${listingObjectId} (Attempt ${job.attemptsMade + 1})`);

  const listing = await ListingObject.findById(listingObjectId);
  if (!listing) {
    throw new Error(`Listing object not found: ${listingObjectId}`);
  }

  // Update status to processing
  await ListingObject.updateOne(
    { _id: listingObjectId },
    { $set: { status: "processing", textStatus: "streaming", generationStage: "preparing" } }
  );

  try {
    // 1. Fetch original images from R2
    if (!listing.originalImages || listing.originalImages.length === 0) {
      throw new Error("No original images found on listing object");
    }

    const originalBuffers: Buffer[] = [];
    for (const original of listing.originalImages) {
      try {
        const buf = await fetchBufferFromR2(original.s3Key);
        originalBuffers.push(buf);
      } catch (err) {
        logger.error(`Failed to fetch original image from R2: ${original.s3Key}`, { err });
      }
    }

    if (originalBuffers.length === 0) {
      throw new Error("Failed to load any original image buffers from storage");
    }

    // 2. Optimize images for AI
    const optimizedBuffers = await Promise.all(
      originalBuffers.map((b) => optimizeForAi(b))
    );

    // 3. Photo analysis with OpenAI Vision: scene prompt, product inventory, product boxes
    await setStage(listingObjectId, "enhancing_prompt");
    logger.info(`Analyzing product photos for ${listing.userTitle}...`);
    const analysis = await analyzeProductPhotos({
      imageBuffers: optimizedBuffers,
      userTitle: listing.userTitle,
      userDescription: listing.userDescription,
      userPrompt: listing.userPrompt,
    });
    const enhancedPrompt = analysis.scenePrompt;
    const keepWear = !!listing.keepWear;
    const qualityMode = listing.qualityMode === "pro" ? "pro" : "standard";
    logger.info(`Enhanced prompt generated: "${enhancedPrompt.slice(0, 100)}..."`);

    // 4. Generate Studio Images with Gemini AND SEO Deliverables with OpenAI concurrently
    await setStage(listingObjectId, "rendering_images");
    const imageCount =
      listing.type === "listing_product"
        ? 2 // Quick Generate: 2 studio variations
        : Math.min(listing.originalImages.length * 2, 6); // Kit: 2 variations per photo, max 6

    logger.info(`Generating ${imageCount} studio images with Gemini and SEO listing copy with OpenAI...`);
    const user = await User.findById(listing.userId);

    const [generatedOutputs, generatedText] = await Promise.all([
      generateStudioImages({
        originalImages: optimizedBuffers,
        prompt: enhancedPrompt,
        count: imageCount,
        multiAngle: listing.type === "listing_kit",
        productInventory: analysis.inventory,
        productBoxes: analysis.productBoxes,
        keepWear,
        qualityMode,
      }),
      generateListingText({
        userTitle: listing.userTitle || "Product",
        userDescription: listing.userDescription,
        userPrompt: listing.userPrompt,
        price: listing.price,
        discountPrice: listing.discountPrice,
        sizes: listing.sizes,
        variants: listing.variants,
        ctaText: listing.ctaText || user?.defaultCta?.text,
        storeName: user?.storeName,
        whatsappNumber: user?.whatsappNumber,
        instagramHandle: user?.instagramHandle,
        originalImageUrls: listing.originalImages.map((img) => img.url),
      }),
    ]);
    logger.info(`OpenAI generated SEO Title: "${generatedText.seoTitle}"`);

    // 5. Upload generated images & thumbnails to R2
    const generatedImagesDocs = [];
    for (let i = 0; i < generatedOutputs.length; i++) {
      const output = generatedOutputs[i]!;
      const s3Key = `generated/${listing._id}/studio_${i + 1}_${Date.now()}.jpg`;
      const thumbKey = `generated/${listing._id}/thumb_studio_${i + 1}_${Date.now()}.webp`;

      const [imgUpload, thumbBuffer] = await Promise.all([
        uploadBufferToR2(s3Key, output.buffer, "image/jpeg"),
        generateThumbnail(output.buffer, 360, 360),
      ]);

      const thumbUpload = await uploadBufferToR2(thumbKey, thumbBuffer, "image/webp");

      generatedImagesDocs.push({
        s3Key: imgUpload.s3Key,
        url: imgUpload.publicUrl,
        thumbnailUrl: thumbUpload.publicUrl,
        variationType: output.variationType,
        promptUsed: output.promptUsed,
        interactionId: output.interactionId,
        ...(output.fidelityIssues?.length ? { fidelityIssues: output.fidelityIssues } : {}),
        fidelityStatus: output.fidelityStatus,
        attempts: output.attempts,
        isLatest: true,
        createdAt: new Date(),
      });
    }

    // 6. Generate Social Cards
    await setStage(listingObjectId, "rendering_cards");
    // The pure-white-background shot gives the cleanest product cutout on cards
    const primaryImgBuffer =
      generatedOutputs.find((o) => o.variationType === "studio_white")?.buffer ||
      generatedOutputs[0]?.buffer ||
      optimizedBuffers[0]!;
    const templateId = (listing as any).templateId || DEFAULT_TEMPLATE_ID;
    // Cards are a bonus on top of the paid studio images: if they fail, finish the listing without
    // them (the seller can regenerate cards later) instead of failing and re-paying for Gemini.
    let cardFields: Record<string, unknown> = {};
    try {
      const renderedCards = await renderSocialCards({
        productImage: primaryImgBuffer,
        productTitle: listing.userTitle || "Product",
        price: listing.price,
        discountPrice: listing.discountPrice,
        ctaText: listing.ctaText || user?.defaultCta?.text,
        templateId,
        sellerInfo: {
          storeName: user?.storeName,
          whatsappNumber: user?.whatsappNumber,
          instagramHandle: user?.instagramHandle,
        },
        language: user?.cardSettings?.language ?? "en",
        trustBadges: {
          cod: user?.cardSettings?.cod === true,
          freeDelivery: user?.cardSettings?.freeDelivery === true,
          easyReturns: user?.cardSettings?.easyReturns === true,
          madeInIndia: user?.cardSettings?.madeInIndia === true,
        },
      });

      const waKey = `cards/${listing._id}/wa_${Date.now()}.jpg`;
      const igPostKey = `cards/${listing._id}/ig_post_${Date.now()}.jpg`;
      const igStoryKey = `cards/${listing._id}/ig_story_${Date.now()}.jpg`;

      const [waUpload, igPostUpload, igStoryUpload] = await Promise.all([
        uploadBufferToR2(waKey, renderedCards.whatsappCard, "image/jpeg"),
        uploadBufferToR2(igPostKey, renderedCards.instagramPost, "image/jpeg"),
        uploadBufferToR2(igStoryKey, renderedCards.instagramStory, "image/jpeg"),
      ]);
      const card = (upload: { s3Key: string; publicUrl: string }) => ({
        s3Key: upload.s3Key,
        url: upload.publicUrl,
        templateId,
        generatedAt: new Date(),
      });
      cardFields = { whatsappCard: card(waUpload), instagramPost: card(igPostUpload), instagramStory: card(igStoryUpload) };
    } catch (cardErr) {
      logger.error(`Card rendering failed for listing ${listingObjectId}; completing without cards`, { cardErr });
    }

    // 7. Update ListingObject to completed with BOTH images and SEO text deliverables
    await ListingObject.updateOne(
      { _id: listing._id },
      {
        $set: {
          status: "completed",
          generationStage: "done",
          textStatus: "completed",
          aiGeneratedText: generatedText,
          enhancedPrompt,
          productInventory: analysis.inventory,
          generatedImages: generatedImagesDocs,
          ...cardFields,
        },
      }
    );

    logger.info(`Listing ${listingObjectId} generation with images and text completed successfully!`);
  } catch (error: any) {
    logger.error(`Error in image generation job for listing ${listingObjectId}:`, {
      message: error?.message || String(error),
      stack: error?.stack,
    });
    captureServerException(error, {
      job: "image-generation",
      listingObjectId,
      attempt: job.attemptsMade + 1,
    });
    await handleJobFailure(listingObjectId, error, job);
    throw error;
  }
}

async function handleJobFailure(listingObjectId: string, error: any, job: Job) {
  const retryCount = (job.attemptsMade || 0) + 1;
  const maxRetries = job.opts.attempts || IMAGE_GENERATION_MAX_ATTEMPTS;
  const errorMessage = error.message || "Image generation failed";

  if (retryCount < maxRetries) {
    // More attempts coming: keep the listing in the queue
    await ListingObject.updateOne(
      { _id: listingObjectId },
      { $set: { status: "queued", errorMessage, retryCount } }
    );
    return;
  }

  // Final attempt. Refund FIRST, then mark the listing failed, so the UI never
  // sees "failed" before the refund exists.
  //
  // We "claim" the refund atomically BEFORE issuing it: findOneAndUpdate only
  // matches when creditsRefunded is still false and flips it to true in the same
  // operation. MongoDB guarantees that update is atomic, so if two failed
  // attempts race here, exactly one gets a non-null `claimed` and performs the
  // refund; the other sees null and does nothing. This prevents double refunds.
  try {
    const claimed = await ListingObject.findOneAndUpdate(
      { _id: listingObjectId, creditsRefunded: false, creditsCharged: { $gt: 0 } },
      { $set: { creditsRefunded: true } },
      { new: true }
    );

    if (claimed) {
      try {
        await refundCredits({
          userId: claimed.userId,
          amount: claimed.creditsCharged,
          description: `Automatic refund for failed generation of ${claimed.userTitle || "listing"}`,
          referenceId: String(claimed._id),
          referenceType: "listing_object",
        });
        logger.info(`Refunded ${claimed.creditsCharged} credits to user ${claimed.userId}`);
      } catch (refundErr) {
        // The refund itself failed — release the claim so it can be retried
        // later (e.g. by a sweeper) instead of being silently lost.
        await ListingObject.updateOne(
          { _id: listingObjectId },
          { $set: { creditsRefunded: false } }
        );
        logger.error("Failed to refund credits after job failure:", { refundErr });
      }
    }
  } catch (claimErr) {
    logger.error("Could not claim refund after job failure:", { claimErr });
  }

  // Always mark failed; creditsRefunded stays false if the refund didn't happen
  await ListingObject.updateOne(
    { _id: listingObjectId },
    { $set: { status: "failed", errorMessage, retryCount } }
  );
}
