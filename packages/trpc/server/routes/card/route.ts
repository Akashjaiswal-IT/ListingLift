import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { ListingObject } from "@repo/database";
import {
  getPresignedDownloadUrl,
  pickCardSourceImage,
  runAssetJob,
  AssetJobTimeoutError,
} from "@repo/services";
import { assertOwnsStorageKey } from "../../storage-access";
import { enforceRateLimit } from "../../rate-limit";

export const cardRouter = router({
  regenerateCards: protectedProcedure
    .input(z.object({ listingObjectId: z.string(), templateId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Cheap checks here; the rendering itself (sharp + Pango, CPU-heavy) runs in the worker
      const listing = await ListingObject.findOne({
        _id: input.listingObjectId,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      await enforceRateLimit(ctx.user._id, "regenerate_cards", "card regeneration");

      if (!pickCardSourceImage(listing)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No product photo available to generate cards",
        });
      }

      try {
        const cards = await runAssetJob("regenerate-cards", {
          listingObjectId: String(listing._id),
          userId: String(ctx.user._id),
          ...(input.templateId ? { templateId: input.templateId } : {}),
        });
        return {
          whatsappCard: cards.whatsappCard,
          instagramPost: cards.instagramPost,
          instagramStory: cards.instagramStory,
        };
      } catch (err) {
        if (err instanceof AssetJobTimeoutError) {
          throw new TRPCError({
            code: "TIMEOUT",
            message: "Card rendering is taking longer than usual. Please try again in a minute.",
          });
        }
        throw err;
      }
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ s3Key: z.string() }))
    .query(async ({ ctx, input }) => {
      // Only sign keys the caller owns: their own uploads, or images/cards of their own listing.
      await assertOwnsStorageKey(input.s3Key, ctx.user._id);

      const url = await getPresignedDownloadUrl(input.s3Key, 3600);
      return { downloadUrl: url };
    }),
});
