import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { cutoutWhiteBackground } from "../image/cutout.service";

const SIZE = 400;

function canvas(r: number, g: number, b: number) {
  return sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r, g, b } } });
}

function square(size: number, r: number, g: number, b: number) {
  return sharp({ create: { width: size, height: size, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();
}

async function alphaAt(buffer: Buffer, x: number, y: number): Promise<number> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * 4 + 3]!;
}

describe("cutoutWhiteBackground", () => {
  it("removes a white backdrop around a solid product", async () => {
    const blue = await square(200, 20, 60, 200);
    const input = await canvas(255, 255, 255)
      .composite([{ input: blue, top: 100, left: 100 }])
      .png()
      .toBuffer();

    const { buffer, cutout } = await cutoutWhiteBackground(input);
    expect(cutout).toBe(true);

    // Output is trimmed to the product, so it is smaller than the input
    const meta = await sharp(buffer).metadata();
    expect(meta.hasAlpha).toBe(true);
    expect(meta.width).toBeLessThan(SIZE);
    expect(meta.height).toBeLessThan(SIZE);
    expect(await alphaAt(buffer, Math.floor(meta.width! / 2), Math.floor(meta.height! / 2))).toBe(255);
  });

  it("makes the corner transparent when the product does not fill the frame", async () => {
    // Product off to one side with a wide margin; a dark pixel keeps the bbox large
    const blue = await square(100, 20, 60, 200);
    const input = await canvas(255, 255, 255)
      .composite([
        { input: blue, top: 20, left: 20 },
        { input: blue, top: 280, left: 280 },
      ])
      .png()
      .toBuffer();

    const { buffer, cutout } = await cutoutWhiteBackground(input);
    expect(cutout).toBe(true);
    const meta = await sharp(buffer).metadata();
    // Top-right corner of the trimmed bbox lies in the white gap between the two squares
    expect(await alphaAt(buffer, meta.width! - 1, 0)).toBe(0);
    expect(await alphaAt(buffer, 50, 50)).toBe(255);
  });

  it("keeps a white product body that is enclosed by an outline", async () => {
    const outline = await square(208, 20, 20, 20);
    const white = await square(200, 255, 255, 255);
    const input = await canvas(255, 255, 255)
      .composite([
        { input: outline, top: 96, left: 96 },
        { input: white, top: 100, left: 100 },
      ])
      .png()
      .toBuffer();

    const { buffer, cutout } = await cutoutWhiteBackground(input);
    expect(cutout).toBe(true);
    const meta = await sharp(buffer).metadata();
    expect(await alphaAt(buffer, Math.floor(meta.width! / 2), Math.floor(meta.height! / 2))).toBe(255);
  });

  it("does not cut an image whose border is not white", async () => {
    const input = await canvas(110, 20, 40).png().toBuffer();
    const { buffer, cutout } = await cutoutWhiteBackground(input);
    expect(cutout).toBe(false);
    expect((await sharp(buffer).metadata()).format).toBe("png");
  });

  it("does not cut an all-white image (nothing to keep)", async () => {
    const input = await canvas(255, 255, 255).png().toBuffer();
    const { cutout } = await cutoutWhiteBackground(input);
    expect(cutout).toBe(false);
  });

  it("never throws on invalid input", async () => {
    const { cutout } = await cutoutWhiteBackground(Buffer.from("not an image"));
    expect(cutout).toBe(false);
  });
});
