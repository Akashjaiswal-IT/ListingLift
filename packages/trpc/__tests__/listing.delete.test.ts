import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();
const find = vi.fn();
const deleteOne = vi.fn();
const deleteMany = vi.fn();
const deleteObjectFromR2 = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: {
    findOne: (...args: unknown[]) => findOne(...args),
    find: (...args: unknown[]) => find(...args),
    deleteOne: (...args: unknown[]) => deleteOne(...args),
    deleteMany: (...args: unknown[]) => deleteMany(...args),
  },
}));

vi.mock("@repo/services", () => ({
  deleteObjectFromR2: (...args: unknown[]) => deleteObjectFromR2(...args),
  generateListingText: vi.fn(),
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

describe("listing.delete and storage cleanup", () => {
  beforeEach(() => {
    findOne.mockReset();
    find.mockReset();
    deleteOne.mockReset();
    deleteMany.mockReset();
    deleteObjectFromR2.mockReset();
    deleteObjectFromR2.mockResolvedValue(undefined);
  });

  it("deletes all images, cards, Excel export, and ZIP bundle on listing.delete", async () => {
    const listingId = "listing_123";
    const listing = {
      _id: listingId,
      userId: "user1",
      originalImages: [{ s3Key: "uploads/user1/orig1.jpg" }],
      generatedImages: [
        { s3Key: `generated/${listingId}/studio_1_123.webp` },
        { s3Key: `generated/${listingId}/reedit_456_789.webp` },
      ],
      whatsappCard: { s3Key: `cards/${listingId}/wa_111.webp` },
      instagramPost: { s3Key: `cards/${listingId}/ig_222.webp` },
      instagramStory: { s3Key: `cards/${listingId}/story_333.webp` },
    };

    findOne.mockResolvedValue(listing);
    deleteOne.mockResolvedValue({ acknowledged: true, deletedCount: 1 });

    const res = await caller().delete({ id: listingId });
    expect(res.success).toBe(true);

    // Verify all original, generated (and thumbs), cards, excel, and zip keys were called with deleteObjectFromR2
    expect(deleteObjectFromR2).toHaveBeenCalledWith("uploads/user1/orig1.jpg");
    expect(deleteObjectFromR2).toHaveBeenCalledWith(`generated/${listingId}/studio_1_123.webp`);
    expect(deleteObjectFromR2).toHaveBeenCalledWith(`generated/${listingId}/thumb_studio_1_123.webp`);
    expect(deleteObjectFromR2).toHaveBeenCalledWith(`generated/${listingId}/reedit_456_789.webp`);
    expect(deleteObjectFromR2).toHaveBeenCalledWith(`generated/${listingId}/thumb_reedit_456_789.webp`);
    expect(deleteObjectFromR2).toHaveBeenCalledWith(`cards/${listingId}/wa_111.webp`);
    expect(deleteObjectFromR2).toHaveBeenCalledWith(`cards/${listingId}/ig_222.webp`);
    expect(deleteObjectFromR2).toHaveBeenCalledWith(`cards/${listingId}/story_333.webp`);
    expect(deleteObjectFromR2).toHaveBeenCalledWith(`exports/${listingId}/marketplace-catalog-${listingId}.xlsx`);
    expect(deleteObjectFromR2).toHaveBeenCalledWith(`bundles/${listingId}/listing-kit-${listingId}.zip`);

    expect(deleteOne).toHaveBeenCalledWith({ _id: listingId });
  });

  it("cleans up Excel and ZIP bundles on bulkDelete as well", async () => {
    const l1 = {
      _id: "l1",
      userId: "user1",
      originalImages: [{ s3Key: "uploads/user1/photo.jpg" }],
      generatedImages: [],
    };
    find.mockResolvedValue([l1]);
    deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 1 });

    const res = await caller().bulkDelete({ ids: ["l1"] });
    expect(res.success).toBe(true);

    expect(deleteObjectFromR2).toHaveBeenCalledWith("exports/l1/marketplace-catalog-l1.xlsx");
    expect(deleteObjectFromR2).toHaveBeenCalledWith("bundles/l1/listing-kit-l1.zip");
  });
});
