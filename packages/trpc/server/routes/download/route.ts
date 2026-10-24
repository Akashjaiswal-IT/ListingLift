import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { ListingObject } from "@repo/database";
import { getPresignedDownloadUrl, createListingBundleZip } from "@repo/services";
import { assertOwnsStorageKey } from "../../storage-access";
import { enforceRateLimit } from "../../rate-limit";

export const downloadRouter = router({
  getImageUrl: protectedProcedure
    .input(z.object({ s3Key: z.string() }))
    .query(async ({ ctx, input }) => {
      // Never sign a key the caller doesn't own (previously any signed-in user could fetch any file).
      await assertOwnsStorageKey(input.s3Key, ctx.user._id);
      const downloadUrl = await getPresignedDownloadUrl(input.s3Key, 3600);
      return { downloadUrl };
    }),

  downloadBundle: protectedProcedure
    .input(z.object({ listingObjectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ListingObject.findOne({
        _id: input.listingObjectId,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      if (listing.status !== "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Listing generation has not yet completed",
        });
      }

      await enforceRateLimit(ctx.user._id, "export", "download");
      const result = await createListingBundleZip(listing);
      return result;
    }),
});
