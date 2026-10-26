import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();
const updateOne = vi.fn();
const findUser = vi.fn();
const fetchBufferFromR2 = vi.fn();
const uploadBufferToR2 = vi.fn();
const deleteObjectFromR2 = vi.fn();
const renderSocialCards = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: {
    findOne: (...args: unknown[]) => findOne(...args),
    updateOne: (...args: unknown[]) => updateOne(...args),
  },
  User: {
    findById: (...args: unknown[]) => findUser(...args),
  },
}));

vi.mock("../storage/r2.service", () => ({
  fetchBufferFromR2: (...args: unknown[]) => fetchBufferFromR2(...args),
  uploadBufferToR2: (...args: unknown[]) => uploadBufferToR2(...args),
  deleteObjectFromR2: (...args: unknown[]) => deleteObjectFromR2(...args),
}));

vi.mock("../card/card-renderer.service", () => ({
  renderSocialCards: (...args: unknown[]) => renderSocialCards(...args),
}));

import { regenerateListingCards, pickCardSourceImage } from "../card/card-regeneration.service";

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    _id: "list1",
    userId: "user1",
    userTitle: "Handmade Mug",
    price: 999,
    templateId: "minimal-luxury",
    generatedImages: [
      { s3Key: "generated/list1/lifestyle.jpg", isLatest: true, variationType: "lifestyle" },
      { s3Key: "generated/list1/studio_1.jpg", isLatest: true, variationType: "studio_white" },
    ],
    originalImages: [{ s3Key: "uploads/user1/original.jpg" }],
    whatsappCard: { s3Key: "cards/list1/old-wa.webp" },
    instagramPost: undefined,
    instagramStory: undefined,
    save: vi.fn(),
    ...overrides,
  };
}

describe("pickCardSourceImage", () => {
  it("prefers the white studio shot, then any active image, then the original", () => {
    expect(pickCardSourceImage(makeListing() as any)?.s3Key).toBe("generated/list1/studio_1.jpg");
    expect(
      pickCardSourceImage(
        makeListing({ generatedImages: [{ s3Key: "g/a.jpg", isLatest: true, variationType: "lifestyle" }] }) as any
      )?.s3Key
    ).toBe("g/a.jpg");
    expect(pickCardSourceImage(makeListing({ generatedImages: [] }) as any)?.s3Key).toBe("uploads/user1/original.jpg");
    expect(pickCardSourceImage(makeListing({ generatedImages: [], originalImages: [] }) as any)).toBeUndefined();
  });
});

describe("regenerateListingCards", () => {
  beforeEach(() => {
    findOne.mockReset();
    updateOne.mockReset().mockResolvedValue({ acknowledged: true });
    findUser.mockReset().mockResolvedValue({ _id: "user1", storeName: "Test Store" });
    fetchBufferFromR2.mockReset().mockResolvedValue(Buffer.from("product"));
    renderSocialCards.mockReset().mockResolvedValue({
      whatsappCard: Buffer.from("wa"),
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
    findUser.mockResolvedValue({
      _id: "user1",
      storeName: "Test Store",
      cardSettings: { language: "hi", cod: true, freeDelivery: false, easyReturns: true, madeInIndia: false },
    });

    await regenerateListingCards({ listingObjectId: "list1", userId: "user1" });

    expect(renderSocialCards).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "hi",
        trustBadges: { cod: true, freeDelivery: false, easyReturns: true, madeInIndia: false },
        sellerInfo: expect.objectContaining({ storeName: "Test Store" }),
        templateId: "minimal-luxury",
      })
    );
  });

  it("uses safe defaults for users without card settings (no claims, English)", async () => {
    findOne.mockResolvedValue(makeListing());

    await regenerateListingCards({ listingObjectId: "list1", userId: "user1" });

    expect(renderSocialCards).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "en",
        trustBadges: { cod: false, freeDelivery: false, easyReturns: false, madeInIndia: false },
      })
    );
  });

  it("renders from the white studio shot", async () => {
    findOne.mockResolvedValue(makeListing());

    await regenerateListingCards({ listingObjectId: "list1", userId: "user1" });

    expect(fetchBufferFromR2).toHaveBeenCalledWith("generated/list1/studio_1.jpg");
  });

  it("uploads every card as JPEG, saves them atomically with the template and cleans up the old card", async () => {
    const listing = makeListing();
    findOne.mockResolvedValue(listing);

    const res = await regenerateListingCards({ listingObjectId: "list1", userId: "user1", templateId: "diwali-glow" });

    expect(uploadBufferToR2).toHaveBeenCalledTimes(3);
    for (const [key, , contentType] of uploadBufferToR2.mock.calls) {
      expect(key).toMatch(/^cards\/list1\/.+\.jpg$/);
      expect(contentType).toBe("image/jpeg");
    }
    expect(listing.save).not.toHaveBeenCalled();
    expect(updateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = updateOne.mock.calls[0]!;
    expect(filter).toEqual({ _id: "list1", userId: "user1" });
    expect(update.$set.templateId).toBe("diwali-glow");
    for (const key of ["whatsappCard", "instagramPost", "instagramStory"] as const) {
      expect(update.$set[key]).toEqual(res[key]);
      expect(res[key].s3Key).toMatch(/\.jpg$/);
      expect(res[key].url).toBe(`https://cdn/${res[key].s3Key}`);
      expect(res[key].templateId).toBe("diwali-glow");
      expect(res[key].generatedAt).toBeInstanceOf(Date);
    }
    expect(deleteObjectFromR2).toHaveBeenCalledWith("cards/list1/old-wa.webp");
    // Old files are only deleted after the new cards are stored
    expect(updateOne.mock.invocationCallOrder[0]!).toBeLessThan(deleteObjectFromR2.mock.invocationCallOrder[0]!);
  });

  it("keeps the listing's template when none is chosen (and doesn't overwrite it)", async () => {
    findOne.mockResolvedValue(makeListing());

    const res = await regenerateListingCards({ listingObjectId: "list1", userId: "user1" });

    const [, update] = updateOne.mock.calls[0]!;
    expect(update.$set).not.toHaveProperty("templateId");
    expect(res.whatsappCard.templateId).toBe("minimal-luxury");
  });

  it("falls back to the default template for listings without one", async () => {
    findOne.mockResolvedValue(makeListing({ templateId: undefined }));

    const res = await regenerateListingCards({ listingObjectId: "list1", userId: "user1" });

    expect(res.instagramPost.templateId).toBe("studio-auto");
  });

  it("refuses listings the user doesn't own", async () => {
    findOne.mockResolvedValue(null);

    await expect(regenerateListingCards({ listingObjectId: "list1", userId: "user2" })).rejects.toThrow(
      "Listing not found"
    );
    expect(findOne).toHaveBeenCalledWith({ _id: "list1", userId: "user2" });
    expect(renderSocialCards).not.toHaveBeenCalled();
  });

  it("does not fail when an old card can't be deleted", async () => {
    findOne.mockResolvedValue(makeListing());
    deleteObjectFromR2.mockRejectedValue(new Error("gone"));

    await expect(regenerateListingCards({ listingObjectId: "list1", userId: "user1" })).resolves.toBeDefined();
  });
});
