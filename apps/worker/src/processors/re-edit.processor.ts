import { Job } from "bullmq";
import { logger } from "@repo/logger";
import { ListingObject, User, Types } from "@repo/database";
import {
  fetchBufferFromR2,
  uploadBufferToR2,
  generateThumbnail,
  reEditStudioImage,
  renderSocialCards,
  refundCredits,
  RE_EDIT_CREDIT_COST,
} from "@repo/services";

export async function processReEdit(
  job: Job<{ listingObjectId: string; generatedImageId: string; newPrompt: string }>
) {
  const { listingObjectId, generatedImageId, newPrompt } = job.data;
  logger.info(`Starting re-edit job for image ${generatedImageId} on listing ${listingObjectId}`);

  const listing = await ListingObject.findById(listingObjectId);
  if (!listing) {
    throw new Error(`Listing object not found: ${listingObjectId}`);
  }

  const oldImage = listing.generatedImages.find(
    (img) => String(img._id) === generatedImageId
  );

  if (!oldImage) {
    throw new Error(`Generated image not found: ${generatedImageId}`);
  }

  // Mark re-edit as actively processing
  await ListingObject.updateOne(
    { _id: listingObjectId },
    {
      $set: {
        reEditStatus: {
          status: "processing",
          jobId: job.id,
          targetImageId: generatedImageId,
          updatedAt: new Date(),
        },
      },
    }
  );

  try {
    // 1. Fetch old image and original image buffer
    const oldBuffer = await fetchBufferFromR2(oldImage.s3Key);
    const origBuffers: Buffer[] = [];
    if (listing.originalImages[0]) {
      const orig = await fetchBufferFromR2(listing.originalImages[0].s3Key);
      origBuffers.push(orig);
    }

    // 2. Perform multi-turn re-edit with Gemini using interactionId
    logger.info(`Editing with Gemini using interactionId ${oldImage.interactionId}...`);
    const editOutput = await reEditStudioImage({
      originalImages: origBuffers,
      previousImage: oldBuffer,
      interactionId: oldImage.interactionId,
      newPrompt,
    });

    // 3. Upload new edited image and thumbnail to R2
    const newImageId = new Types.ObjectId();
    const s3Key = `generated/${listing._id}/reedit_${newImageId}_${Date.now()}.webp`;
    const thumbKey = `generated/${listing._id}/thumb_reedit_${newImageId}_${Date.now()}.webp`;

    const [imgUpload, thumbBuffer] = await Promise.all([
      uploadBufferToR2(s3Key, editOutput.buffer, "image/webp"),
      generateThumbnail(editOutput.buffer, 360, 360),
    ]);
    const thumbUpload = await uploadBufferToR2(thumbKey, thumbBuffer, "image/webp");

    // 4. Mark old image as replaced
    oldImage.isLatest = false;
    oldImage.replacedBy = newImageId;

    // 5. Append new image
    listing.generatedImages.push({
      _id: newImageId,
      s3Key: imgUpload.s3Key,
      url: imgUpload.publicUrl,
      thumbnailUrl: thumbUpload.publicUrl,
      variationType: editOutput.variationType,
      promptUsed: editOutput.promptUsed,
      interactionId: editOutput.interactionId,
      isLatest: true,
      createdAt: new Date(),
    } as any);

    // 6. Refresh social cards with new image
    const user = await User.findById(listing.userId);
    const templateId = (listing as any).templateId || "minimal-luxury";
    const renderedCards = await renderSocialCards({
      productImage: editOutput.buffer,
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

    listing.whatsappCard = {
      s3Key: waUpload.s3Key,
      url: waUpload.publicUrl,
      generatedAt: new Date(),
    };
    listing.instagramPost = {
      s3Key: igPostUpload.s3Key,
      url: igPostUpload.publicUrl,
      generatedAt: new Date(),
    };
    listing.instagramStory = {
      s3Key: igStoryUpload.s3Key,
      url: igStoryUpload.publicUrl,
      generatedAt: new Date(),
    };

    listing.reEditStatus = {
      status: "completed",
      jobId: job.id,
      targetImageId: generatedImageId,
      newImageId: String(newImageId),
      updatedAt: new Date(),
    };

    await listing.save();
    logger.info(`Re-edit for listing ${listingObjectId} completed successfully!`);
  } catch (error: any) {
    logger.error("Error during re-edit job execution:", {
      message: error?.message || String(error),
      stack: error?.stack,
    });

    const retryCount = (job.attemptsMade || 0) + 1;
    const maxRetries = job.opts.attempts || 1;

    // Persist failure status to listing document
    await ListingObject.updateOne(
      { _id: listingObjectId },
      {
        $set: {
          reEditStatus: {
            status: "failed",
            jobId: job.id,
            targetImageId: generatedImageId,
            errorMessage: error?.message || "Re-edit failed",
            updatedAt: new Date(),
          },
        },
      }
    );

    // Single refund guard: refund exactly once when attempts are exhausted
    if (retryCount >= maxRetries) {
      try {
        const refundReferenceId = `reedit_${listingObjectId}_${job.id}`;
        // Verify user hasn't already been refunded for this referenceId
        const targetUser = await User.findById(listing.userId);
        const alreadyRefunded = targetUser?.creditHistory?.some(
          (h) => h.referenceId === refundReferenceId
        );

        if (!alreadyRefunded) {
          await refundCredits({
            userId: listing.userId,
            amount: RE_EDIT_CREDIT_COST,
            description: `Refund for failed re-edit of ${listing.userTitle || "image"}`,
            referenceId: refundReferenceId,
            referenceType: "re_edit",
          });
          logger.info(`Refunded ${RE_EDIT_CREDIT_COST} credit for failed re-edit (Job ${job.id})`);
        } else {
          logger.warn(`Skipping duplicate refund for referenceId: ${refundReferenceId}`);
        }
      } catch (refundErr) {
        logger.error("Failed to refund credit after re-edit error:", { refundErr });
      }
    }

    throw error;
  }
}
