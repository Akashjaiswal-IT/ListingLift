import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { ListingObject } from "@repo/database";
import {
  calculateGenerationCredits,
  RE_EDIT_CREDIT_COST,
  enqueueImageGeneration,
  enqueueReEdit,
  checkRateLimit,
  generateListingText,
  IMAGE_GENERATION_MAX_ATTEMPTS,
  DEFAULT_TEMPLATE_ID,
  chargeAndClaimListing,
  chargeAndClaimReEdit,
  refundListingCharge,
  refundReEditCharge,
  isQueueOverloaded,
  InsufficientCreditsError,
  ListingBusyError,
} from "@repo/services";

export const generateRouter = router({
  startGeneration: protectedProcedure
    .input(
      z.object({
        listingObjectId: z.string(),
        userTitle: z.string().min(1, "Product title is required"),
        userDescription: z.string().optional(),
        userPrompt: z.string().optional(),
        price: z.number().positive().optional(),
        discountPrice: z.number().positive().optional(),
        sizes: z.array(z.string()).optional(),
        variants: z.array(z.string()).optional(),
        ctaText: z.string().optional(),
        templateId: z.string().optional().default(DEFAULT_TEMPLATE_ID),
        keepWear: z.boolean().optional().default(false),
        qualityMode: z.enum(["standard", "pro"]).optional().default("standard"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // price = MRP, discountPrice = selling price. Reject before anything is charged.
      if (input.price !== undefined && input.discountPrice !== undefined && input.discountPrice > input.price) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selling price can't be higher than MRP",
        });
      }

      const rateLimit = await checkRateLimit(String(ctx.user._id), "generate");
      if (!rateLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Generation rate limit reached (${rateLimit.limit}/hour). Please wait ${Math.ceil(rateLimit.resetInSeconds / 60)} minutes.`,
        });
      }

      const listing = await ListingObject.findOne({
        _id: input.listingObjectId,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      if (listing.status !== "uploaded" && listing.status !== "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Generation is already in progress or has completed",
        });
      }

      if (!listing.originalImages.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please upload at least one image before generating",
        });
      }

      if (await isQueueOverloaded("generation")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "We're very busy right now. Please try again in a few minutes — you have not been charged.",
        });
      }

      // Calculate credit cost
      const photoCount = listing.originalImages.length;
      const creditsNeeded = calculateGenerationCredits(listing.type, photoCount, input.qualityMode);

      // ONE transaction: claim the listing (only from "uploaded", or a "failed" run whose charge was
      // already refunded) + store the inputs + deduct credits + ledger row. A double tap, a second
      // tab or a retried request can't charge twice: only one claim matches. The photo count is part
      // of the claim so the price charged always matches the photos generated.
      let newBalance: number | undefined;
      try {
        const res = await chargeAndClaimListing({
          listingObjectId: listing._id,
          userId: ctx.user._id,
          claimFilter: {
            originalImages: { $size: photoCount },
            $or: [
              { status: "uploaded" },
              { status: "failed", creditsRefunded: true },
              { status: "failed", creditsCharged: { $in: [0, null] } },
            ],
          },
          set: {
            userTitle: input.userTitle,
            userDescription: input.userDescription,
            userPrompt: input.userPrompt,
            price: input.price,
            discountPrice: input.discountPrice,
            sizes: input.sizes,
            variants: input.variants,
            ctaText: input.ctaText?.trim() || undefined,
            templateId: input.templateId,
            keepWear: input.keepWear,
            qualityMode: input.qualityMode,
            textStatus: "pending",
            retryCount: 0,
          },
          credits: creditsNeeded,
          description: `Generation for ${listing.type === "listing_product" ? "Quick Product" : "Listing Kit"}: ${input.userTitle}${input.qualityMode === "pro" ? " (Pro quality)" : ""}`,
        });
        newBalance = res.newBalance;
      } catch (err: any) {
        if (err instanceof InsufficientCreditsError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: err.message || "Insufficient credits. Please top up your account.",
          });
        }
        if (err instanceof ListingBusyError) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              listing.status === "failed"
                ? "This generation can be retried for free — use Retry instead."
                : err.message,
          });
        }
        throw err;
      }

      // Queue the job only AFTER the charge and claim committed. If queuing fails, refund in one
      // transaction (compensating action) so the seller is never billed for work that won't run.
      // In development Redis is often offline; the listing then just waits in "queued".
      let jobId: string | undefined;
      try {
        jobId = await enqueueImageGeneration(String(listing._id));
      } catch (err) {
        if (process.env.NODE_ENV === "production") {
          await refundListingCharge({
            listingObjectId: listing._id,
            reason: "not_queued",
            errorMessage: "Could not start generation. Your credits were refunded.",
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not start generation right now. Your credits were refunded — please try again.",
          });
        }
        console.warn("BullMQ image enqueue warning (Redis may be offline in dev):", err);
      }

      // Only the job id is written here (never a stale copy of the listing), so it can't
      // overwrite anything the worker has already recorded.
      if (jobId) {
        await ListingObject.updateOne({ _id: listing._id }, { $set: { bullmqJobId: jobId } });
      }

      return {
        success: true,
        listingObjectId: String(listing._id),
        creditsCharged: creditsNeeded,
        newBalance,
        status: "queued" as const,
        textStreamUrl: `/api/generate/${listing._id}/text-stream`,
      };
    }),

  getStatus: protectedProcedure
    .input(z.object({ listingObjectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const listing = await ListingObject.findOne({
        _id: input.listingObjectId,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      return {
        status: listing.status,
        textStatus: listing.textStatus,
        generatedImagesCount: listing.generatedImages?.length || 0,
        hasWhatsappCard: !!listing.whatsappCard?.url,
        hasInstagramPost: !!listing.instagramPost?.url,
        hasInstagramStory: !!listing.instagramStory?.url,
        aiGeneratedText: listing.aiGeneratedText,
        errorMessage: listing.errorMessage,
        retryCount: listing.retryCount,
        generationStage: listing.generationStage,
        creditsRefunded: listing.creditsRefunded,
        creditsCharged: listing.creditsCharged,
        maxAttempts: IMAGE_GENERATION_MAX_ATTEMPTS,
      };
    }),

  getResult: protectedProcedure
    .input(z.object({ listingObjectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const listing = await ListingObject.findOne({
        _id: input.listingObjectId,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      // Self-heal: If completed listing is missing aiGeneratedText, generate it on the fly with OpenAI!
      if (listing.status === "completed" && (!listing.aiGeneratedText || !listing.aiGeneratedText.seoTitle)) {
        try {
          const generatedText = await generateListingText({
            userTitle: listing.userTitle || "Product",
            userDescription: listing.userDescription,
            userPrompt: listing.userPrompt,
            price: listing.price,
            discountPrice: listing.discountPrice,
            sizes: listing.sizes,
            variants: listing.variants,
            ctaText: listing.ctaText,
            storeName: ctx.user.storeName,
            whatsappNumber: ctx.user.whatsappNumber,
            instagramHandle: ctx.user.instagramHandle,
            originalImageUrls: listing.originalImages?.map((img) => img.url) || [],
            language: ctx.user.cardSettings?.language === "hi" ? "hi" : "en",
            productInventory: listing.productInventory,
            sellerFacts: {
              cod: ctx.user.cardSettings?.cod === true,
              freeDelivery: ctx.user.cardSettings?.freeDelivery === true,
              easyReturns: ctx.user.cardSettings?.easyReturns === true,
              madeInIndia: ctx.user.cardSettings?.madeInIndia === true,
            },
          });

          await ListingObject.updateOne(
            { _id: listing._id },
            { $set: { aiGeneratedText: generatedText, textStatus: "completed" } }
          );
          listing.aiGeneratedText = generatedText as any;
          listing.textStatus = "completed";
        } catch {
          // Non-blocking fallback
        }
      }

      return listing;
    }),

  reEditImage: protectedProcedure
    .input(
      z.object({
        listingObjectId: z.string(),
        generatedImageId: z.string(),
        newPrompt: z.string().min(1, "Please provide instructions for re-editing"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimit = await checkRateLimit(String(ctx.user._id), "re_edit");
      if (!rateLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Re-edit rate limit reached (${rateLimit.limit}/hour). Please wait ${Math.ceil(rateLimit.resetInSeconds / 60)} minutes.`,
        });
      }

      const listing = await ListingObject.findOne({
        _id: input.listingObjectId,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      const targetImage = listing.generatedImages.find(
        (img) => String(img._id) === input.generatedImageId
      );

      if (!targetImage) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Generated image not found" });
      }

      if (await isQueueOverloaded("re_edit")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "We're very busy right now. Please try again in a few minutes — you have not been charged.",
        });
      }

      // ONE transaction: claim the listing's re-edit slot (only if no re-edit is running) +
      // deduct 1 credit + ledger row. A second tap is rejected instead of charged twice.
      let newBalance: number;
      let chargeId: string;
      try {
        const res = await chargeAndClaimReEdit({
          listingObjectId: listing._id,
          userId: ctx.user._id,
          generatedImageId: input.generatedImageId,
          credits: RE_EDIT_CREDIT_COST,
          description: `Photo re-edit: ${input.newPrompt}`,
        });
        newBalance = res.newBalance;
        chargeId = res.chargeId;
      } catch (err: any) {
        if (err instanceof InsufficientCreditsError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: err.message || "Insufficient credits for re-editing. (1 credit required)",
          });
        }
        if (err instanceof ListingBusyError) {
          throw new TRPCError({ code: "CONFLICT", message: err.message });
        }
        throw err;
      }

      // Queue only after the charge committed; refund (one transaction) if queuing fails.
      let jobId: string | undefined;
      try {
        jobId = await enqueueReEdit({
          listingObjectId: String(listing._id),
          generatedImageId: input.generatedImageId,
          newPrompt: input.newPrompt,
          chargeId,
        });
      } catch (err) {
        // Dev (no Redis) stays graceful.
        if (process.env.NODE_ENV === "production") {
          await refundReEditCharge({
            listingObjectId: listing._id,
            userId: ctx.user._id,
            credits: RE_EDIT_CREDIT_COST,
            chargeId,
            errorMessage: "Could not start the re-edit. Your credit was refunded.",
            description: "Automatic refund — could not queue photo re-edit",
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not start the re-edit right now. Your credit was refunded — please try again.",
          });
        }
        console.warn("Re-edit enqueue warning (Redis offline in dev):", err);
      }

      // Record the job id on THIS charge only (never a stale save of the whole listing).
      if (jobId) {
        await ListingObject.updateOne(
          { _id: listing._id, "reEditStatus.chargeId": chargeId },
          { $set: { "reEditStatus.jobId": jobId } }
        );
      }

      return {
        success: true,
        jobId,
        creditsRemaining: newBalance,
      };
    }),

  // Undo the most recent re-edit of a studio image: flip the current (latest)
  // version back to the one it replaced. Purely a version swap in the database —
  // no credits are charged or refunded (the edit work was already done), and the
  // superseded version is kept hidden in history rather than deleted.
  undoReEdit: protectedProcedure
    .input(
      z.object({
        listingObjectId: z.string(),
        generatedImageId: z.string(), // the CURRENT latest image to undo
      })
    )
    .mutation(async ({ ctx, input }) => {
      const listing = await ListingObject.findOne({
        _id: input.listingObjectId,
        userId: ctx.user._id,
      });
      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      const current = listing.generatedImages.find(
        (img) => String(img._id) === input.generatedImageId
      );
      if (!current || current.isLatest === false) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That image is not the current version.",
        });
      }

      // The previous version is whichever image points at the current one.
      const previous = listing.generatedImages.find(
        (img) => String(img.replacedBy) === input.generatedImageId
      );
      if (!previous) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There is no earlier version to undo to.",
        });
      }

      previous.isLatest = true;
      previous.replacedBy = undefined;
      current.isLatest = false;
      listing.markModified("generatedImages");
      await listing.save();

      return { success: true, restoredImageId: String(previous._id) };
    }),

  regenerateText: protectedProcedure
    .input(z.object({ listingObjectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ListingObject.findOne({
        _id: input.listingObjectId,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      const maxLimit = listing.type === "listing_product" ? 2 : 5;
      const currentCount = listing.seoRegenerateCount ?? 0;

      if (currentCount >= maxLimit) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `SEO copy regeneration limit reached (${maxLimit} max for ${
            listing.type === "listing_product" ? "Quick Product" : "Listing Kit"
          }).`,
        });
      }

      listing.textStatus = "pending";
      await listing.save();

      return {
        success: true,
        textStreamUrl: `/api/generate/${listing._id}/text-stream`,
      };
    }),

  retry: protectedProcedure
    .input(z.object({ listingObjectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ListingObject.findOne({
        _id: input.listingObjectId,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      if (listing.status !== "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only failed generations can be retried",
        });
      }

      // When a generation fails and exhausts its retries, the worker automatically refunds the
      // credits. Retrying a refunded failure charges again; a failure that was never refunded
      // (its credits are still held) retries for free. Either way the claim and any charge are ONE
      // transaction, and the claim re-checks that refund state, so two taps can't double-charge.
      const needsCharge = listing.creditsRefunded === true;
      const creditsNeeded = needsCharge
        ? calculateGenerationCredits(
            listing.type,
            listing.originalImages.length,
            listing.qualityMode === "pro" ? "pro" : "standard"
          )
        : 0;

      if (await isQueueOverloaded("generation")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "We're very busy right now. Please try again in a few minutes — you have not been charged.",
        });
      }

      try {
        await chargeAndClaimListing({
          listingObjectId: listing._id,
          userId: ctx.user._id,
          claimFilter: needsCharge
            ? { status: "failed", creditsRefunded: true, originalImages: { $size: listing.originalImages.length } }
            : { status: "failed", creditsRefunded: { $ne: true } },
          set: { retryCount: 0 },
          credits: creditsNeeded,
          description: `Retry generation: ${listing.userTitle || "listing"}`,
        });
      } catch (err: any) {
        if (err instanceof InsufficientCreditsError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: err.message || "Insufficient credits to retry. Please top up your account.",
          });
        }
        if (err instanceof ListingBusyError) {
          throw new TRPCError({ code: "CONFLICT", message: err.message });
        }
        throw err;
      }

      let jobId: string | undefined;
      try {
        jobId = await enqueueImageGeneration(String(listing._id));
      } catch (err) {
        // Could not re-queue: refund any re-charge (one transaction) and mark it failed again.
        if (creditsNeeded > 0) {
          await refundListingCharge({
            listingObjectId: listing._id,
            reason: "not_queued",
            errorMessage: "Could not restart generation. Any charge was refunded.",
          });
        } else {
          await ListingObject.updateOne({ _id: listing._id, status: "queued" }, { $set: { status: "failed" } });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not restart generation right now. Any charge was refunded — please try again.",
        });
      }
      await ListingObject.updateOne({ _id: listing._id }, { $set: { bullmqJobId: jobId } });

      return { success: true, status: "queued" as const, jobId };
    }),
});
