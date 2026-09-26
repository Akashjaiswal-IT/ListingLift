import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { ListingObject } from "@repo/database";
import {
  fetchBufferFromR2,
  uploadBufferToR2,
  renderSocialCards,
  getPresignedDownloadUrl,
} from "@repo/services";

export const cardRouter = router({
  regenerateCards: protectedProcedure
    .input(z.object({ listingObjectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ListingObject.findOne({
        _id: input.listingObjectId,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      // Pick best active generated image or original image
      const primaryImage =
        listing.generatedImages.find((img) => img.isLatest !== false) ||
        listing.originalImages[0];

      if (!primaryImage) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No product photo available to generate cards",
        });
      }

      const productBuffer = await fetchBufferFromR2(primaryImage.s3Key);

      const cards = await renderSocialCards({
        productImage: productBuffer,
        productTitle: listing.userTitle || "Product",
        price: listing.price,
        discountPrice: listing.discountPrice,
        ctaText: listing.ctaText || ctx.user.defaultCta?.text,
        sellerInfo: {
          storeName: ctx.user.storeName,
          whatsappNumber: ctx.user.whatsappNumber,
          instagramHandle: ctx.user.instagramHandle,
        },
      });

      const waKey = `cards/${listing._id}/whatsapp-${Date.now()}.webp`;
      const igPostKey = `cards/${listing._id}/ig-post-${Date.now()}.webp`;
      const igStoryKey = `cards/${listing._id}/ig-story-${Date.now()}.webp`;

      const [waUpload, igPostUpload, igStoryUpload] = await Promise.all([
        uploadBufferToR2(waKey, cards.whatsappCard, "image/webp"),
        uploadBufferToR2(igPostKey, cards.instagramPost, "image/webp"),
        uploadBufferToR2(igStoryKey, cards.instagramStory, "image/webp"),
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

      await listing.save();

      return {
        whatsappCard: listing.whatsappCard,
        instagramPost: listing.instagramPost,
        instagramStory: listing.instagramStory,
      };
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ s3Key: z.string() }))
    .query(async ({ input }) => {
      const url = await getPresignedDownloadUrl(input.s3Key, 3600);
      return { downloadUrl: url };
    }),
});
