import { describe, it, expect, vi, beforeEach } from "vitest";

const find = vi.fn();
const countDocuments = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: {
    find: (...args: unknown[]) => find(...args),
    countDocuments: (...args: unknown[]) => countDocuments(...args),
    findOne: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@repo/services", () => ({
  deleteObjectFromR2: vi.fn(),
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
    user: { _id: "user1" },
    auth: null,
  } as any);
}

describe("listing.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters out status: 'uploaded' by default to prevent orphan empty cards in History", async () => {
    const chainable = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { _id: "l1", status: "completed", userTitle: "Product 1" },
      ]),
    };
    find.mockReturnValue(chainable);
    countDocuments.mockResolvedValue(1);

    const res = await caller().list({ page: 1, limit: 10 });

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user1",
        status: { $ne: "uploaded" },
      })
    );
    expect(countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user1",
        status: { $ne: "uploaded" },
      })
    );
    expect(res.items).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it("allows querying by a specific status when explicitly requested", async () => {
    const chainable = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { _id: "l2", status: "completed", userTitle: "Completed Product" },
      ]),
    };
    find.mockReturnValue(chainable);
    countDocuments.mockResolvedValue(1);

    await caller().list({ page: 1, limit: 10, status: "completed" });

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user1",
        status: "completed",
      })
    );
  });
});
