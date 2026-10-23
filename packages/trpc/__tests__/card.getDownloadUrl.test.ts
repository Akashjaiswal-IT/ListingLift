import { describe, it, expect, vi, beforeEach } from "vitest";

const exists = vi.fn();
const getPresignedDownloadUrl = vi.fn();

vi.mock("@repo/database", () => ({
  ListingObject: { exists: (...args: unknown[]) => exists(...args) },
  Types: { ObjectId: { isValid: (id: string) => /^[a-f0-9]{24}$/.test(id) } },
}));

vi.mock("@repo/services", () => ({
  fetchBufferFromR2: vi.fn(),
  uploadBufferToR2: vi.fn(),
  renderSocialCards: vi.fn(),
  getPresignedDownloadUrl: (...args: unknown[]) => getPresignedDownloadUrl(...args),
  deleteObjectFromR2: vi.fn(),
}));

import { cardRouter } from "../server/routes/card/route";

const USER = "aaaaaaaaaaaaaaaaaaaaaaaa";
const MY_LISTING = "bbbbbbbbbbbbbbbbbbbbbbbb";
const OTHER_LISTING = "cccccccccccccccccccccccc";

const caller = () =>
  cardRouter.createCaller({ clerkUserId: "clerk_1", user: { _id: USER }, auth: null } as any);

describe("card.getDownloadUrl", () => {
  beforeEach(() => {
    exists.mockReset().mockImplementation(async (q: { _id: string }) => (q._id === MY_LISTING ? { _id: q._id } : null));
    getPresignedDownloadUrl.mockReset().mockResolvedValue("https://signed.example/file");
  });

  it("signs the caller's own uploads, generated images and cards", async () => {
    for (const key of [`uploads/${USER}/photo.jpg`, `generated/${MY_LISTING}/studio_1.jpg`, `cards/${MY_LISTING}/wa.jpg`]) {
      await expect(caller().getDownloadUrl({ s3Key: key })).resolves.toEqual({ downloadUrl: "https://signed.example/file" });
    }
    expect(exists).toHaveBeenCalledWith({ _id: MY_LISTING, userId: USER });
  });

  it("refuses another seller's files and arbitrary keys", async () => {
    for (const key of [
      "uploads/dddddddddddddddddddddddd/photo.jpg",
      `generated/${OTHER_LISTING}/studio_1.jpg`,
      `cards/${OTHER_LISTING}/wa.jpg`,
      "cards/not-an-id/wa.jpg",
      "secrets/config.json",
      `uploads/${USER}/../../other/file.jpg`,
    ]) {
      await expect(caller().getDownloadUrl({ s3Key: key })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(getPresignedDownloadUrl).not.toHaveBeenCalled();
  });
});
