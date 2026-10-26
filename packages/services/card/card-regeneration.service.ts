import { ListingObject, User, type IListingObject } from "@repo/database";
import { fetchBufferFromR2, uploadBufferToR2, deleteObjectFromR2 } from "../storage/r2.service";
import { renderSocialCards } from "./card-renderer.service";
import { DEFAULT_TEMPLATE_ID } from "./card-design";

export interface RegenerateCardsParams {
  listingObjectId: string;
  /** Owner of the listing. The listing is only touched when it belongs to this user. */
  userId: string;
  /** New template to render (and remember on the listing). Omitted = keep the listing's template. */
  templateId?: string;
}

export interface RegeneratedCard {
  s3Key: string;
  url: string;
  templateId: string;
  generatedAt: Date;
}

export interface RegeneratedCards {
  whatsappCard: RegeneratedCard;
  instagramPost: RegeneratedCard;
  instagramStory: RegeneratedCard;
}

type CardSourceListing = Pick<IListingObject, "generatedImages" | "originalImages">;

/**
 * The photo cards are rendered from: the pure-white-background studio shot (cleanest cutout),
 * then any active generated image, then the original photo. Undefined when there is none.
 */
export function pickCardSourceImage(listing: CardSourceListing): { s3Key: string } | undefined {
  return (
    listing.generatedImages.find(
      (img) => img.isLatest !== false && img.variationType === "studio_white"
    ) ||
    listing.generatedImages.find((img) => img.isLatest !== false) ||
    listing.originalImages[0]
  );
}

/**
 * Re-renders a listing's three social cards (WhatsApp, Instagram post, Instagram story), uploads
 * them, stores them on the listing with one atomic update (no stale full-document save) and
 * deletes the previous card files. CPU-heavy (sharp + Pango), so it runs in the worker.
 */
export async function regenerateListingCards(params: RegenerateCardsParams): Promise<RegeneratedCards> {
  const listing = await ListingObject.findOne({ _id: params.listingObjectId, userId: params.userId });
  if (!listing) {
    throw new Error("Listing not found");
  }

  const primaryImage = pickCardSourceImage(listing);
  if (!primaryImage) {
    throw new Error("No product photo available to generate cards");
  }

  const user = await User.findById(params.userId);
  const templateId = params.templateId || listing.templateId || DEFAULT_TEMPLATE_ID;
  const productBuffer = await fetchBufferFromR2(primaryImage.s3Key);

  const cards = await renderSocialCards({
    productImage: productBuffer,
    productTitle: listing.userTitle || "Product",
    price: listing.price,
    discountPrice: listing.discountPrice,
    ctaText: listing.ctaText || user?.defaultCta?.text,
    templateId,
    sellerInfo: {
      storeName: user?.storeName,
      whatsappNumber: user?.whatsappNumber,
      instagramHandle: user?.instagramHandle,
    },
    language: user?.cardSettings?.language ?? "en",
    trustBadges: {
      cod: user?.cardSettings?.cod === true,
      freeDelivery: user?.cardSettings?.freeDelivery === true,
      easyReturns: user?.cardSettings?.easyReturns === true,
      madeInIndia: user?.cardSettings?.madeInIndia === true,
    },
  });

  // Old card files are deleted only after the new ones are saved on the listing
  const oldCardKeys = [
    listing.whatsappCard?.s3Key,
    listing.instagramPost?.s3Key,
    listing.instagramStory?.s3Key,
  ].filter((key): key is string => !!key);

  const stamp = Date.now();
  const [waUpload, igPostUpload, igStoryUpload] = await Promise.all([
    uploadBufferToR2(`cards/${listing._id}/whatsapp-${stamp}.jpg`, cards.whatsappCard, "image/jpeg"),
    uploadBufferToR2(`cards/${listing._id}/ig-post-${stamp}.jpg`, cards.instagramPost, "image/jpeg"),
    uploadBufferToR2(`cards/${listing._id}/ig-story-${stamp}.jpg`, cards.instagramStory, "image/jpeg"),
  ]);

  const generatedAt = new Date();
  const card = (upload: { s3Key: string; publicUrl: string }): RegeneratedCard => ({
    s3Key: upload.s3Key,
    url: upload.publicUrl,
    templateId,
    generatedAt,
  });
  const result: RegeneratedCards = {
    whatsappCard: card(waUpload),
    instagramPost: card(igPostUpload),
    instagramStory: card(igStoryUpload),
  };

  await ListingObject.updateOne(
    { _id: listing._id, userId: params.userId },
    {
      $set: {
        ...result,
        ...(params.templateId ? { templateId: params.templateId } : {}),
      },
    }
  );

  for (const oldKey of oldCardKeys) {
    try {
      await deleteObjectFromR2(oldKey);
    } catch {
      // A leftover old card file is harmless; never fail the regeneration over it
    }
  }

  return result;
}
