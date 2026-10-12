import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ExcelJS from "exceljs";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://acct.r2.cloudflarestorage.com/listinglift/x?X-Amz-Signature=abc"),
}));

import { getDeliverableUrl, hasPublicAssetBase, isPublicPrefix } from "../storage/r2.service";
import { generateGenericMarketplaceExcel } from "../export/excel-export.service";

const WORKER = "https://peshkar-assets.example.workers.dev";

describe("public asset URLs", () => {
  const saved = process.env.R2_PUBLIC_URL;
  afterEach(() => {
    process.env.R2_PUBLIC_URL = saved;
  });

  it("only counts a real https public host", () => {
    process.env.R2_PUBLIC_URL = "";
    expect(hasPublicAssetBase()).toBe(false);
    process.env.R2_PUBLIC_URL = "https://pub-YOUR_R2_PUBLIC_URL.r2.dev";
    expect(hasPublicAssetBase()).toBe(false);
    process.env.R2_PUBLIC_URL = "https://5e6ab8.r2.cloudflarestorage.com";
    expect(hasPublicAssetBase()).toBe(false);
    process.env.R2_PUBLIC_URL = "http://localhost:8000";
    expect(hasPublicAssetBase()).toBe(false);
    process.env.R2_PUBLIC_URL = WORKER;
    expect(hasPublicAssetBase()).toBe(true);
  });

  it("treats only generated/ and cards/ as public", () => {
    expect(isPublicPrefix("generated/abc/studio_1.webp")).toBe(true);
    expect(isPublicPrefix("cards/abc/wa.webp")).toBe(true);
    expect(isPublicPrefix("uploads/user/photo.jpg")).toBe(false);
    expect(isPublicPrefix("exports/abc/sheet.xlsx")).toBe(false);
  });

  it("gives permanent links for public files and signed links for private ones", async () => {
    process.env.R2_PUBLIC_URL = WORKER;
    expect(await getDeliverableUrl("generated/abc/studio_1.webp")).toBe(`${WORKER}/generated/abc/studio_1.webp`);
    expect(await getDeliverableUrl("uploads/user/photo.jpg")).toContain("X-Amz-Signature");
  });

  it("falls back to signed links when no public host is configured", async () => {
    process.env.R2_PUBLIC_URL = "";
    expect(await getDeliverableUrl("generated/abc/studio_1.webp")).toContain("X-Amz-Signature");
  });
});

describe("marketplace Excel image links", () => {
  const saved = process.env.R2_PUBLIC_URL;
  beforeEach(() => {
    process.env.R2_PUBLIC_URL = WORKER;
  });
  afterEach(() => {
    process.env.R2_PUBLIC_URL = saved;
  });

  it("lists every current image (white first) and all cards as permanent hyperlinks", async () => {
    const listing: any = {
      _id: "6acbc16cd074245a1b7cd912",
      userTitle: "Bag",
      price: 1499,
      discountPrice: 999,
      generatedImages: [
        { s3Key: "generated/l/premium.webp", url: "expired", variationType: "studio_premium", isLatest: true },
        { s3Key: "generated/l/old.webp", url: "expired", variationType: "studio_white", isLatest: false },
        { s3Key: "generated/l/white.webp", url: "expired", variationType: "studio_white", isLatest: true },
      ],
      whatsappCard: { s3Key: "cards/l/wa.webp" },
      instagramPost: { s3Key: "cards/l/ig.webp" },
      instagramStory: { s3Key: "cards/l/story.webp" },
    };

    const buffer = await generateGenericMarketplaceExcel(listing);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const sheet = wb.getWorksheet("MarketplaceCatalog")!;
    const headers = (sheet.getRow(1).values as any[]).slice(1);
    const row = sheet.getRow(2);
    const cell = (header: string) => row.getCell(headers.indexOf(header) + 1).value as any;

    expect(cell("Image 1 URL (Main - White BG)")).toEqual({
      text: `${WORKER}/generated/l/white.webp`,
      hyperlink: `${WORKER}/generated/l/white.webp`,
    });
    expect(cell("Image 2 URL").hyperlink).toBe(`${WORKER}/generated/l/premium.webp`);
    expect(cell("Image 3 URL")).toBeFalsy(); // superseded re-edit version is not exported
    expect(headers).toContain("Image 6 URL");
    expect(cell("WhatsApp Card URL").hyperlink).toBe(`${WORKER}/cards/l/wa.webp`);
    expect(cell("Instagram Post URL").hyperlink).toBe(`${WORKER}/cards/l/ig.webp`);
    expect(cell("Instagram Story URL").hyperlink).toBe(`${WORKER}/cards/l/story.webp`);
    expect(JSON.stringify(row.values)).not.toContain("expired");
  });
});
