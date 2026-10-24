import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();
const updateOne = vi.fn();
const chargeAndClaimListing = vi.fn();
const refundListingCharge = vi.fn();
const enqueueImageGeneration = vi.fn();
const checkRateLimit = vi.fn();
const isQueueOverloaded = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: {
    findOne: (...args: unknown[]) => findOne(...args),
    updateOne: (...args: unknown[]) => updateOne(...args),
  },
}));

vi.mock("@repo/services", async () => {
  const pricing = await import("../../services/credit.service");
  const charges = await import("../../services/charges.service");
  return {
    calculateGenerationCredits: pricing.calculateGenerationCredits,
    RE_EDIT_CREDIT_COST: pricing.RE_EDIT_CREDIT_COST,
    InsufficientCreditsError: pricing.InsufficientCreditsError,
    ListingBusyError: charges.ListingBusyError,
    DEFAULT_TEMPLATE_ID: "studio-auto",
    chargeAndClaimListing: (...args: unknown[]) => chargeAndClaimListing(...args),
    refundListingCharge: (...args: unknown[]) => refundListingCharge(...args),
    chargeAndClaimReEdit: vi.fn(),
    refundReEditCharge: vi.fn(),
    isQueueOverloaded: (...args: unknown[]) => isQueueOverloaded(...args),
    enqueueImageGeneration: (...args: unknown[]) => enqueueImageGeneration(...args),
    enqueueReEdit: vi.fn(),
    checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
    generateListingText: vi.fn(),
    captureServerException: vi.fn(),
    IMAGE_GENERATION_MAX_ATTEMPTS: 3,
  };
});

import { generateRouter } from "../server/routes/generate/route";
import { InsufficientCreditsError } from "../../services/credit.service";
import { ListingBusyError } from "../../services/charges.service";

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
    ...overrides,
  } as Record<string, any>;
}

function resetAll() {
  for (const fn of [findOne, updateOne, chargeAndClaimListing, refundListingCharge, enqueueImageGeneration, checkRateLimit, isQueueOverloaded]) {
    fn.mockReset();
  }
  checkRateLimit.mockResolvedValue({ allowed: true, limit: 10, resetInSeconds: 0 });
  isQueueOverloaded.mockResolvedValue(false);
  updateOne.mockResolvedValue({ acknowledged: true });
  chargeAndClaimListing.mockResolvedValue({ newBalance: 40 });
  enqueueImageGeneration.mockResolvedValue("job1");
}

describe("generate.startGeneration pricing and options", () => {
  beforeEach(resetAll);

  it("uses standard pricing and keepWear=false when the new options are omitted", async () => {
    findOne.mockResolvedValue(makeListing());

    const res = await caller().startGeneration({ listingObjectId: "list1", userTitle: "Bag" });

    expect(res.creditsCharged).toBe(6); // 3-photo kit = 6 studio images
    const params = chargeAndClaimListing.mock.calls[0]![0];
    expect(params.credits).toBe(6);
    expect(params.description).not.toContain("Pro quality");
    expect(params.set).toMatchObject({ keepWear: false, qualityMode: "standard", userTitle: "Bag", retryCount: 0 });
    // The claim re-checks the photo count so the price always matches the photos generated
    expect(params.claimFilter).toMatchObject({ originalImages: { $size: 3 } });
  });

  it("charges the Pro surcharge and claims the listing BEFORE the job is enqueued", async () => {
    findOne.mockResolvedValue(makeListing());

    const res = await caller().startGeneration({
      listingObjectId: "list1",
      userTitle: "Bag",
      keepWear: true,
      qualityMode: "pro",
    });

    expect(res.creditsCharged).toBe(9); // 3-photo kit: 6 + 3
    const params = chargeAndClaimListing.mock.calls[0]![0];
    expect(params.credits).toBe(9);
    expect(params.description).toContain("(Pro quality)");
    expect(params.set).toMatchObject({ keepWear: true, qualityMode: "pro" });
    expect(chargeAndClaimListing.mock.invocationCallOrder[0]).toBeLessThan(
      enqueueImageGeneration.mock.invocationCallOrder[0]!
    );
    // Only the job id is written after enqueue - never a stale copy of the listing
    expect(updateOne).toHaveBeenCalledWith({ _id: "list1" }, { $set: { bullmqJobId: "job1" } });
  });

  it("Quick Generate on Pro costs 4", async () => {
    findOne.mockResolvedValue(makeListing({ type: "listing_product", originalImages: [{}] }));
    const res = await caller().startGeneration({ listingObjectId: "list1", userTitle: "Mug", qualityMode: "pro" });
    expect(res.creditsCharged).toBe(4);
  });

  it("a second tap is rejected (the claim matches once) and nothing is queued", async () => {
    findOne.mockResolvedValue(makeListing());
    chargeAndClaimListing.mockRejectedValue(new ListingBusyError());
    await expect(caller().startGeneration({ listingObjectId: "list1", userTitle: "Bag" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(enqueueImageGeneration).not.toHaveBeenCalled();
  });

  it("insufficient credits is a clean PRECONDITION_FAILED with nothing queued", async () => {
    findOne.mockResolvedValue(makeListing());
    chargeAndClaimListing.mockRejectedValue(new InsufficientCreditsError("Insufficient credits"));
    await expect(caller().startGeneration({ listingObjectId: "list1", userTitle: "Bag" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(enqueueImageGeneration).not.toHaveBeenCalled();
  });

  it("refuses new work before charging when the queue is overloaded", async () => {
    findOne.mockResolvedValue(makeListing());
    isQueueOverloaded.mockResolvedValue(true);
    await expect(caller().startGeneration({ listingObjectId: "list1", userTitle: "Bag" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(chargeAndClaimListing).not.toHaveBeenCalled();
  });

  it("a failed run whose credits are still held can't be started (and charged) again", async () => {
    findOne.mockResolvedValue(makeListing({ status: "failed" }));
    await caller().startGeneration({ listingObjectId: "list1", userTitle: "Bag" });
    const { claimFilter } = chargeAndClaimListing.mock.calls[0]![0];
    expect(claimFilter.$or).toEqual([
      { status: "uploaded" },
      { status: "failed", creditsRefunded: true },
      { status: "failed", creditsCharged: { $in: [0, null] } },
    ]);
  });
});

describe("generate.retry pricing", () => {
  beforeEach(resetAll);

  it("re-charges a refunded failure using the stored Pro quality mode", async () => {
    findOne.mockResolvedValue(makeListing({ status: "failed", creditsRefunded: true, qualityMode: "pro" }));

    await caller().retry({ listingObjectId: "list1" });

    const params = chargeAndClaimListing.mock.calls[0]![0];
    expect(params.credits).toBe(9);
    expect(params.claimFilter).toMatchObject({ status: "failed", creditsRefunded: true });
  });

  it("legacy listings without qualityMode retry at standard price", async () => {
    findOne.mockResolvedValue(makeListing({ status: "failed", creditsRefunded: true }));
    await caller().retry({ listingObjectId: "list1" });
    expect(chargeAndClaimListing.mock.calls[0]![0].credits).toBe(6);
  });

  it("a failure that was never refunded retries for free", async () => {
    findOne.mockResolvedValue(makeListing({ status: "failed", creditsRefunded: false, creditsCharged: 6 }));
    await caller().retry({ listingObjectId: "list1" });
    const params = chargeAndClaimListing.mock.calls[0]![0];
    expect(params.credits).toBe(0);
    expect(params.claimFilter).toMatchObject({ status: "failed", creditsRefunded: { $ne: true } });
  });

  it("refunds the re-charge if the job can't be queued", async () => {
    findOne.mockResolvedValue(makeListing({ status: "failed", creditsRefunded: true }));
    enqueueImageGeneration.mockRejectedValue(new Error("redis down"));
    await expect(caller().retry({ listingObjectId: "list1" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(refundListingCharge).toHaveBeenCalledWith(expect.objectContaining({ listingObjectId: "list1", reason: "not_queued" }));
  });
});
