import { describe, it, expect, vi, beforeEach } from "vitest";

const findOneAndDelete = vi.fn();
const exists = vi.fn();
const deleteObjectFromR2 = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: {
    findOneAndDelete: (...args: unknown[]) => findOneAndDelete(...args),
    exists: (...args: unknown[]) => exists(...args),
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
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 20, remaining: 19, resetInSeconds: 0 }),
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
    findOneAndDelete.mockReset();
    exists.mockReset();
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

    findOneAndDelete.mockResolvedValue(listing);

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

    // One atomic delete, scoped to the owner and refusing a listing that is still generating
    expect(findOneAndDelete).toHaveBeenCalledWith(
      expect.objectContaining({ _id: listingId, userId: "user1", $nor: expect.any(Array) })
    );
  });

  it("refuses to delete a listing that is still generating, and touches no storage", async () => {
    findOneAndDelete.mockResolvedValue(null);
    exists.mockResolvedValue({ _id: "busy1" });
    await expect(caller().delete({ id: "busy1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(deleteObjectFromR2).not.toHaveBeenCalled();

    exists.mockResolvedValue(null);
    await expect(caller().delete({ id: "gone" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("cleans up Excel and ZIP bundles on bulkDelete as well", async () => {
    const l1 = {
      _id: "l1",
      userId: "user1",
      originalImages: [{ s3Key: "uploads/user1/photo.jpg" }],
      generatedImages: [],
    };
    findOneAndDelete.mockImplementation(async (q: { _id: string }) => (q._id === "l1" ? l1 : null));

    const res = await caller().bulkDelete({ ids: ["l1", "busy2"] });
    expect(res.success).toBe(true);
    expect(res.deletedCount).toBe(1); // busy2 is still generating, so it is skipped

    expect(deleteObjectFromR2).toHaveBeenCalledWith("exports/l1/marketplace-catalog-l1.xlsx");
    expect(deleteObjectFromR2).toHaveBeenCalledWith("bundles/l1/listing-kit-l1.zip");
  });
});
