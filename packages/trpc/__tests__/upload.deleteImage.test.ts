import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();
const deleteObjectFromR2 = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: { findOne: (...args: unknown[]) => findOne(...args) },
}));

vi.mock("@repo/services", () => ({
  getPresignedUploadUrl: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
  deleteObjectFromR2: (...args: unknown[]) => deleteObjectFromR2(...args),
  checkRateLimit: vi.fn(),
  captureServerException: vi.fn(),
}));

import { uploadRouter } from "../server/routes/upload/route";

const OWN_KEY = "uploads/user1/photo-a.jpg";
const OTHER_USERS_KEY = "uploads/user2/secret.jpg";

function makeListing(status = "uploaded") {
  return {
    status,
    originalImages: [{ s3Key: OWN_KEY }, { s3Key: "uploads/user1/photo-b.jpg" }],
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function caller() {
  return uploadRouter.createCaller({
    clerkUserId: "clerk_1",
    user: { _id: "user1" },
    auth: null,
  } as any);
}

describe("upload.deleteImage", () => {
  beforeEach(() => {
    findOne.mockReset();
    deleteObjectFromR2.mockReset();
    deleteObjectFromR2.mockResolvedValue(undefined);
  });

  it("deletes a photo that belongs to the listing", async () => {
    const listing = makeListing();
    findOne.mockResolvedValue(listing);

    const res = await caller().deleteImage({ listingObjectId: "l1", s3Key: OWN_KEY });

    expect(res.success).toBe(true);
    expect(res.remainingImages.map((i: any) => i.s3Key)).toEqual(["uploads/user1/photo-b.jpg"]);
    expect(listing.save).toHaveBeenCalledTimes(1);
    expect(deleteObjectFromR2).toHaveBeenCalledWith(OWN_KEY);
  });

  it("rejects a key from another user and never touches storage", async () => {
    const listing = makeListing();
    findOne.mockResolvedValue(listing);

    await expect(
      caller().deleteImage({ listingObjectId: "l1", s3Key: OTHER_USERS_KEY })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(deleteObjectFromR2).not.toHaveBeenCalled();
    expect(listing.save).not.toHaveBeenCalled();
    expect(listing.originalImages).toHaveLength(2);
  });

  it("rejects a generated image key on the same listing", async () => {
    findOne.mockResolvedValue(makeListing());

    await expect(
      caller().deleteImage({ listingObjectId: "l1", s3Key: "generated/l1/studio_1.webp" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(deleteObjectFromR2).not.toHaveBeenCalled();
  });

  it("still blocks deletes once generation has started", async () => {
    findOne.mockResolvedValue(makeListing("queued"));

    await expect(
      caller().deleteImage({ listingObjectId: "l1", s3Key: OWN_KEY })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(deleteObjectFromR2).not.toHaveBeenCalled();
  });
});
