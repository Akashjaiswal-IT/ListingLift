import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();
const findOneAndUpdate = vi.fn();
const updateOne = vi.fn();
const generateListingText = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: {
    findOne: (...args: unknown[]) => findOne(...args),
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
    updateOne: (...args: unknown[]) => updateOne(...args),
  },
}));

vi.mock("@repo/services", () => ({
  deleteObjectFromR2: vi.fn(),
  generateListingText: (...args: unknown[]) => generateListingText(...args),
  getPresignedDownloadUrl: vi.fn(),
  getPublicUrlForS3Key: vi.fn(),
  hasPublicAssetBase: vi.fn().mockReturnValue(false),
  isPublicPrefix: vi.fn().mockReturnValue(false),
  generateGenericMarketplaceExcel: vi.fn(),
  uploadBufferToR2: vi.fn(),
  captureServerException: vi.fn(),
}));

import { listingRouter } from "../server/routes/listing/route";

function caller() {
  return listingRouter.createCaller({
    clerkUserId: "clerk_1",
    user: { _id: "user1", storeName: "Test Store" },
    auth: null,
  } as any);
}

describe("listing.regenerateText rate limiting", () => {
  beforeEach(() => {
    findOne.mockReset();
    findOneAndUpdate.mockReset();
    updateOne.mockReset();
    generateListingText.mockReset();
    updateOne.mockResolvedValue({ acknowledged: true });
    generateListingText.mockResolvedValue({
      seoTitle: "Generated SEO Title",
      seoDescription: "Generated SEO Description",
    });
  });

  it("allows Quick Product (listing_product) up to 2 regenerations", async () => {
    const listing = {
      _id: "list1",
      userId: "user1",
      type: "listing_product",
      seoRegenerateCount: 0,
      userTitle: "Handmade Mug",
      originalImages: [],
    };
    findOne.mockResolvedValue(listing);
    findOneAndUpdate.mockResolvedValue({ ...listing, seoRegenerateCount: 1 });

    const res1 = await caller().regenerateText({ id: "list1" });
    expect(res1.seoTitle).toBe("Generated SEO Title");
    expect(res1.seoRegenerateCount).toBe(1);
    expect(generateListingText).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "list1",
        userId: "user1",
      }),
      { $inc: { seoRegenerateCount: 1 } },
      { new: true }
    );
  });

  it("blocks Quick Product (listing_product) when it reaches the 2 limit", async () => {
    const listing = {
      _id: "list1",
      userId: "user1",
      type: "listing_product",
      seoRegenerateCount: 2,
      userTitle: "Handmade Mug",
    };
    findOne.mockResolvedValue(listing);

    await expect(caller().regenerateText({ id: "list1" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringContaining("SEO copy regeneration limit reached (2 max"),
    });

    expect(findOneAndUpdate).not.toHaveBeenCalled();
    expect(generateListingText).not.toHaveBeenCalled();
  });

  it("allows Listing Kit (listing_kit) up to 5 regenerations and blocks at 5", async () => {
    const listing = {
      _id: "list2",
      userId: "user1",
      type: "listing_kit",
      seoRegenerateCount: 4,
      userTitle: "Leather Wallet",
    };
    findOne.mockResolvedValue(listing);
    findOneAndUpdate.mockResolvedValue({ ...listing, seoRegenerateCount: 5 });

    const res = await caller().regenerateText({ id: "list2" });
    expect(res.seoRegenerateCount).toBe(5);

    // Now at 5, next call should fail immediately
    findOne.mockResolvedValue({ ...listing, seoRegenerateCount: 5 });
    await expect(caller().regenerateText({ id: "list2" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringContaining("SEO copy regeneration limit reached (5 max"),
    });
  });

  it("handles legacy listings with undefined seoRegenerateCount", async () => {
    const listing = {
      _id: "list_legacy",
      userId: "user1",
      type: "listing_product",
      // seoRegenerateCount is undefined
    };
    findOne.mockResolvedValue(listing);
    findOneAndUpdate.mockResolvedValue({ ...listing, seoRegenerateCount: 1 });

    const res = await caller().regenerateText({ id: "list_legacy" });
    expect(res.seoRegenerateCount).toBe(1);
    expect(generateListingText).toHaveBeenCalledTimes(1);
  });

  it("rolls back the incremented count if generateListingText fails", async () => {
    const listing = {
      _id: "list_err",
      userId: "user1",
      type: "listing_product",
      seoRegenerateCount: 0,
    };
    findOne.mockResolvedValue(listing);
    findOneAndUpdate.mockResolvedValue({ ...listing, seoRegenerateCount: 1 });
    generateListingText.mockRejectedValue(new Error("OpenAI API timeout"));

    await expect(caller().regenerateText({ id: "list_err" })).rejects.toThrow("OpenAI API timeout");

    expect(updateOne).toHaveBeenCalledWith(
      { _id: "list_err" },
      { $inc: { seoRegenerateCount: -1 } }
    );
  });

  it("throws NOT_FOUND if listing does not exist", async () => {
    findOne.mockResolvedValue(null);

    await expect(caller().regenerateText({ id: "nonexistent" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(generateListingText).not.toHaveBeenCalled();
  });
});
