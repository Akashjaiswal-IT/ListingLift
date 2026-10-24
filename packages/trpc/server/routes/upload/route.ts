import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { ListingObject } from "@repo/database";
import {
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  deleteObjectFromR2,
  checkRateLimit,
} from "@repo/services";
import { enforceRateLimit } from "../../rate-limit";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const uploadRouter = router({
  getPresignedUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ALLOWED_MIME_TYPES.has(input.mimeType.toLowerCase())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unsupported file type. Please upload JPEG, PNG, WEBP, or HEIC images.",
        });
      }

      const rateLimit = await checkRateLimit(String(ctx.user._id), "upload");
      if (!rateLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Daily upload limit reached (${rateLimit.limit} uploads/day). Please try again tomorrow.`,
        });
      }

      const extension = input.fileName.split(".").pop() || "jpg";
      const s3Key = `uploads/${ctx.user._id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
      return await getPresignedUploadUrl(s3Key, input.mimeType, 300);
    }),

  confirmUpload: protectedProcedure
    .input(
      z.object({
        type: z.enum(["listing_product", "listing_kit"]),
        listingObjectId: z.string().optional(),
        originalImages: z
          .array(
            z.object({
              s3Key: z.string(),
              fileName: z.string(),
              url: z.string(),
              thumbnailUrl: z.string().optional(),
              width: z.number().optional(),
              height: z.number().optional(),
              fileSizeBytes: z.number().optional(),
              mimeType: z.string().optional(),
            })
          )
          .min(1, "At least one image is required")
          .max(5, "Maximum 5 images allowed"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate image count according to product type
      if (input.type === "listing_product" && input.originalImages.length > 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Quick generate takes exactly 1 photo. Use Listing Kit for multiple photos.",
        });
      }

      // SECURITY (IDOR defense): getPresignedUrl only ever issues keys under
      // `uploads/<thisUser>/`. The browser then sends those keys back here, but
      // nothing stops a malicious client from sending someone ELSE's key (or an
      // arbitrary path). If we trusted it, the worker would happily process
      // another user's private image. So we verify every key belongs to the
      // caller, and we REBUILD the public url server-side instead of trusting
      // the one the client supplied (which could point anywhere).
      const userPrefix = `uploads/${ctx.user._id}/`;
      const safeOriginals = await Promise.all(
        input.originalImages.map(async (img) => {
          if (!img.s3Key.startsWith(userPrefix)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Invalid upload reference.",
            });
          }
          return {
            ...img,
            url: await getPresignedDownloadUrl(img.s3Key, 7 * 24 * 3600),
          };
        })
      );

      // If an existing unstarted uploaded listing was specified, update it and
      // clean up any obsolete images from R2 storage instead of leaving an orphan.
      // Atomic and conditional on "uploaded": once generation has claimed (and charged for) the
      // listing, its photos can no longer change underneath the price that was charged.
      if (input.listingObjectId) {
        const previous = await ListingObject.findOneAndUpdate(
          { _id: input.listingObjectId, userId: ctx.user._id, status: "uploaded" },
          { $set: { type: input.type, originalImages: safeOriginals } },
          { new: false }
        );

        if (previous) {
          const newKeys = new Set(safeOriginals.map((img) => img.s3Key));
          for (const oldImg of previous.originalImages || []) {
            if (oldImg.s3Key && !newKeys.has(oldImg.s3Key)) {
              try {
                await deleteObjectFromR2(oldImg.s3Key);
              } catch {}
            }
          }

          const updated = await ListingObject.findById(previous._id);
          return {
            listingObjectId: String(previous._id),
            type: updated?.type ?? input.type,
            originalImages: updated?.originalImages ?? safeOriginals,
          };
        }
      }

      await enforceRateLimit(ctx.user._id, "create_listing", "new listing");

      // Clean up any stale unstarted orphan drafts for this user so they don't linger.
      // Each delete is conditional on still being "uploaded", so a draft that generation is
      // claiming at this very moment is never deleted; its images are removed only if it was.
      const staleDrafts = await ListingObject.find({
        userId: ctx.user._id,
        status: "uploaded",
      });
      for (const draft of staleDrafts) {
        const deleted = await ListingObject.findOneAndDelete({ _id: draft._id, status: "uploaded" });
        if (!deleted) continue;
        for (const img of deleted.originalImages || []) {
          if (img.s3Key) {
            try {
              await deleteObjectFromR2(img.s3Key);
            } catch {}
          }
        }
      }

      const listingObject = await ListingObject.create({
        userId: ctx.user._id,
        type: input.type,
        status: "uploaded",
        textStatus: "pending",
        originalImages: safeOriginals,
        creditsCharged: 0,
      });

      return {
        listingObjectId: String(listingObject._id),
        type: listingObject.type,
        originalImages: listingObject.originalImages,
      };
    }),

  deleteImage: protectedProcedure
    .input(
      z.object({
        listingObjectId: z.string(),
        s3Key: z.string(),
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

      if (listing.status !== "uploaded") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify images once generation has commenced",
        });
      }

      // SECURITY (IDOR defense): only delete a key that is actually one of THIS
      // listing's uploaded photos. Without this check a caller could pass any
      // storage key (another user's photo, a generated image, an export) and the
      // delete below would remove it.
      const ownsKey = listing.originalImages.some((img) => img.s3Key === input.s3Key);
      if (!ownsKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Image not found on this listing",
        });
      }

      // Remove from document
      listing.originalImages = listing.originalImages.filter(
        (img) => img.s3Key !== input.s3Key
      );
      await listing.save();

      // Clean up from R2
      try {
        await deleteObjectFromR2(input.s3Key);
      } catch (err) {
        console.warn("Failed to delete S3 key from R2:", input.s3Key, err);
      }

      return { success: true, remainingImages: listing.originalImages };
    }),
});
