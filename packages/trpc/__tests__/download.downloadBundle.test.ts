import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();
const runAssetJob = vi.fn();
const checkRateLimit = vi.fn();

const { AssetJobTimeoutError } = vi.hoisted(() => ({
  AssetJobTimeoutError: class AssetJobTimeoutError extends Error {},
}));

vi.mock("@repo/database", () => ({
  ListingObject: {
    findOne: (...args: unknown[]) => findOne(...args),
  },
}));

vi.mock("@repo/services", () => ({
  getPresignedDownloadUrl: vi.fn(),
  runAssetJob: (...args: unknown[]) => runAssetJob(...args),
  AssetJobTimeoutError,
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

import { downloadRouter } from "../server/routes/download/route";

function caller() {
  return downloadRouter.createCaller({
    clerkUserId: "clerk_1",
    user: { _id: "user1" },
    auth: null,
  } as any);
}

describe("download.downloadBundle", () => {
  beforeEach(() => {
    findOne.mockReset();
    checkRateLimit.mockReset().mockResolvedValue({ allowed: true, limit: 30, remaining: 29, resetInSeconds: 0 });
    runAssetJob.mockReset().mockResolvedValue({
      downloadUrl: "https://signed/bundle.zip",
      s3Key: "bundles/list1/listing-kit-list1.zip",
    });
  });

  it("builds the ZIP in the worker and returns the same shape as before", async () => {
    findOne.mockResolvedValue({ _id: "list1", userId: "user1", status: "completed" });

    const res = await caller().downloadBundle({ listingObjectId: "list1" });

    expect(runAssetJob).toHaveBeenCalledWith("bundle-zip", { listingObjectId: "list1", userId: "user1" });
    expect(res).toEqual({
      downloadUrl: "https://signed/bundle.zip",
      s3Key: "bundles/list1/listing-kit-list1.zip",
    });
  });

  it("404s for listings the caller doesn't own", async () => {
    findOne.mockResolvedValue(null);

    await expect(caller().downloadBundle({ listingObjectId: "list1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(findOne).toHaveBeenCalledWith({ _id: "list1", userId: "user1" });
    expect(runAssetJob).not.toHaveBeenCalled();
  });

  it("refuses listings that haven't finished generating", async () => {
    findOne.mockResolvedValue({ _id: "list1", userId: "user1", status: "processing" });

    await expect(caller().downloadBundle({ listingObjectId: "list1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(runAssetJob).not.toHaveBeenCalled();
  });

  it("is rate limited before any work is queued", async () => {
    findOne.mockResolvedValue({ _id: "list1", userId: "user1", status: "completed" });
    checkRateLimit.mockResolvedValue({ allowed: false, limit: 30, remaining: 0, resetInSeconds: 120 });

    await expect(caller().downloadBundle({ listingObjectId: "list1" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(runAssetJob).not.toHaveBeenCalled();
  });

  it("turns a worker timeout into a TIMEOUT error", async () => {
    findOne.mockResolvedValue({ _id: "list1", userId: "user1", status: "completed" });
    runAssetJob.mockRejectedValue(new AssetJobTimeoutError("slow"));

    await expect(caller().downloadBundle({ listingObjectId: "list1" })).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });
});
