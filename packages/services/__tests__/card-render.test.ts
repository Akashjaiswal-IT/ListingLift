import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { renderCardsWithLayout, type CardLayoutReport, type CardRenderParams } from "../card/card-renderer.service";
import { CARD_TEMPLATES } from "../card/card-design";

const PUBLIC = path.resolve(__dirname, "../../../apps/web/public");
const studioShot = fs.readFileSync(path.join(PUBLIC, "hero/studio-white.webp"));
const greyBackdropShot = fs.readFileSync(path.join(PUBLIC, "images/hero-after.jpg"));

const seller = { storeName: "Sharma Bags & Gadgets", whatsappNumber: "9876543210", instagramHandle: "sharmagadgets" };
const base: CardRenderParams = {
  productImage: studioShot,
  productTitle: "Teal School Backpack",
  price: 1499,
  discountPrice: 899,
  sellerInfo: seller,
  trustBadges: { cod: true, freeDelivery: true },
};

async function synthetic(w: number, h: number, productW: number, productH: number, fill: string, stroke: string) {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/>
    <rect x="${(w - productW) / 2}" y="${(h - productH) / 2}" width="${productW}" height="${productH}" rx="24" fill="${fill}" stroke="${stroke}" stroke-width="6"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a, tol = 2) =>
  a.x + tol < b.x + b.w && b.x + tol < a.x + a.w && a.y + tol < b.y + b.h && b.y + tol < a.y + a.h;

function assertCleanLayout(report: CardLayoutReport, label: string) {
  const { boxes, width, height, safeTop, safeBottom } = report;
  const product = boxes.filter((b) => b.kind === "product");
  expect(product, `${label}: exactly one product`).toHaveLength(1);

  for (const b of boxes) {
    expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= width && b.y + b.h <= height, `${label}: box inside card`).toBe(true);
    // Story UI covers the top and bottom bands, so all content stays inside the safe zone.
    expect(b.y >= safeTop && b.y + b.h <= height - safeBottom, `${label}: box inside safe zone`).toBe(true);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      expect(overlaps(boxes[i]!, boxes[j]!), `${label}: ${boxes[i]!.kind}#${i} overlaps ${boxes[j]!.kind}#${j}`).toBe(false);
    }
  }
}

async function renderAndCheck(params: CardRenderParams, label: string) {
  const { cards, layouts } = await renderCardsWithLayout(params);
  const sizes: [Buffer, number, number][] = [
    [cards.whatsappCard, 1080, 1080],
    [cards.instagramPost, 1080, 1350],
    [cards.instagramStory, 1080, 1920],
  ];
  for (const [buf, w, h] of sizes) {
    const meta = await sharp(buf).metadata();
    expect(meta.format, `${label}: JPEG`).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([w, h]);
  }
  for (const [format, report] of Object.entries(layouts)) assertCleanLayout(report, `${label}/${format}`);
  return layouts;
}

describe("card rendering", () => {
  it.each(CARD_TEMPLATES.map((t) => t.id))("%s renders all three sizes with no overlaps", async (templateId) => {
    await renderAndCheck({ ...base, templateId }, templateId);
  }, 60_000);

  const layouts = ["studio-auto", "bold-terracotta", "premium-noir", "utsav-diwali", "utsav-durga-puja"];

  it.each(layouts)("%s copes with a very long title, Hindi copy and every trust badge", async (templateId) => {
    await renderAndCheck(
      {
        ...base,
        templateId,
        language: "hi",
        productTitle: "Premium Multi-Compartment Waterproof Laptop Backpack with USB Charging Port, Rain Cover and Anti-Theft Pocket for Office & College",
        trustBadges: { cod: true, freeDelivery: true, easyReturns: true, madeInIndia: true },
      },
      `${templateId}/long-hi`
    );
  }, 60_000);

  it.each(layouts)("%s copes with no price, no seller details and no badges", async (templateId) => {
    await renderAndCheck({ productImage: studioShot, productTitle: "Teal School Backpack", templateId }, `${templateId}/bare`);
  }, 60_000);

  it.each(layouts)("%s handles tall, wide, white and non-white-background products", async (templateId) => {
    const tall = await synthetic(1024, 1024, 220, 900, "#2B6CB0", "#1A365D");
    const wide = await synthetic(1024, 1024, 960, 260, "#9C4221", "#652B19");
    const white = await synthetic(1024, 1024, 520, 620, "#F4F4F4", "#C9C9C9");
    for (const [name, img] of [["tall", tall], ["wide", wide], ["white", white], ["grey-backdrop", greyBackdropShot]] as const) {
      await renderAndCheck({ ...base, productImage: img, templateId }, `${templateId}/${name}`);
    }
  }, 120_000);

  it("prints only seller facts: no MRP, discount or badges that were not given", async () => {
    const { layouts } = await renderCardsWithLayout({ productImage: studioShot, productTitle: "Teal School Backpack", templateId: "studio-auto" });
    // Title + nothing else: no price row, no header, no chips.
    expect(layouts.whatsapp.boxes.filter((b) => b.kind === "text")).toHaveLength(1);
  }, 60_000);

  it.each(layouts)("%s survives hostile seller text: one unbroken SKU word, control characters and emoji", async (templateId) => {
    await renderAndCheck(
      {
        ...base,
        templateId,
        productTitle: "BAG-TEAL-XL-2025-WATERPROOF-USB-ANTITHEFT-OFFICE-COLLEGE-SCHOOL-PREMIUM\u0000\u0007 🎒🔥✨",
        sellerInfo: { ...seller, storeName: "Sharma\u0000 Bags 🛍️" },
        ctaText: "Order now 👉\u0001",
      },
      `${templateId}/hostile`
    );
  }, 60_000);

  it.each(layouts)("%s keeps a very long store name and handle apart in the header", async (templateId) => {
    await renderAndCheck(
      {
        ...base,
        templateId,
        sellerInfo: {
          storeName: "Shree Ganesh Handicrafts and Traditional Textiles Emporium",
          instagramHandle: "shreeganesh_handicrafts_traditional_textiles_official",
        },
      },
      `${templateId}/long-header`
    );
  }, 60_000);

  it.each(layouts)("%s fits lakh-sized prices", async (templateId) => {
    await renderAndCheck({ ...base, templateId, price: 2499999, discountPrice: 1249999 }, `${templateId}/lakh`);
  }, 60_000);

  it("prints no call to action when the seller gave no way to contact them", async () => {
    const { layouts } = await renderCardsWithLayout({
      productImage: studioShot,
      productTitle: "Teal School Backpack",
      ctaText: "Order on WhatsApp",
      templateId: "studio-auto",
    });
    expect(layouts.whatsapp.boxes.filter((b) => b.kind === "text")).toHaveLength(1);
  }, 60_000);

  it("keeps the product over a fifth of the usable height even with every element", async () => {
    const { layouts } = await renderCardsWithLayout({
      ...base,
      templateId: "studio-auto",
      language: "hi",
      productTitle: "Premium Multi-Compartment Waterproof Laptop Backpack with USB Charging Port, Rain Cover and Anti-Theft Pocket",
      trustBadges: { cod: true, freeDelivery: true, easyReturns: true, madeInIndia: true },
    });
    for (const report of Object.values(layouts)) {
      const p = report.boxes.find((b) => b.kind === "product")!;
      expect(p.h).toBeGreaterThan((report.height - report.safeTop - report.safeBottom) * 0.2);
    }
  }, 60_000);

  it("keeps the product large: at least a fifth of the WhatsApp card on the everyday layout", async () => {
    const { layouts } = await renderCardsWithLayout({ ...base, templateId: "studio-auto" });
    const p = layouts.whatsapp.boxes.find((b) => b.kind === "product")!;
    expect((p.w * p.h) / (1080 * 1080)).toBeGreaterThan(0.2);
  }, 60_000);
});
