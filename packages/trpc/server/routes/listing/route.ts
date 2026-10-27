import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { ListingObject } from "@repo/database";
import {
  deleteObjectFromR2,
  generateListingText,
  getPresignedDownloadUrl,
  getPublicUrlForS3Key,
  hasPublicAssetBase,
  isPublicPrefix,
  generateGenericMarketplaceExcel,
  uploadBufferToR2,
} from "@repo/services";
import { enforceRateLimit } from "../../rate-limit";

// A listing whose generation or re-edit is still running can't be deleted: the worker would keep
// spending AI credit on it and upload files for a listing that no longer exists. A re-edit slot
// left "processing" for over 15 minutes is stale (crashed job) and doesn't block.
function notBusyFilter() {
  return {
    $nor: [
      { status: { $in: ["queued", "processing"] } },
      {
        "reEditStatus.status": "processing",
        "reEditStatus.updatedAt": { $gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    ],
  };
}


async function ensureFreshSignedUrls(listing: any): Promise<boolean> {
  let modified = false;

  function isUrlExpired(url?: string): boolean {
    if (!url) return true;
    const match = url.match(/X-Amz-Date=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
    if (!match) return false;
    const y = match[1];
    const m = match[2];
    const d = match[3];
    const h = match[4];
    const min = match[5];
    const s = match[6];
    if (!y || !m || !d || !h || !min || !s) return false;
    const date = new Date(Date.UTC(+y, +m - 1, +d, +h, +min, +s));
    return Date.now() - date.getTime() > 5 * 24 * 3600 * 1000;
  }

  if (listing.originalImages && listing.originalImages.length > 0) {
    for (const img of listing.originalImages) {
      if (img.s3Key && isUrlExpired(img.url)) {
        try {
          img.url = await getPresignedDownloadUrl(img.s3Key, 7 * 24 * 3600);
          modified = true;
        } catch {}
      }
    }
  }

  // Generated images and cards: switch to the permanent public link when a
  // public host is configured (this also migrates old listings on read);
  // otherwise keep re-signing links that are about to expire.
  const usePublic = hasPublicAssetBase();
  const refresh = async (asset: { s3Key?: string; url?: string } | undefined) => {
    if (!asset?.s3Key) return;
    if (usePublic && isPublicPrefix(asset.s3Key)) {
      const permanent = getPublicUrlForS3Key(asset.s3Key);
      if (asset.url !== permanent) {
        asset.url = permanent;
        modified = true;
      }
      return;
    }
    if (isUrlExpired(asset.url)) {
      try {
        asset.url = await getPresignedDownloadUrl(asset.s3Key, 7 * 24 * 3600);
        modified = true;
      } catch {}
    }
  };

  for (const img of listing.generatedImages || []) await refresh(img);
  await refresh(listing.whatsappCard);
  await refresh(listing.instagramPost);
  await refresh(listing.instagramStory);

  return modified;
}

function collectListingStorageKeys(listing: any): string[] {
  const keys: string[] = [];
  listing.originalImages?.forEach((img: any) => {
    if (img.s3Key) keys.push(img.s3Key);
  });
  listing.generatedImages?.forEach((img: any) => {
    if (img.s3Key) {
      keys.push(img.s3Key);
      if (img.s3Key.includes("/studio_")) {
        keys.push(img.s3Key.replace("/studio_", "/thumb_studio_"));
      } else if (img.s3Key.includes("/reedit_")) {
        keys.push(img.s3Key.replace("/reedit_", "/thumb_reedit_"));
      }
    }
  });
  if (listing.whatsappCard?.s3Key) keys.push(listing.whatsappCard.s3Key);
  if (listing.instagramPost?.s3Key) keys.push(listing.instagramPost.s3Key);
  if (listing.instagramStory?.s3Key) keys.push(listing.instagramStory.s3Key);
  // Clean up Excel exports and ZIP bundles associated with this listing
  keys.push(`exports/${listing._id}/marketplace-catalog-${listing._id}.xlsx`);
  keys.push(`bundles/${listing._id}/listing-kit-${listing._id}.zip`);
  return keys;
}

export const listingRouter = router({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const listing = await ListingObject.findOne({
        _id: input.id,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      // Self-heal: ensure image URLs are fresh and never expired
      const urlsRefreshed = await ensureFreshSignedUrls(listing);
      if (urlsRefreshed) {
        listing.markModified("originalImages");
        listing.markModified("generatedImages");
        listing.markModified("whatsappCard");
        listing.markModified("instagramPost");
        listing.markModified("instagramStory");
        await listing.save().catch(() => {});
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
            ctaText: listing.ctaText || ctx.user.defaultCta?.text,
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

  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        type: z.enum(["listing_product", "listing_kit"]).optional(),
        status: z
          .enum(["uploaded", "queued", "processing", "completed", "failed"])
          .optional(),
        search: z.string().trim().max(100).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, type, status, search } = input;
      const skip = (page - 1) * limit;

      const query: any = { userId: ctx.user._id };
      if (type) query.type = type;
      if (status) {
        query.status = status;
      } else {
        // Exclude unstarted draft uploads ("uploaded") from standard history and dashboard listings
        query.status = { $ne: "uploaded" };
      }
      if (search) {
        // Case-insensitive title search. Escape regex metacharacters so a user
        // typing e.g. "(" can't create an invalid or catastrophic pattern.
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.userTitle = { $regex: escaped, $options: "i" };
      }

      const [items, total] = await Promise.all([
        ListingObject.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ListingObject.countDocuments(query),
      ]);

      // Card thumbnails must not show expired links (response only, not saved).
      await Promise.all(items.map((item) => ensureFreshSignedUrls(item)));

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        userTitle: z.string().optional(),
        userDescription: z.string().optional(),
        price: z.number().optional(),
        discountPrice: z.number().optional(),
        sizes: z.array(z.string()).optional(),
        variants: z.array(z.string()).optional(),
        ctaText: z.string().optional(),
        aiGeneratedText: z
          .object({
            seoTitle: z.string().optional(),
            seoDescription: z.string().optional(),
            keyFeatures: z.array(z.string()).optional(),
            keywords: z.array(z.string()).optional(),
            meeshoListing: z
              .object({
                title: z.string().optional(),
                description: z.string().optional(),
                category: z.string().optional(),
                subcategory: z.string().optional(),
              })
              .optional(),
            whatsappCaption: z.string().optional(),
            instagramCaption: z.string().optional(),
            instagramHashtags: z.array(z.string()).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // price = MRP, discountPrice = selling price
      if (updates.price !== undefined && updates.discountPrice !== undefined && updates.discountPrice > updates.price) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selling price can't be higher than MRP",
        });
      }

      const listing = await ListingObject.findOne({
        _id: id,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      if (updates.userTitle !== undefined) listing.userTitle = updates.userTitle;
      if (updates.userDescription !== undefined) listing.userDescription = updates.userDescription;
      if (updates.price !== undefined) listing.price = updates.price;
      if (updates.discountPrice !== undefined) listing.discountPrice = updates.discountPrice;
      if (updates.sizes !== undefined) listing.sizes = updates.sizes;
      if (updates.variants !== undefined) listing.variants = updates.variants;
      if (updates.ctaText !== undefined) listing.ctaText = updates.ctaText;

      if (updates.aiGeneratedText && listing.aiGeneratedText) {
        Object.assign(listing.aiGeneratedText, updates.aiGeneratedText);
      }

      await listing.save();
      return listing;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Atomic: delete only if it is the caller's and not still generating.
      const listing = await ListingObject.findOneAndDelete({
        _id: input.id,
        userId: ctx.user._id,
        ...notBusyFilter(),
      });

      if (!listing) {
        const exists = await ListingObject.exists({ _id: input.id, userId: ctx.user._id });
        if (exists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This listing is still being generated. You can delete it once it finishes.",
          });
        }
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      // Cleanup all images, cards, Excel exports, and ZIP bundles in R2 (only after the delete succeeded)
      const keysToDelete = collectListingStorageKeys(listing);

      for (const key of keysToDelete) {
        try {
          await deleteObjectFromR2(key);
        } catch {}
      }

      return { success: true };
    }),

  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      // One atomic delete per listing, scoped strictly to the caller's own listings (an attacker
      // can't delete someone else's by passing their ids) and skipping any still generating.
      // Storage is cleaned only for listings that were actually deleted.
      const keysToDelete: string[] = [];
      let deletedCount = 0;
      for (const id of Array.from(new Set(input.ids))) {
        const deleted = await ListingObject.findOneAndDelete({ _id: id, userId: ctx.user._id, ...notBusyFilter() });
        if (deleted) {
          deletedCount++;
          keysToDelete.push(...collectListingStorageKeys(deleted));
        }
      }

      // Best-effort R2 cleanup; never let a storage hiccup block the DB delete.
      for (const key of keysToDelete) {
        try {
          await deleteObjectFromR2(key);
        } catch {}
      }

      return { success: true, deletedCount };
    }),

  regenerateText: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ListingObject.findOne({
        _id: input.id,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      // Copy can only be regenerated for a finished listing (otherwise new, never-generated
      // listings could be used for free AI text), and each seller has an hourly cap.
      if (listing.status !== "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Listing copy can be regenerated once the listing has finished generating.",
        });
      }
      await enforceRateLimit(ctx.user._id, "regenerate_text", "copy regeneration");

      // Enforce per-listing SEO regeneration rate limits based on type:
      // Quick Product (listing_product): 2 max
      // Full Listing Kit (listing_kit): 5 max
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

      // Claim a regeneration slot atomically to prevent concurrent requests from bypassing the cap
      const claimed = await ListingObject.findOneAndUpdate(
        {
          _id: listing._id,
          userId: ctx.user._id,
          $or: [
            { seoRegenerateCount: { $lt: maxLimit } },
            { seoRegenerateCount: { $exists: false } },
          ],
        },
        {
          $inc: { seoRegenerateCount: 1 },
        },
        { new: true }
      );

      if (!claimed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `SEO copy regeneration limit reached (${maxLimit} max).`,
        });
      }

      let generatedText;
      try {
        generatedText = await generateListingText({
          userTitle: listing.userTitle || "Product",
          userDescription: listing.userDescription,
          userPrompt: listing.userPrompt,
          price: listing.price,
          discountPrice: listing.discountPrice,
          sizes: listing.sizes,
          variants: listing.variants,
          ctaText: listing.ctaText || ctx.user.defaultCta?.text,
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
      } catch (genError) {
        // Roll back the claimed count if OpenAI generation failed so the user isn't penalized
        await ListingObject.updateOne(
          { _id: listing._id },
          { $inc: { seoRegenerateCount: -1 } }
        ).catch(() => {});
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't rewrite the copy right now. Your current text is unchanged - please try again in a minute.",
          cause: genError,
        });
      }

      await ListingObject.updateOne(
        { _id: listing._id },
        { $set: { aiGeneratedText: generatedText, textStatus: "completed" } }
      );

      return {
        ...generatedText,
        seoRegenerateCount: claimed.seoRegenerateCount ?? currentCount + 1,
      };
    }),

  exportExcel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const listing = await ListingObject.findOne({
        _id: input.id,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      await enforceRateLimit(ctx.user._id, "export", "export");
      const excelBuffer = await generateGenericMarketplaceExcel(listing);
      const s3Key = `exports/${listing._id}/marketplace-catalog-${listing._id}.xlsx`;
      await uploadBufferToR2(
        s3Key,
        excelBuffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      const downloadUrl = await getPresignedDownloadUrl(s3Key, 3600);

      const cleanTitle = listing.userTitle
        ? listing.userTitle.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)
        : "product";

      return {
        downloadUrl,
        fileName: `marketplace-catalog-${cleanTitle}.xlsx`,
      };
    }),
});
