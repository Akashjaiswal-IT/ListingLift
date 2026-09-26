import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { ListingObject } from "@repo/database";
import {
  calculateGenerationCredits,
  deductCredits,
  RE_EDIT_CREDIT_COST,
  enqueueImageGeneration,
  enqueueReEdit,
  checkRateLimit,
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

      // Enqueue BullMQ worker job for image & card generation
      let jobId: string | undefined;
      try {
        jobId = await enqueueImageGeneration(String(listing._id));
      } catch (err) {
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
        console.warn("Re-edit enqueue warning (Redis offline in dev):", err);
      }

      return {
        success: true,
        jobId,
        creditsRemaining: newBalance,
      };
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
          message: "Only failed generations can be retried without charge",
        });
      }

      listing.status = "queued";
      listing.errorMessage = undefined;
      await listing.save();

      const jobId = await enqueueImageGeneration(String(listing._id));
      listing.bullmqJobId = jobId;
      await listing.save();

      return { success: true, status: listing.status, jobId };
    }),
});
