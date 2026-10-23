import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();
const updateOne = vi.fn();
const deductCredits = vi.fn();
const refundCredits = vi.fn();
const enqueueImageGeneration = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: {
    findOne: (...args: unknown[]) => findOne(...args),
    updateOne: (...args: unknown[]) => updateOne(...args),
  },
}));

vi.mock("@repo/services", async () => {
  const pricing = await import("../../services/credit.service");
  return {
    calculateGenerationCredits: pricing.calculateGenerationCredits,
    RE_EDIT_CREDIT_COST: pricing.RE_EDIT_CREDIT_COST,
    DEFAULT_TEMPLATE_ID: "studio-auto",
    deductCredits: (...args: unknown[]) => deductCredits(...args),
    refundCredits: (...args: unknown[]) => refundCredits(...args),
    enqueueImageGeneration: (...args: unknown[]) => enqueueImageGeneration(...args),
    enqueueReEdit: vi.fn(),
    checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
    generateListingText: vi.fn(),
    IMAGE_GENERATION_MAX_ATTEMPTS: 3,
  };
});

import { generateRouter } from "../server/routes/generate/route";

function caller() {
  return generateRouter.createCaller({
    clerkUserId: "clerk_1",
    user: { _id: "user1", creditBalance: 50 },
    auth: null,
  } as any);
}

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    _id: "list1",
    userId: "user1",
    type: "listing_kit",
    status: "uploaded",
    originalImages: [{}, {}, {}],
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as Record<string, any>;
}

describe("generate.startGeneration pricing and options", () => {
  beforeEach(() => {
    for (const fn of [findOne, updateOne, deductCredits, refundCredits, enqueueImageGeneration, checkRateLimit]) {
      fn.mockReset();
    }
    checkRateLimit.mockResolvedValue({ allowed: true, limit: 10, resetInSeconds: 0 });
    updateOne.mockResolvedValue({ acknowledged: true });
    deductCredits.mockResolvedValue({ success: true, newBalance: 40 });
    enqueueImageGeneration.mockResolvedValue("job1");
  });

  it("uses standard pricing and keepWear=false when the new options are omitted", async () => {
    const listing = makeListing();
    findOne.mockResolvedValue(listing);

    const res = await caller().startGeneration({ listingObjectId: "list1", userTitle: "Bag" });

    expect(res.creditsCharged).toBe(6); // 3-photo kit = 6 studio images
    expect(deductCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 6, description: expect.not.stringContaining("Pro quality") })
    );
    expect(updateOne).toHaveBeenCalledWith(
      { _id: "list1" },
      {
        $unset: { generationStage: 1 },
        $set: { retryCount: 0, keepWear: false, qualityMode: "standard" },
      }
    );
    expect(listing.keepWear).toBe(false);
    expect(listing.qualityMode).toBe("standard");
  });

  it("charges the Pro surcharge and persists options before the job is enqueued", async () => {
    const listing = makeListing();
    findOne.mockResolvedValue(listing);

    const res = await caller().startGeneration({
      listingObjectId: "list1",
      userTitle: "Bag",
      keepWear: true,
      qualityMode: "pro",
    });

    expect(res.creditsCharged).toBe(9); // 3-photo kit: 6 + 3
    expect(deductCredits).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 9, description: expect.stringContaining("(Pro quality)") })
    );
    expect(updateOne).toHaveBeenCalledWith(
      { _id: "list1" },
      {
        $unset: { generationStage: 1 },
        $set: { retryCount: 0, keepWear: true, qualityMode: "pro" },
      }
    );
    expect(updateOne.mock.invocationCallOrder[0]).toBeLessThan(
      enqueueImageGeneration.mock.invocationCallOrder[0]!
    );
    expect(listing.keepWear).toBe(true);
    expect(listing.qualityMode).toBe("pro");
    expect(listing.creditsCharged).toBe(9);
  });

  it("Quick Generate on Pro costs 4", async () => {
    findOne.mockResolvedValue(makeListing({ type: "listing_product", originalImages: [{}] }));
    const res = await caller().startGeneration({ listingObjectId: "list1", userTitle: "Mug", qualityMode: "pro" });
    expect(res.creditsCharged).toBe(4);
  });
});

describe("generate.retry pricing", () => {
  beforeEach(() => {
    findOne.mockReset();
    deductCredits.mockReset();
    enqueueImageGeneration.mockReset();
    deductCredits.mockResolvedValue({ success: true, newBalance: 40 });
    enqueueImageGeneration.mockResolvedValue("job2");
  });

  it("re-charges using the stored Pro quality mode", async () => {
    const listing = makeListing({ status: "failed", creditsRefunded: true, qualityMode: "pro" });
    findOne.mockResolvedValue(listing);

    await caller().retry({ listingObjectId: "list1" });

    expect(deductCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 9 }));
    expect(listing.creditsCharged).toBe(9);
  });

  it("legacy listings without qualityMode retry at standard price", async () => {
    const listing = makeListing({ status: "failed", creditsRefunded: true });
    findOne.mockResolvedValue(listing);

    await caller().retry({ listingObjectId: "list1" });

    expect(deductCredits).toHaveBeenCalledWith(expect.objectContaining({ amount: 6 }));
  });
});
