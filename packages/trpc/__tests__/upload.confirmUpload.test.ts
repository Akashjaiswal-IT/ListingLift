import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();
const find = vi.fn();
const create = vi.fn();
const deleteOne = vi.fn();
const deleteObjectFromR2 = vi.fn();
const getPresignedDownloadUrl = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: {
    findOne: (...args: unknown[]) => findOne(...args),
    find: (...args: unknown[]) => find(...args),
    create: (...args: unknown[]) => create(...args),
    deleteOne: (...args: unknown[]) => deleteOne(...args),
  },
}));

vi.mock("@repo/services", () => ({
  getPresignedUploadUrl: vi.fn(),
  getPresignedDownloadUrl: (...args: unknown[]) => getPresignedDownloadUrl(...args),
  deleteObjectFromR2: (...args: unknown[]) => deleteObjectFromR2(...args),
  checkRateLimit: vi.fn(),
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
    deleteOne.mockResolvedValue({ deletedCount: 1 });

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
    expect(deleteOne).toHaveBeenCalledWith({ _id: "draft_old" });

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
      save: vi.fn().mockResolvedValue(undefined),
    };
    findOne.mockResolvedValue(existingListing);

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

    // Should update and save the existing listing
    expect(existingListing.save).toHaveBeenCalledTimes(1);
    expect(res.listingObjectId).toBe("existing_1");
    expect(existingListing.originalImages[0].s3Key).toBe("uploads/user1/new-photo.jpg");
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
