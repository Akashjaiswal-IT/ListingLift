import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { ListingObject } from "@repo/database";
import {
  calculateGenerationCredits,
  deductCredits,
  refundCredits,
  RE_EDIT_CREDIT_COST,
  enqueueImageGeneration,
  enqueueReEdit,
  checkRateLimit,
  generateListingText,
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
        templateId: z.string().optional().default("minimal-luxury"),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      // Calculate credit cost
      const creditsNeeded = calculateGenerationCredits(
        listing.type,
        listing.originalImages.length
      );

      // Deduct credits atomically
      let newBalance = ctx.user.creditBalance;
      try {
        const deductResult = await deductCredits({
          userId: ctx.user._id,
          amount: creditsNeeded,
          description: `Generation for ${listing.type === "listing_product" ? "Quick Product" : "Listing Kit"}: ${input.userTitle}`,
          referenceId: String(listing._id),
          referenceType: "listing_object",
        });
        newBalance = deductResult.newBalance;
      } catch (err: any) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: err.message || "Insufficient credits. Please top up your account.",
        });
      }

      // Enqueue BullMQ worker job for image & card generation.
      //
      // The credits were already deducted above. If the enqueue fails, nothing
      // will ever process this listing, so we must NOT leave the user charged
      // with a job stuck in "queued". This is a "compensating transaction":
      // when a later step of a multi-step operation fails, we undo the earlier
      // step (here, refund the credits) and surface a real error.
      //
      // In development Redis is often offline and we still want the rest of the
      // flow to be exercisable, so we preserve the old graceful behaviour there.
      let jobId: string | undefined;
      try {
        jobId = await enqueueImageGeneration(String(listing._id));
      } catch (err) {
        if (process.env.NODE_ENV === "production") {
          await refundCredits({
            userId: ctx.user._id,
            amount: creditsNeeded,
            description: `Automatic refund — could not queue generation for ${input.userTitle}`,
            referenceId: String(listing._id),
            referenceType: "listing_object",
          });
          listing.status = "failed";
          listing.errorMessage = "Could not start generation. Your credits were refunded.";
          listing.creditsRefunded = true;
          await listing.save();
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not start generation right now. Your credits were refunded — please try again.",
          });
        }
        console.warn("BullMQ image enqueue warning (Redis may be offline in dev):", err);
      }

      // Update listing document
      listing.userTitle = input.userTitle;
      listing.userDescription = input.userDescription;
      listing.userPrompt = input.userPrompt;
      listing.price = input.price;
      listing.discountPrice = input.discountPrice;
      listing.sizes = input.sizes;
      listing.variants = input.variants;
      listing.ctaText = input.ctaText;
      listing.templateId = input.templateId;
      listing.creditsCharged = creditsNeeded;
      listing.creditsRefunded = false;
      listing.status = "queued";
      listing.textStatus = "pending";
      if (jobId) listing.bullmqJobId = jobId;

      await listing.save();

      return {
        success: true,
        listingObjectId: String(listing._id),
        creditsCharged: creditsNeeded,
        newBalance,
        status: listing.status,
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

      // Deduct 1 credit for re-edit
      let newBalance = ctx.user.creditBalance;
      try {
        const deductResult = await deductCredits({
          userId: ctx.user._id,
          amount: RE_EDIT_CREDIT_COST,
          description: `Photo re-edit: ${input.newPrompt}`,
          referenceId: String(listing._id),
          referenceType: "re_edit",
        });
        newBalance = deductResult.newBalance;
      } catch (err: any) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: err.message || "Insufficient credits for re-editing. (1 credit required)",
        });
      }

      // Enqueue BullMQ re-edit job
      let jobId: string | undefined;
      try {
        jobId = await enqueueReEdit({
          listingObjectId: String(listing._id),
          generatedImageId: input.generatedImageId,
          newPrompt: input.newPrompt,
        });
      } catch (err) {
        // Same compensating-transaction guard as startGeneration: if we charged
        // for the re-edit but could not queue it, refund so the user is not
        // billed for work that will never run. Dev (no Redis) stays graceful.
        if (process.env.NODE_ENV === "production") {
          await refundCredits({
            userId: ctx.user._id,
            amount: RE_EDIT_CREDIT_COST,
            description: "Automatic refund — could not queue photo re-edit",
            referenceId: String(listing._id),
            referenceType: "re_edit",
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not start the re-edit right now. Your credit was refunded — please try again.",
          });
        }
        console.warn("Re-edit enqueue warning (Redis offline in dev):", err);
      }

      // Mark listing reEditStatus as processing
      listing.reEditStatus = {
        status: "processing",
        jobId,
        targetImageId: input.generatedImageId,
        updatedAt: new Date(),
      };
      await listing.save();

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

      // When a generation fails and exhausts its retries, the worker
      // automatically refunds the credits (see handleJobFailure). So a failed
      // listing has usually ALREADY been refunded. If we simply re-queued it we
      // would be giving away a free generation. Re-charge in that case; only a
      // failure that was never refunded can be retried for free.
      const creditsNeeded = calculateGenerationCredits(
        listing.type,
        listing.originalImages.length
      );

      if (listing.creditsRefunded && creditsNeeded > 0) {
        try {
          await deductCredits({
            userId: ctx.user._id,
            amount: creditsNeeded,
            description: `Retry generation: ${listing.userTitle || "listing"}`,
            referenceId: String(listing._id),
            referenceType: "listing_object",
          });
        } catch (err: any) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: err.message || "Insufficient credits to retry. Please top up your account.",
          });
        }
        listing.creditsCharged = creditsNeeded;
        listing.creditsRefunded = false;
      }

      listing.status = "queued";
      listing.errorMessage = undefined;
      await listing.save();

      let jobId: string | undefined;
      try {
        jobId = await enqueueImageGeneration(String(listing._id));
      } catch (err) {
        // Could not re-queue: undo any re-charge so the user isn't billed.
        if (listing.creditsRefunded === false && creditsNeeded > 0) {
          await refundCredits({
            userId: ctx.user._id,
            amount: creditsNeeded,
            description: `Automatic refund — could not re-queue retry for ${listing.userTitle || "listing"}`,
            referenceId: String(listing._id),
            referenceType: "listing_object",
          });
          listing.creditsRefunded = true;
        }
        listing.status = "failed";
        await listing.save();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not restart generation right now. Any charge was refunded — please try again.",
        });
      }
      listing.bullmqJobId = jobId;
      await listing.save();

      return { success: true, status: listing.status, jobId };
    }),
});
