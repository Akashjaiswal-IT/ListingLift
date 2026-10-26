import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { ListingObject } from "@repo/database";
import { getPresignedDownloadUrl, runAssetJob, AssetJobTimeoutError } from "@repo/services";
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
      // Zipping (and the marketplace spreadsheet) runs in the worker so it never blocks the API
      try {
        const result = await runAssetJob("bundle-zip", {
          listingObjectId: String(listing._id),
          userId: String(ctx.user._id),
        });
        return { downloadUrl: result.downloadUrl, s3Key: result.s3Key };
      } catch (err) {
        if (err instanceof AssetJobTimeoutError) {
          throw new TRPCError({
            code: "TIMEOUT",
            message: "Preparing the download is taking longer than usual. Please try again in a minute.",
          });
        }
        throw err;
      }
    }),
});
