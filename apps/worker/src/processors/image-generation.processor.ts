import { Job } from "bullmq";
import { logger } from "@repo/logger";
import { ListingObject, User } from "@repo/database";
import {
  fetchBufferFromR2,
  uploadBufferToR2,
  optimizeForAi,
  generateThumbnail,
  enhancePromptWithVision,
  generateStudioImages,
  generateListingText,
  renderSocialCards,
  refundCredits,
  captureServerException,
} from "@repo/services";

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
    { $set: { status: "processing", textStatus: "streaming" } }
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

    // 3. Prompt Enhancement with OpenAI Vision
    logger.info(`Enhancing prompt for ${listing.userTitle}...`);
    const enhancedPrompt = await enhancePromptWithVision({
      imageBuffers: optimizedBuffers,
      userTitle: listing.userTitle,
      userDescription: listing.userDescription,
      userPrompt: listing.userPrompt,
    });
    logger.info(`Enhanced prompt generated: "${enhancedPrompt.slice(0, 100)}..."`);

    // 4. Generate Studio Images with Gemini AND SEO Deliverables with OpenAI concurrently
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
      const s3Key = `generated/${listing._id}/studio_${i + 1}_${Date.now()}.webp`;
      const thumbKey = `generated/${listing._id}/thumb_studio_${i + 1}_${Date.now()}.webp`;

      const [imgUpload, thumbBuffer] = await Promise.all([
        uploadBufferToR2(s3Key, output.buffer, "image/webp"),
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
        isLatest: true,
        createdAt: new Date(),
      });
    }

    // 6. Generate Social Cards
    const primaryImgBuffer = generatedOutputs[0]?.buffer || optimizedBuffers[0]!;
    const templateId = (listing as any).templateId || "minimal-luxury";
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
    });

    const waKey = `cards/${listing._id}/wa_${Date.now()}.webp`;
    const igPostKey = `cards/${listing._id}/ig_post_${Date.now()}.webp`;
    const igStoryKey = `cards/${listing._id}/ig_story_${Date.now()}.webp`;

    const [waUpload, igPostUpload, igStoryUpload] = await Promise.all([
      uploadBufferToR2(waKey, renderedCards.whatsappCard, "image/webp"),
      uploadBufferToR2(igPostKey, renderedCards.instagramPost, "image/webp"),
      uploadBufferToR2(igStoryKey, renderedCards.instagramStory, "image/webp"),
    ]);

    // 7. Update ListingObject to completed with BOTH images and SEO text deliverables
    await ListingObject.updateOne(
      { _id: listing._id },
      {
        $set: {
          status: "completed",
          textStatus: "completed",
          aiGeneratedText: generatedText,
          enhancedPrompt,
          generatedImages: generatedImagesDocs,
          whatsappCard: {
            s3Key: waUpload.s3Key,
            url: waUpload.publicUrl,
            templateId,
            generatedAt: new Date(),
          },
          instagramPost: {
            s3Key: igPostUpload.s3Key,
            url: igPostUpload.publicUrl,
            templateId,
            generatedAt: new Date(),
          },
          instagramStory: {
            s3Key: igStoryUpload.s3Key,
            url: igStoryUpload.publicUrl,
            templateId,
            generatedAt: new Date(),
          },
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
  const maxRetries = job.opts.attempts || 2;

  await ListingObject.updateOne(
    { _id: listingObjectId },
    {
      $set: {
        status: retryCount >= maxRetries ? "failed" : "queued",
        errorMessage: error.message || "Image generation failed",
        retryCount,
      },
    }
  );

  // If retries exhausted, automatically refund credits to user.
  //
  // We "claim" the refund atomically BEFORE issuing it: findOneAndUpdate only
  // matches when creditsRefunded is still false and flips it to true in the same
  // operation. MongoDB guarantees that update is atomic, so if two failed
  // attempts race here, exactly one gets a non-null `claimed` and performs the
  // refund; the other sees null and does nothing. This prevents double refunds.
  if (retryCount >= maxRetries) {
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
  }
}
