import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { ListingObject } from "@repo/database";
import { deleteObjectFromR2, generateListingText, getPresignedDownloadUrl } from "@repo/services";

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

  if (listing.generatedImages && listing.generatedImages.length > 0) {
    for (const img of listing.generatedImages) {
      if (img.s3Key && isUrlExpired(img.url)) {
        try {
          img.url = await getPresignedDownloadUrl(img.s3Key, 7 * 24 * 3600);
          modified = true;
        } catch {}
      }
    }
  }

  if (listing.whatsappCard?.s3Key && isUrlExpired(listing.whatsappCard.url)) {
    try {
      listing.whatsappCard.url = await getPresignedDownloadUrl(listing.whatsappCard.s3Key, 7 * 24 * 3600);
      modified = true;
    } catch {}
  }

  if (listing.instagramPost?.s3Key && isUrlExpired(listing.instagramPost.url)) {
    try {
      listing.instagramPost.url = await getPresignedDownloadUrl(listing.instagramPost.s3Key, 7 * 24 * 3600);
      modified = true;
    } catch {}
  }

  if (listing.instagramStory?.s3Key && isUrlExpired(listing.instagramStory.url)) {
    try {
      listing.instagramStory.url = await getPresignedDownloadUrl(listing.instagramStory.s3Key, 7 * 24 * 3600);
      modified = true;
    } catch {}
  }

  return modified;
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

  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        type: z.enum(["listing_product", "listing_kit"]).optional(),
        status: z
          .enum(["uploaded", "queued", "processing", "completed", "failed"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, type, status } = input;
      const skip = (page - 1) * limit;

      const query: any = { userId: ctx.user._id };
      if (type) query.type = type;
      if (status) query.status = status;

      const [items, total] = await Promise.all([
        ListingObject.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ListingObject.countDocuments(query),
      ]);

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
      const listing = await ListingObject.findOne({
        _id: input.id,
        userId: ctx.user._id,
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      // Cleanup images in R2
      const keysToDelete: string[] = [];
      listing.originalImages.forEach((img) => keysToDelete.push(img.s3Key));
      listing.generatedImages.forEach((img) => keysToDelete.push(img.s3Key));
      if (listing.whatsappCard?.s3Key) keysToDelete.push(listing.whatsappCard.s3Key);
      if (listing.instagramPost?.s3Key) keysToDelete.push(listing.instagramPost.s3Key);
      if (listing.instagramStory?.s3Key) keysToDelete.push(listing.instagramStory.s3Key);

      for (const key of keysToDelete) {
        try {
          await deleteObjectFromR2(key);
        } catch {}
      }

      await ListingObject.deleteOne({ _id: listing._id });
      return { success: true };
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

      return generatedText;
    }),
});
