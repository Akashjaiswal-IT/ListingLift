import { describe, it, expect, vi, beforeEach } from "vitest";

const findByIdAndUpdate = vi.fn();

vi.mock("@repo/database", () => ({
  User: {
    findByIdAndUpdate: (...args: unknown[]) => findByIdAndUpdate(...args),
  },
  CreditLedger: {},
  DEFAULT_CARD_SETTINGS: {
    language: "en",
    cod: false,
    freeDelivery: false,
    easyReturns: false,
    madeInIndia: false,
  },
}));

vi.mock("@repo/services", () => ({
  getPresignedUploadUrl: vi.fn(),
  REFERRAL_BONUS_CREDITS: 3,
}));

import { userRouter } from "../server/routes/user/route";

function caller(user: Record<string, unknown> = {}) {
  return userRouter.createCaller({
    clerkUserId: "clerk_1",
    user: { _id: "user1", storeName: "Test Store", ...user },
    auth: null,
  } as any);
}

const DEFAULTS = { language: "en", cod: false, freeDelivery: false, easyReturns: false, madeInIndia: false };

describe("user card settings", () => {
  beforeEach(() => {
    findByIdAndUpdate.mockReset().mockResolvedValue({ _id: "user1" });
  });

  it("getProfile fills card settings with safe defaults for existing users", async () => {
    const profile = await caller().getProfile();
    expect(profile.cardSettings).toEqual(DEFAULTS);
    expect(profile.storeName).toBe("Test Store");
  });

  it("getProfile returns stored card settings", async () => {
    const stored = { language: "hi", cod: true, freeDelivery: true, easyReturns: false, madeInIndia: true };
    const profile = await caller({ cardSettings: stored }).getProfile();
    expect(profile.cardSettings).toEqual(stored);
  });

  it("updateSellerProfile merges a partial cardSettings with defaults", async () => {
    await caller().updateSellerProfile({ cardSettings: { cod: true } });

    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      "user1",
      { $set: { cardSettings: { ...DEFAULTS, cod: true } } },
      { new: true }
    );
  });

  it("updateSellerProfile keeps previously saved settings that were not sent", async () => {
    await caller({
      cardSettings: { language: "hi", cod: true, freeDelivery: false, easyReturns: true, madeInIndia: false },
    }).updateSellerProfile({ cardSettings: { cod: false, madeInIndia: true } });

    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      "user1",
      {
        $set: {
          cardSettings: { language: "hi", cod: false, freeDelivery: false, easyReturns: true, madeInIndia: true },
        },
      },
      { new: true }
    );
  });

  it("updateSellerProfile leaves card settings untouched when not provided", async () => {
    await caller().updateSellerProfile({ storeName: "New Store" });

    expect(findByIdAndUpdate).toHaveBeenCalledWith("user1", { $set: { storeName: "New Store" } }, { new: true });
  });

  it("rejects unknown card languages", async () => {
    await expect(
      caller().updateSellerProfile({ cardSettings: { language: "fr" as any } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
