import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();
const runAssetJob = vi.fn();

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
  // Same rule as the real helper: white studio shot, then any active image, then the original
  pickCardSourceImage: (listing: any) =>
    listing.generatedImages.find((img: any) => img.isLatest !== false && img.variationType === "studio_white") ||
    listing.generatedImages.find((img: any) => img.isLatest !== false) ||
    listing.originalImages[0],
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

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    _id: "list1",
    userId: "user1",
    userTitle: "Handmade Mug",
    price: 999,
    templateId: "minimal-luxury",
    generatedImages: [{ s3Key: "generated/list1/studio_1.jpg", isLatest: true, variationType: "studio_white" }],
    originalImages: [],
    save: vi.fn(),
    ...overrides,
  };
}

const card = (name: string) => ({
  s3Key: `cards/list1/${name}.jpg`,
  url: `https://cdn/cards/list1/${name}.jpg`,
  templateId: "studio-auto",
  generatedAt: new Date("2026-10-26T10:00:00Z"),
});

describe("card.regenerateCards", () => {
  beforeEach(() => {
    findOne.mockReset();
    runAssetJob.mockReset().mockResolvedValue({
      whatsappCard: card("whatsapp"),
      instagramPost: card("ig-post"),
      instagramStory: card("ig-story"),
    });
  });

  it("hands the rendering to the worker and returns the three new cards", async () => {
    findOne.mockResolvedValue(makeListing());

    const res = await caller().regenerateCards({ listingObjectId: "list1", templateId: "diwali-glow" });

    expect(runAssetJob).toHaveBeenCalledWith("regenerate-cards", {
      listingObjectId: "list1",
      userId: "user1",
      templateId: "diwali-glow",
    });
    expect(res).toEqual({
      whatsappCard: card("whatsapp"),
      instagramPost: card("ig-post"),
      instagramStory: card("ig-story"),
    });
  });

  it("keeps the listing's template when none is chosen", async () => {
    findOne.mockResolvedValue(makeListing());

    await caller().regenerateCards({ listingObjectId: "list1" });

    expect(runAssetJob).toHaveBeenCalledWith("regenerate-cards", { listingObjectId: "list1", userId: "user1" });
  });

  it("only looks up listings the caller owns, and 404s otherwise", async () => {
    findOne.mockResolvedValue(null);

    await expect(caller().regenerateCards({ listingObjectId: "list1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(findOne).toHaveBeenCalledWith({ _id: "list1", userId: "user1" });
    expect(runAssetJob).not.toHaveBeenCalled();
  });

  it("rejects listings without any photo before queueing work", async () => {
    findOne.mockResolvedValue(makeListing({ generatedImages: [], originalImages: [] }));

    await expect(caller().regenerateCards({ listingObjectId: "list1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(runAssetJob).not.toHaveBeenCalled();
  });

  it("never saves the listing itself (the worker updates it atomically)", async () => {
    const listing = makeListing();
    findOne.mockResolvedValue(listing);

    await caller().regenerateCards({ listingObjectId: "list1" });

    expect(listing.save).not.toHaveBeenCalled();
  });

  it("turns a worker timeout into a TIMEOUT error with a friendly message", async () => {
    findOne.mockResolvedValue(makeListing());
    runAssetJob.mockRejectedValue(new AssetJobTimeoutError("slow"));

    await expect(caller().regenerateCards({ listingObjectId: "list1" })).rejects.toMatchObject({
      code: "TIMEOUT",
      message: expect.stringMatching(/try again/i),
    });
  });

  it("surfaces a worker failure as an internal error", async () => {
    findOne.mockResolvedValue(makeListing());
    runAssetJob.mockRejectedValue(new Error("R2 down"));

    await expect(caller().regenerateCards({ listingObjectId: "list1" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
