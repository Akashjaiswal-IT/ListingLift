import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const findOne = vi.fn();
const regenerateListingCards = vi.fn();
const createListingBundleZip = vi.fn();
const add = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: { findOne: (...args: unknown[]) => findOne(...args) },
}));

vi.mock("../card/card-regeneration.service", () => ({
  regenerateListingCards: (...args: unknown[]) => regenerateListingCards(...args),
}));

vi.mock("../download/bundle.service", () => ({
  createListingBundleZip: (...args: unknown[]) => createListingBundleZip(...args),
}));

vi.mock("../queue/queue.service", () => ({
  getAssetsQueue: () => ({ add: (...args: unknown[]) => add(...args) }),
  getAssetsQueueEvents: async () => ({}),
}));

import { executeAssetJob, runAssetJob, AssetJobTimeoutError } from "../queue/asset-jobs.service";

describe("executeAssetJob", () => {
  beforeEach(() => {
    findOne.mockReset();
    regenerateListingCards.mockReset().mockResolvedValue({ whatsappCard: {} });
    createListingBundleZip.mockReset().mockResolvedValue({ downloadUrl: "u", s3Key: "k" });
  });

  it("runs card regeneration", async () => {
    await executeAssetJob("regenerate-cards", { listingObjectId: "l1", userId: "u1", templateId: "t" });
    expect(regenerateListingCards).toHaveBeenCalledWith({ listingObjectId: "l1", userId: "u1", templateId: "t" });
  });

  it("builds the bundle for the owner's listing only", async () => {
    const listing = { _id: "l1" };
    findOne.mockResolvedValue(listing);
    const res = await executeAssetJob("bundle-zip", { listingObjectId: "l1", userId: "u1" });
    expect(findOne).toHaveBeenCalledWith({ _id: "l1", userId: "u1" });
    expect(createListingBundleZip).toHaveBeenCalledWith(listing);
    expect(res).toEqual({ downloadUrl: "u", s3Key: "k" });
  });

  it("fails the bundle when the listing is gone", async () => {
    findOne.mockResolvedValue(null);
    await expect(executeAssetJob("bundle-zip", { listingObjectId: "l1", userId: "u1" })).rejects.toThrow(
      "Listing not found"
    );
  });

  it("rejects unknown job names", async () => {
    await expect(executeAssetJob("nope" as any, {} as any)).rejects.toThrow("Unknown asset job");
  });
});

describe("runAssetJob", () => {
  const original = process.env.ASSET_JOBS_INLINE;

  beforeEach(() => {
    add.mockReset();
    regenerateListingCards.mockReset();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ASSET_JOBS_INLINE;
    else process.env.ASSET_JOBS_INLINE = original;
  });

  it("runs in-process when ASSET_JOBS_INLINE=1 (no worker needed)", async () => {
    process.env.ASSET_JOBS_INLINE = "1";
    regenerateListingCards.mockResolvedValue({ whatsappCard: { s3Key: "a" } });

    const res = await runAssetJob("regenerate-cards", { listingObjectId: "l1", userId: "u1" });

    expect(res).toEqual({ whatsappCard: { s3Key: "a" } });
    expect(add).not.toHaveBeenCalled();
  });

  it("queues the job and turns the JSON dates of the result back into Dates", async () => {
    delete process.env.ASSET_JOBS_INLINE;
    const iso = "2026-10-26T10:00:00.000Z";
    add.mockResolvedValue({
      waitUntilFinished: async () => ({
        whatsappCard: { s3Key: "a", generatedAt: iso },
        instagramPost: { s3Key: "b", generatedAt: iso },
        instagramStory: { s3Key: "c", generatedAt: iso },
      }),
    });

    const res = await runAssetJob("regenerate-cards", { listingObjectId: "l1", userId: "u1" });

    expect(add).toHaveBeenCalledWith(
      "regenerate-cards",
      { listingObjectId: "l1", userId: "u1" },
      { jobId: expect.stringMatching(/^regenerate-cards_l1_\d+$/) }
    );
    expect(res.whatsappCard.generatedAt).toEqual(new Date(iso));
    expect(regenerateListingCards).not.toHaveBeenCalled();
  });

  it("throws AssetJobTimeoutError and drops the job if the worker never picked it up", async () => {
    delete process.env.ASSET_JOBS_INLINE;
    const remove = vi.fn();
    add.mockResolvedValue({
      waitUntilFinished: async () => {
        throw new Error("Job wait regenerate-cards timed out before finishing, no finish notification arrived after 50ms");
      },
      getState: async () => "waiting",
      remove,
    });

    await expect(runAssetJob("regenerate-cards", { listingObjectId: "l1", userId: "u1" }, 50)).rejects.toBeInstanceOf(
      AssetJobTimeoutError
    );
    expect(remove).toHaveBeenCalled();
  });

  it("passes a worker failure through unchanged", async () => {
    delete process.env.ASSET_JOBS_INLINE;
    add.mockResolvedValue({
      waitUntilFinished: async () => {
        throw new Error("No product photo available to generate cards");
      },
    });

    await expect(
      runAssetJob("regenerate-cards", { listingObjectId: "l1", userId: "u1" }, 60_000)
    ).rejects.toThrow("No product photo available to generate cards");
  });
});
