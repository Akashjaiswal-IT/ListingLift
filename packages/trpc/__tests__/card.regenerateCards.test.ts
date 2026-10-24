import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();
const fetchBufferFromR2 = vi.fn();
const uploadBufferToR2 = vi.fn();
const renderSocialCards = vi.fn();
const deleteObjectFromR2 = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: {
    findOne: (...args: unknown[]) => findOne(...args),
  },
}));

vi.mock("@repo/services", () => ({
  fetchBufferFromR2: (...args: unknown[]) => fetchBufferFromR2(...args),
  uploadBufferToR2: (...args: unknown[]) => uploadBufferToR2(...args),
  renderSocialCards: (...args: unknown[]) => renderSocialCards(...args),
  getPresignedDownloadUrl: vi.fn(),
  deleteObjectFromR2: (...args: unknown[]) => deleteObjectFromR2(...args),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 30, remaining: 29, resetInSeconds: 0 }),
}));

import { cardRouter } from "../server/routes/card/route";

function caller(user: Record<string, unknown> = {}) {
  return cardRouter.createCaller({
    clerkUserId: "clerk_1",
    user: { _id: "user1", storeName: "Test Store", ...user },
    auth: null,
  } as any);
}

function makeListing() {
  return {
    _id: "list1",
    userId: "user1",
    userTitle: "Handmade Mug",
    price: 999,
    templateId: "minimal-luxury",
    generatedImages: [{ s3Key: "generated/list1/studio_1.jpg", isLatest: true, variationType: "studio_white" }],
    originalImages: [],
    whatsappCard: { s3Key: "cards/list1/old-wa.webp" },
    instagramPost: undefined,
    instagramStory: undefined,
    save: vi.fn().mockResolvedValue(undefined),
  };
}

describe("card.regenerateCards", () => {
  beforeEach(() => {
    findOne.mockReset();
    fetchBufferFromR2.mockReset().mockResolvedValue(Buffer.from("product"));
    renderSocialCards.mockReset().mockResolvedValue({
      whatsappCard: Buffer.from("wa"),
      whatsapp: Buffer.from("wa"),
      instagramPost: Buffer.from("post"),
      instagramStory: Buffer.from("story"),
    });
    uploadBufferToR2
      .mockReset()
      .mockImplementation(async (key: string) => ({ s3Key: key, publicUrl: `https://cdn/${key}` }));
    deleteObjectFromR2.mockReset().mockResolvedValue(undefined);
  });

  it("passes the seller's card settings through to the renderer", async () => {
    findOne.mockResolvedValue(makeListing());

    await caller({
      cardSettings: { language: "hi", cod: true, freeDelivery: false, easyReturns: true, madeInIndia: false },
    }).regenerateCards({ listingObjectId: "list1" });

    expect(renderSocialCards).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "hi",
        trustBadges: { cod: true, freeDelivery: false, easyReturns: true, madeInIndia: false },
      })
    );
  });

  it("uses safe defaults for users without card settings (no claims, English)", async () => {
    findOne.mockResolvedValue(makeListing());

    await caller().regenerateCards({ listingObjectId: "list1" });

    expect(renderSocialCards).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "en",
        trustBadges: { cod: false, freeDelivery: false, easyReturns: false, madeInIndia: false },
      })
    );
  });

  it("uploads every card as JPEG and cleans up the old card", async () => {
    const listing = makeListing();
    findOne.mockResolvedValue(listing);

    await caller().regenerateCards({ listingObjectId: "list1" });

    expect(uploadBufferToR2).toHaveBeenCalledTimes(3);
    for (const [key, , contentType] of uploadBufferToR2.mock.calls) {
      expect(key).toMatch(/^cards\/list1\/.+\.jpg$/);
      expect(contentType).toBe("image/jpeg");
    }
    expect(listing.whatsappCard.s3Key).toMatch(/\.jpg$/);
    expect(listing.save).toHaveBeenCalled();
    expect(deleteObjectFromR2).toHaveBeenCalledWith("cards/list1/old-wa.webp");
  });
});
