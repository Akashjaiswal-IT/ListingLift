import { Job } from "bullmq";
import { logger } from "@repo/logger";
import { ListingObject, User, Types, runInTransaction } from "@repo/database";
import {
  fetchBufferFromR2,
  uploadBufferToR2,
  generateThumbnail,
  reEditStudioImage,
  renderSocialCards,
  RE_EDIT_CREDIT_COST,
  deleteObjectFromR2,
  DEFAULT_TEMPLATE_ID,
  refundReEditCharge,
} from "@repo/services";

interface ReEditJobData {
  listingObjectId: string;
  generatedImageId: string;
  newPrompt: string;
  /** Id of this re-edit's credit charge (set by reEditImage); absent on jobs queued before it existed. */
  chargeId?: string;
}

interface CardSlot {
  s3Key: string;
  url: string;
  templateId: string;
  generatedAt: Date;
}

export async function processReEdit(job: Job<ReEditJobData>) {
  const { listingObjectId, generatedImageId, newPrompt, chargeId } = job.data;
  logger.info(`Starting re-edit job for image ${generatedImageId} on listing ${listingObjectId}`);

  const listing = await ListingObject.findById(listingObjectId);
  if (!listing) {
    // Listings can't be deleted while a re-edit runs, so this is an admin/account deletion.
    logger.warn(`Re-edit skipped: listing ${listingObjectId} no longer exists`);
    return;
  }

  // Mark re-edit as actively processing. Dotted fields keep this charge's chargeId intact.
  await ListingObject.updateOne(
    { _id: listingObjectId },
    {
      $set: {
        "reEditStatus.status": "processing",
        "reEditStatus.jobId": job.id,
        "reEditStatus.targetImageId": generatedImageId,
        "reEditStatus.updatedAt": new Date(),
      },
    }
  );

  try {
    const oldImage = listing.generatedImages.find((img) => String(img._id) === generatedImageId);
    if (!oldImage) {
      throw new Error(`Generated image not found: ${generatedImageId}`);
    }

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
      keepWear: !!listing.keepWear,
      variationType: oldImage.variationType,
    });

    // 3. Upload new edited image and thumbnail to R2
    const newImageId = new Types.ObjectId();
    const s3Key = `generated/${listing._id}/reedit_${newImageId}_${Date.now()}.jpg`;
    const thumbKey = `generated/${listing._id}/thumb_reedit_${newImageId}_${Date.now()}.webp`;

    const [imgUpload, thumbBuffer] = await Promise.all([
      uploadBufferToR2(s3Key, editOutput.buffer, "image/jpeg"),
      generateThumbnail(editOutput.buffer, 360, 360),
    ]);
    const thumbUpload = await uploadBufferToR2(thumbKey, thumbBuffer, "image/webp");

    // 4. Refresh social cards with the new image. The edited image is what the seller paid for:
    // if the card refresh fails, keep the old cards and still complete the re-edit.
    const user = await User.findById(listing.userId);
    const templateId = (listing as any).templateId || DEFAULT_TEMPLATE_ID;
    let cards: { whatsappCard: CardSlot; instagramPost: CardSlot; instagramStory: CardSlot } | null = null;
    try {
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
      const slot = (u: { s3Key: string; publicUrl: string }): CardSlot => ({
        s3Key: u.s3Key,
        url: u.publicUrl,
        templateId,
        generatedAt: new Date(),
      });
      cards = { whatsappCard: slot(waUpload), instagramPost: slot(igPostUpload), instagramStory: slot(igStoryUpload) };
    } catch (cardErr) {
      logger.error(`Card refresh failed on re-edit for listing ${listingObjectId}; keeping previous cards`, { cardErr });
    }

    // 5. Save atomically against the CURRENT listing (never a copy loaded minutes ago, which could
    // overwrite or conflict with other changes). One transaction: mark the old image replaced,
    // set the cards and status, and append the new image. MongoDB can't $set an array element and
    // $push to the same array in one update, hence two updates inside the transaction.
    const oldCardKeys = await runInTransaction(async (session) => {
      const current = await ListingObject.findById(listingObjectId)
        .select("whatsappCard instagramPost instagramStory")
        .session(session);
      const replacedKeys = cards
        ? ([current?.whatsappCard?.s3Key, current?.instagramPost?.s3Key, current?.instagramStory?.s3Key].filter(
            Boolean
          ) as string[])
        : [];

      const marked = await ListingObject.updateOne(
        { _id: listingObjectId, "generatedImages._id": oldImage._id },
        {
          $set: {
            "generatedImages.$.isLatest": false,
            "generatedImages.$.replacedBy": newImageId,
            ...(cards ?? {}),
            reEditStatus: {
              status: "completed",
              jobId: job.id,
              targetImageId: generatedImageId,
              newImageId: String(newImageId),
              ...(chargeId ? { chargeId } : {}),
              updatedAt: new Date(),
            },
          },
        },
        { session: session ?? undefined }
      );
      if (marked.matchedCount === 0) {
        throw new Error("The listing or the image being edited no longer exists");
      }

      await ListingObject.updateOne(
        { _id: listingObjectId },
        {
          $push: {
            generatedImages: {
              _id: newImageId,
              s3Key: imgUpload.s3Key,
              url: imgUpload.publicUrl,
              thumbnailUrl: thumbUpload.publicUrl,
              variationType: editOutput.variationType,
              promptUsed: editOutput.promptUsed,
              interactionId: editOutput.interactionId,
              isLatest: true,
              createdAt: new Date(),
            },
          },
        },
        { session: session ?? undefined }
      );
      return replacedKeys;
    });

    // Clean up previous cards in storage now that new ones are saved
    for (const oldKey of oldCardKeys) {
      try {
        await deleteObjectFromR2(oldKey);
      } catch (err) {
        logger.warn(`Failed to clean up old card on re-edit: ${oldKey}`, err);
      }
    }

    logger.info(`Re-edit for listing ${listingObjectId} completed successfully!`);
  } catch (error: any) {
    logger.error("Error during re-edit job execution:", {
      message: error?.message || String(error),
      stack: error?.stack,
    });

    const retryCount = (job.attemptsMade || 0) + 1;
    const maxRetries = job.opts.attempts || 1;

    // Refund exactly once when attempts are exhausted: one transaction writes the refund (unique
    // key per charge), the credits and reEditStatus "failed". If the refund itself errors, the
    // status stays "processing" so the reconciler retries the refund later.
    if (retryCount >= maxRetries) {
      try {
        const res = await refundReEditCharge({
          listingObjectId,
          userId: listing.userId,
          credits: RE_EDIT_CREDIT_COST,
          chargeId,
          legacyJobId: job.id,
          errorMessage: "Re-edit generation failed. Your 1 credit has been refunded.",
          description: `Refund for failed re-edit of ${listing.userTitle || "image"}`,
        });
        if (res.refunded) {
          logger.info(`Refunded ${RE_EDIT_CREDIT_COST} credit for failed re-edit (Job ${job.id})`);
        } else {
          logger.warn(`Skipping duplicate re-edit refund (Job ${job.id})`);
          await ListingObject.updateOne(
            { _id: listingObjectId, ...(chargeId ? { "reEditStatus.chargeId": chargeId } : {}) },
            {
              $set: {
                "reEditStatus.status": "failed",
                "reEditStatus.errorMessage": "Re-edit generation failed. Your 1 credit has been refunded.",
                "reEditStatus.updatedAt": new Date(),
              },
            }
          );
        }
      } catch (refundErr) {
        logger.error("Failed to refund credit after re-edit error:", { refundErr });
      }
    }

    throw error;
  }
}
