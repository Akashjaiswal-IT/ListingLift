import { describe, it, expect, vi, beforeEach } from "vitest";

const findOneAndUpdate = vi.fn();
const findOneAndDelete = vi.fn();
const findById = vi.fn();
const find = vi.fn();
const create = vi.fn();
const deleteObjectFromR2 = vi.fn();
const getPresignedDownloadUrl = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: {
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
    findOneAndDelete: (...args: unknown[]) => findOneAndDelete(...args),
    findById: (...args: unknown[]) => findById(...args),
    find: (...args: unknown[]) => find(...args),
    create: (...args: unknown[]) => create(...args),
  },
}));

vi.mock("@repo/services", () => ({
  getPresignedUploadUrl: vi.fn(),
  getPresignedDownloadUrl: (...args: unknown[]) => getPresignedDownloadUrl(...args),
  deleteObjectFromR2: (...args: unknown[]) => deleteObjectFromR2(...args),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 100, remaining: 99, resetInSeconds: 0 }),
  captureServerException: vi.fn(),
}));

import { uploadRouter } from "../server/routes/upload/route";

function caller(userId = "user1") {
  return uploadRouter.createCaller({
    clerkUserId: `clerk_${userId}`,
    user: { _id: userId },
    auth: null,
  } as any);
}

describe("upload.confirmUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteObjectFromR2.mockResolvedValue(undefined);
    getPresignedDownloadUrl.mockImplementation(async (key: string) => `https://s3.example.com/${key}?signed=1`);
    find.mockResolvedValue([]);
  });

  it("creates a new listing and cleans up stale unstarted drafts for the user", async () => {
    const staleDraft = {
      _id: "draft_old",
      status: "uploaded",
      originalImages: [{ s3Key: "uploads/user1/stale.jpg" }],
    };
    find.mockResolvedValue([staleDraft]);
    findOneAndDelete.mockResolvedValue(staleDraft);

    const newListing = {
      _id: "new_1",
      type: "listing_product",
      originalImages: [{ s3Key: "uploads/user1/img1.jpg", url: "https://s3.example.com/uploads/user1/img1.jpg?signed=1" }],
    };
    create.mockResolvedValue(newListing);

    const res = await caller().confirmUpload({
      type: "listing_product",
      originalImages: [
        {
          s3Key: "uploads/user1/img1.jpg",
          fileName: "photo1.jpg",
          url: "https://tmp.url/img1.jpg",
        },
      ],
    });

    // Verified old draft cleaned up
    expect(deleteObjectFromR2).toHaveBeenCalledWith("uploads/user1/stale.jpg");
    // Conditional delete: a draft that generation claimed meanwhile is never deleted
    expect(findOneAndDelete).toHaveBeenCalledWith({ _id: "draft_old", status: "uploaded" });

    // Verified new listing created
    expect(create).toHaveBeenCalledTimes(1);
    expect(res.listingObjectId).toBe("new_1");
  });

  it("updates existing listing when listingObjectId is passed (preventing orphan listings)", async () => {
    const existingListing = {
      _id: "existing_1",
      type: "listing_product",
      status: "uploaded",
      originalImages: [
        { s3Key: "uploads/user1/old-photo.jpg", fileName: "old.jpg" },
      ],
    };
    // findOneAndUpdate returns the document as it was BEFORE the update (new: false)
    findOneAndUpdate.mockResolvedValue(existingListing);
    findById.mockResolvedValue({
      ...existingListing,
      originalImages: [{ s3Key: "uploads/user1/new-photo.jpg", fileName: "new.jpg" }],
    });

    const res = await caller().confirmUpload({
      type: "listing_product",
      listingObjectId: "existing_1",
      originalImages: [
        {
          s3Key: "uploads/user1/new-photo.jpg",
          fileName: "new.jpg",
          url: "https://tmp.url/new.jpg",
        },
      ],
    });

    // Should NOT create a new listing document
    expect(create).not.toHaveBeenCalled();

    // Should delete the replaced image from R2 storage
    expect(deleteObjectFromR2).toHaveBeenCalledWith("uploads/user1/old-photo.jpg");

    // Updated atomically, and only while the listing is still "uploaded"
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "existing_1", userId: "user1", status: "uploaded" },
      { $set: expect.objectContaining({ type: "listing_product" }) },
      { new: false }
    );
    expect(res.listingObjectId).toBe("existing_1");
    expect(res.originalImages[0].s3Key).toBe("uploads/user1/new-photo.jpg");
  });

  it("rejects an upload with image belonging to another user", async () => {
    await expect(
      caller("user1").confirmUpload({
        type: "listing_product",
        originalImages: [
          {
            s3Key: "uploads/user2/stolen.jpg",
            fileName: "stolen.jpg",
            url: "https://tmp.url/stolen.jpg",
          },
        ],
      })
    ).rejects.toThrow("Invalid upload reference");
  });
});
