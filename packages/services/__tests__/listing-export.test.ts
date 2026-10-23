import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  MARKETPLACE_MAIN_SIZE,
  finishWhiteShot,
  toMarketplaceJpeg,
  cropToBox,
  checkShotQuality,
  measureSharpness,
  flatFieldStats,
  type WhiteShotResult,
} from "../image/listing-export.service";

const PUBLIC = path.resolve(__dirname, "../../../apps/web/public");
const asset = (p: string) => readFileSync(path.join(PUBLIC, p));

const STUDIO_WHITE = asset("hero/studio-white.webp");
const STUDIO_PODIUM = asset("hero/studio-podium.webp");
const RAW_TEAL = asset("hero/raw.webp");
const HERO_AFTER = asset("images/hero-after.jpg");
const HERO_BEFORE = asset("images/hero-before.jpg");
const TEAL_BOX = { x: 0.11, y: 0.15, width: 0.71, height: 0.7 };
const BLACK_BOX = { x: 0.08, y: 0.06, width: 0.78, height: 0.84 };

async function decode(buffer: Buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i]!, data[i + 1]!, data[i + 2]!];
  };
  return { data, info, px };
}

/** Lowest channel value inside the outer `band` pixels. */
async function minBorderValue(buffer: Buffer, band = 10): Promise<number> {
  const { data, info } = await decode(buffer);
  let min = 255;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (x >= band && y >= band && x < info.width - band && y < info.height - band) continue;
      const i = (y * info.width + x) * info.channels;
      min = Math.min(min, data[i]!, data[i + 1]!, data[i + 2]!);
    }
  }
  return min;
}

/** Bounding box of pixels clearly darker than white. */
async function contentBox(buffer: Buffer) {
  const { data, info } = await decode(buffer);
  let x0 = info.width;
  let y0 = info.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (Math.min(data[i]!, data[i + 1]!, data[i + 2]!) < 249) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

async function expectMarketplaceMain(result: WhiteShotResult) {
  const meta = await sharp(result.buffer).metadata();
  expect(meta.format).toBe("jpeg");
  expect(meta.width).toBe(MARKETPLACE_MAIN_SIZE);
  expect(meta.height).toBe(MARKETPLACE_MAIN_SIZE);
  expect(meta.space).toBe("srgb");
  expect(await minBorderValue(result.buffer)).toBe(255);
  const box = await contentBox(result.buffer);
  const fill = Math.max(box.w, box.h) / MARKETPLACE_MAIN_SIZE;
  expect(fill).toBeGreaterThan(0.82);
  expect(fill).toBeLessThan(0.88);
  const half = MARKETPLACE_MAIN_SIZE / 2;
  expect(Math.abs((box.x0 + box.x1) / 2 - half)).toBeLessThan(0.02 * MARKETPLACE_MAIN_SIZE);
  expect(Math.abs((box.y0 + box.y1) / 2 - half)).toBeLessThan(0.02 * MARKETPLACE_MAIN_SIZE);
}

/** A product pixel may only change by resampling (±3) plus the flat-field gain 255/backdrop (never darker). */
function expectGainBounded(actual: number, original: number, backdrop: number) {
  expect(actual).toBeGreaterThanOrEqual(original - 3);
  expect(actual).toBeLessThanOrEqual(Math.ceil((original * 255) / backdrop) + 2);
}

function svgJpeg(svg: string, quality = 92): Promise<Buffer> {
  return sharp(Buffer.from(svg)).jpeg({ quality }).toBuffer();
}

/** 1024 white-backdrop shot: rounded product with a soft contact shadow. */
function productSvg(body: string, size = 1024, backdrop = "rgb(250,250,249)") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs><radialGradient id="s"><stop offset="0" stop-color="#999" stop-opacity="0.7"/><stop offset="1" stop-color="#999" stop-opacity="0"/></radialGradient></defs>
  <rect width="${size}" height="${size}" fill="${backdrop}"/>${body}</svg>`;
}

describe("finishWhiteShot", () => {
  let studio: WhiteShotResult;

  beforeAll(async () => {
    studio = await finishWhiteShot(STUDIO_WHITE);
  });

  it("turns a real near-white Gemini shot into a 2000px marketplace main image", async () => {
    expect(studio.backgroundFailed).toBe(false);
    expect(studio.productCutOff).toBe(false);
    await expectMarketplaceMain(studio);
  });

  it("refuses to recolour a grey gradient backdrop (hero-after): backgroundFailed, letterboxed untouched", async () => {
    const result = await finishWhiteShot(HERO_AFTER);
    expect(result.backgroundFailed).toBe(true);
    expect(result.productCutOff).toBe(false);
    const meta = await sharp(result.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([MARKETPLACE_MAIN_SIZE, MARKETPLACE_MAIN_SIZE]);
    // The grey backdrop is still grey: nothing was recoloured
    const { px } = await decode(result.buffer);
    expect(px(30, 30)[0]).toBeLessThan(235);
  });

  it.each([244, 236, 225])(
    "keeps a light %i panel with LOGO text above a dark base (reviewer two-tone case)",
    async (tone) => {
      const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="rgb(252,252,252)"/>
        <rect x="300" y="200" width="420" height="300" fill="rgb(${tone},${tone},${tone})"/>
        <text x="360" y="380" font-size="70" font-family="Arial" fill="rgb(${tone - 14},${tone - 14},${tone - 14})">LOGO</text>
        <rect x="300" y="500" width="420" height="320" fill="rgb(90,60,40)"/></svg>`;
      const input = await sharp(Buffer.from(svg)).blur(1.2).jpeg({ quality: 95 }).toBuffer();
      const result = await finishWhiteShot(input);
      expect(result.backgroundFailed).toBe(false);
      expect(result.productCutOff).toBe(false);
      await expectMarketplaceMain(result);

      const { px } = await decode(result.buffer);
      let darkTop = 0;
      while (darkTop < 2000 && px(1000, darkTop)[0]! >= 150) darkTop++;
      const box = await contentBox(result.buffer);
      // Framing box includes the light panel: panel (300/620 of the product height) sits above the dark base
      const panelHeight = darkTop - box.y0;
      expect(panelHeight / box.h).toBeGreaterThan(0.45);
      expect(panelHeight / box.h).toBeLessThan(0.52);
      // Panel pixels keep their tone (resampling tolerance), text is still darker than the panel
      const panelSample = px(Math.round(box.x0 + box.w * 0.85), Math.round(box.y0 + panelHeight * 0.2));
      for (const c of panelSample) expectGainBounded(c, tone, 252);
      let minInPanel = 255;
      for (let y = box.y0 + 20; y < darkTop - 20; y += 2) {
        for (let x = box.x0 + 20; x < box.x1 - 20; x += 2) minInPanel = Math.min(minInPanel, px(x, y)[0]!);
      }
      expect(minInPanel).toBeLessThanOrEqual(tone - 9);
    }
  );

  it("never fails or alters a near-white (235) product on a 250 backdrop", async () => {
    const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="rgb(250,250,250)"/>
      <rect x="312" y="212" width="400" height="600" rx="40" fill="rgb(235,235,235)"/></svg>`;
    const input = await sharp(Buffer.from(svg)).blur(1.5).jpeg({ quality: 92 }).toBuffer();
    const result = await finishWhiteShot(input);
    expect(result.backgroundFailed).toBe(false);
    await expectMarketplaceMain(result);
    const { px } = await decode(result.buffer);
    for (const [x, y] of [
      [1000, 1000],
      [500, 300],
      [1500, 1700],
    ] as const) {
      for (const c of px(x, y)) expectGainBounded(c, 235, 250);
    }
  });

  it("does not eat a white (240) product with a soft edge and no outline", async () => {
    const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="rgb(253,253,253)"/>
      <ellipse cx="512" cy="512" rx="260" ry="360" fill="rgb(240,240,240)"/></svg>`;
    const input = await sharp(Buffer.from(svg)).blur(4).jpeg({ quality: 92 }).toBuffer();
    const result = await finishWhiteShot(input);
    expect(result.backgroundFailed).toBe(false);
    const box = await contentBox(result.buffer);
    // The whole ellipse (incl. its soft rim, which is below the near-white threshold) is framed
    expect(Math.max(box.w, box.h) / MARKETPLACE_MAIN_SIZE).toBeGreaterThan(0.82);
    const { px } = await decode(result.buffer);
    for (const c of px(1000, 1000)) expectGainBounded(c, 240, 253);
    for (const c of px(1000, box.y0 + 60)) expect(c).toBeLessThan(246);
  });

  it("flags a busy real photo as backgroundFailed but still returns a 2000px sRGB JPEG", async () => {
    const result = await finishWhiteShot(HERO_BEFORE);
    expect(result.backgroundFailed).toBe(true);
    expect(result.productCutOff).toBe(false);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([MARKETPLACE_MAIN_SIZE, MARKETPLACE_MAIN_SIZE]);
    expect(meta.space).toBe("srgb");
  });

  it("upscales a 1024 synthetic shot with exact white border, centring and 85% fill", async () => {
    const input = await svgJpeg(
      productSvg(`<ellipse cx="512" cy="760" rx="240" ry="36" fill="url(#s)"/>
        <rect x="380" y="250" width="264" height="510" rx="20" fill="rgb(30,90,170)"/>`)
    );
    const result = await finishWhiteShot(input);
    expect(result.backgroundFailed).toBe(false);
    expect(result.productCutOff).toBe(false);
    await expectMarketplaceMain(result);
    // Product colour is preserved (resampling only)
    const { px } = await decode(result.buffer);
    const [r, g, b] = px(1000, 1000);
    expect(Math.abs(r! - 30)).toBeLessThanOrEqual(6);
    expect(Math.abs(g! - 90)).toBeLessThanOrEqual(6);
    expect(Math.abs(b! - 170)).toBeLessThanOrEqual(6);
  });

  it("keeps the contact shadow and fades it into white without hard steps", async () => {
    const input = await svgJpeg(
      productSvg(`<ellipse cx="512" cy="760" rx="300" ry="50" fill="url(#s)"/>
        <rect x="362" y="300" width="300" height="460" fill="rgb(20,20,20)"/>`)
    );
    const result = await finishWhiteShot(input);
    expect(result.backgroundFailed).toBe(false);
    const box = await contentBox(result.buffer);
    const { px } = await decode(result.buffer);
    // Horizontal line through the shadow beside the product: grey near it, white far away, smooth ramp
    const y = box.y1 - Math.round(box.h * 0.04);
    const row: number[] = [];
    for (let x = box.x0 - 40; x < box.x0 + Math.round(box.w * 0.12); x++) row.push(px(x, y)[0]!);
    expect(Math.min(...row)).toBeLessThan(248);
    expect(row[0]).toBeGreaterThanOrEqual(250);
    for (let i = 1; i < row.length; i++) expect(Math.abs(row[i]! - row[i - 1]!)).toBeLessThanOrEqual(12);
  });

  it("does not eat a white product with a darker outline on white", async () => {
    const input = await svgJpeg(
      productSvg(`<ellipse cx="512" cy="780" rx="260" ry="40" fill="url(#s)"/>
        <rect x="330" y="300" width="364" height="480" rx="30" fill="rgb(246,246,244)" stroke="rgb(150,150,150)" stroke-width="4"/>`)
    );
    const result = await finishWhiteShot(input);
    expect(result.backgroundFailed).toBe(false);
    await expectMarketplaceMain(result);
    const { px } = await decode(result.buffer);
    // Inside the outline the product keeps its own off-white, it is not pushed to #FFFFFF
    for (const [x, y] of [
      [1000, 1000],
      [700, 700],
      [1300, 1300],
    ] as const) {
      const [r, g, b] = px(x, y);
      // Off-white body is only gain-corrected like its 250 backdrop, never pushed to #FFFFFF
      expectGainBounded(r!, 246, 250);
      expectGainBounded(g!, 246, 250);
      expectGainBounded(b!, 244, 250);
      expect(Math.min(r!, g!, b!)).toBeLessThan(254);
    }
  });

  it("does not eat a light-grey product whose edge is a dark outline", async () => {
    const input = await svgJpeg(
      productSvg(`<circle cx="512" cy="512" r="300" fill="rgb(232,232,232)" stroke="rgb(90,90,90)" stroke-width="3"/>`)
    );
    const result = await finishWhiteShot(input);
    expect(result.backgroundFailed).toBe(false);
    const { px } = await decode(result.buffer);
    expectGainBounded(px(1000, 1000)[0]!, 232, 250);
    expectGainBounded(px(1000, 400)[0]!, 232, 250);
  });

  it("detects a product cut off by the frame edge", async () => {
    const input = await svgJpeg(productSvg(`<rect x="300" y="400" width="424" height="624" fill="rgb(160,40,40)"/>`));
    const result = await finishWhiteShot(input);
    expect(result.productCutOff).toBe(true);
    expect(result.backgroundFailed).toBe(false);
    expect(await minBorderValue(result.buffer)).toBe(255);
  });

  it("does not flag a product with a small but clear margin as cut off", async () => {
    const input = await svgJpeg(productSvg(`<rect x="40" y="40" width="944" height="944" fill="rgb(160,40,40)"/>`));
    const result = await finishWhiteShot(input);
    expect(result.productCutOff).toBe(false);
  });

  it("finishes a 2048px Pro-mode shot quickly", async () => {
    const big = await sharp(STUDIO_WHITE).resize(2048, 2048).jpeg({ quality: 92 }).toBuffer();
    const started = Date.now();
    const result = await finishWhiteShot(big);
    expect(Date.now() - started).toBeLessThan(3000); // ~0.8s locally; generous for CI
    expect(result.backgroundFailed).toBe(false);
  });

  it("never throws on garbage input", async () => {
    const garbage = Buffer.from("not an image");
    const result = await finishWhiteShot(garbage);
    expect(result.backgroundFailed).toBe(true);
    expect(result.productCutOff).toBe(false);
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it("flat-fields a Gemini-style grey vignette (255 centre -> ~236 edges) instead of failing", async () => {
    const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="v" cx="50%" cy="50%" r="72%">
      <stop offset="0.45" stop-color="rgb(255,255,255)"/><stop offset="1" stop-color="rgb(236,236,236)"/></radialGradient></defs>
      <rect width="100%" height="100%" fill="url(#v)"/><rect x="330" y="250" width="364" height="560" rx="30" fill="rgb(30,90,140)"/></svg>`;
    const input = await svgJpeg(svg);
    const stats = await flatFieldStats(input);
    expect(stats.applied).toBe(true);
    expect(stats.maxGain).toBeLessThanOrEqual(1.12);
    expect(stats.maxGainOnProduct).toBeLessThan(1.05); // the product sits in the bright centre
    const result = await finishWhiteShot(input);
    expect(result.backgroundFailed).toBe(false);
    expect(result.untouched).toBeFalsy();
    await expectMarketplaceMain(result);
    const { px } = await decode(result.buffer);
    const [r, g, b] = px(1000, 1000);
    expectGainBounded(r!, 30, 255 / stats.maxGainOnProduct);
    expectGainBounded(g!, 90, 255 / stats.maxGainOnProduct);
    expectGainBounded(b!, 140, 255 / stats.maxGainOnProduct);
  });

  it("handles an uneven side shadow on the backdrop and keeps the product centred", async () => {
    // Like the first live Gemini output: a soft grey falloff on the lower-left edge (down to ~238)
    const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><defs>
      <radialGradient id="s" cx="0%" cy="72%" r="45%"><stop offset="0" stop-color="rgb(236,236,236)"/><stop offset="1" stop-color="rgb(254,254,254)"/></radialGradient></defs>
      <rect width="100%" height="100%" fill="rgb(254,254,254)"/><rect width="100%" height="100%" fill="url(#s)"/>
      <rect x="352" y="160" width="320" height="700" rx="40" fill="rgb(20,20,22)"/></svg>`;
    const result = await finishWhiteShot(await svgJpeg(svg));
    expect(result.backgroundFailed).toBe(false);
    expect(await minBorderValue(result.buffer)).toBe(255);
    // Centre of the dark product (not of product + shadow) is mid-frame
    const { px } = await decode(result.buffer);
    let x0 = 2000;
    let x1 = -1;
    for (let x = 0; x < 2000; x++) {
      if (px(x, 1000)[0]! < 100) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    }
    expect(Math.abs((x0 + x1) / 2 - 1000)).toBeLessThan(0.02 * MARKETPLACE_MAIN_SIZE);
  });

  it("does not flat-field a genuinely grey backdrop (hero-after)", async () => {
    expect((await flatFieldStats(HERO_AFTER)).applied).toBe(false);
  });

  it("leaves an edge-less white product completely untouched (letterboxed, no retry flags)", async () => {
    const g = (v: number) => `rgb(${v},${v},${v})`;
    const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${g(254)}"/>
      <rect x="300" y="250" width="420" height="560" rx="40" fill="${g(249)}"/>
      <text x="380" y="480" font-size="70" font-family="Arial" fill="${g(247)}">LOGO</text>
      <ellipse cx="512" cy="815" rx="230" ry="14" fill="${g(225)}"/></svg>`;
    const input = await sharp(Buffer.from(svg)).blur(1.5).jpeg({ quality: 95 }).toBuffer();
    const result = await finishWhiteShot(input);
    expect(result.untouched).toBe(true);
    expect(result.backgroundFailed).toBe(false);
    expect(result.productCutOff).toBe(false);
    const meta = await sharp(result.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([MARKETPLACE_MAIN_SIZE, MARKETPLACE_MAIN_SIZE]);
    // Square input fills the frame: output is the input resampled 1024 -> 2000, nothing whitened
    const expected = await decode(
      await sharp(input).resize(MARKETPLACE_MAIN_SIZE, MARKETPLACE_MAIN_SIZE, { kernel: "lanczos3" }).raw().toBuffer().then((raw) =>
        sharp(raw, { raw: { width: MARKETPLACE_MAIN_SIZE, height: MARKETPLACE_MAIN_SIZE, channels: 3 } }).png().toBuffer()
      )
    );
    const actual = await decode(result.buffer);
    let maxDiff = 0;
    for (let y = 500; y < 1580; y += 7) {
      for (let x = 600; x < 1400; x += 7) {
        const a = actual.px(x, y);
        const e = expected.px(x, y);
        for (let c = 0; c < 3; c++) maxDiff = Math.max(maxDiff, Math.abs(a[c]! - e[c]!));
      }
    }
    expect(maxDiff).toBeLessThanOrEqual(3); // JPEG round-off only
    expect(actual.px(1000, 1000)[0]).toBeLessThan(252); // product body stays 249-ish, not pushed to white
  });

  it("returns backgroundFailed for an all-white frame (no product)", async () => {
    const input = await sharp({ create: { width: 512, height: 512, channels: 3, background: "#ffffff" } })
      .jpeg()
      .toBuffer();
    const result = await finishWhiteShot(input);
    expect(result.backgroundFailed).toBe(true);
  });
});

describe("toMarketplaceJpeg", () => {
  it("re-encodes WebP as an sRGB JPEG without resizing", async () => {
    const out = await toMarketplaceJpeg(STUDIO_WHITE);
    const meta = await sharp(out).metadata();
    const src = await sharp(STUDIO_WHITE).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.space).toBe("srgb");
    expect([meta.width, meta.height]).toEqual([src.width, src.height]);
  });

  it("flattens transparency onto white", async () => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    const { px } = await decode(await toMarketplaceJpeg(png));
    expect(px(32, 32)).toEqual([255, 255, 255]);
  });

  it("throws on undecodable input", async () => {
    await expect(toMarketplaceJpeg(Buffer.from("nope"))).rejects.toThrow();
  });
});

describe("cropToBox", () => {
  it("crops to the box plus a 15% margin", async () => {
    const out = await cropToBox(RAW_TEAL, { x: 0.2, y: 0.2, width: 0.5, height: 0.5 });
    expect(out).not.toBeNull();
    const meta = await sharp(out!).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.abs(meta.width! - 675 * 0.65)).toBeLessThanOrEqual(2);
    expect(Math.abs(meta.height! - 900 * 0.65)).toBeLessThanOrEqual(2);
  });

  it("clamps the margin and box to the image", async () => {
    const out = await cropToBox(RAW_TEAL, { x: 0.6, y: 0.5, width: 0.6, height: 0.5 });
    expect(out).not.toBeNull();
    const meta = await sharp(out!).metadata();
    // box clamps to width 0.4; left margin 0.06 -> x from 0.54 to 1.0
    expect(Math.abs(meta.width! - 675 * 0.46)).toBeLessThanOrEqual(2);
    expect(Math.abs(meta.height! - 900 * 0.575)).toBeLessThanOrEqual(2);
  });

  it.each([
    ["missing", null],
    ["undefined", undefined],
    ["NaN", { x: Number.NaN, y: 0.1, width: 0.5, height: 0.5 }],
    ["Infinity", { x: 0.1, y: 0.1, width: Number.POSITIVE_INFINITY, height: 0.5 }],
    ["negative", { x: -0.1, y: 0.1, width: 0.5, height: 0.5 }],
    ["outside 1", { x: 0.1, y: 0.1, width: 1.2, height: 0.5 }],
    ["zero width", { x: 0.1, y: 0.1, width: 0, height: 0.5 }],
    ["too small", { x: 0.4, y: 0.4, width: 0.1, height: 0.1 }],
    ["too large", { x: 0.05, y: 0.05, width: 0.9, height: 0.9 }],
  ])("returns null for a %s box", async (_label, box) => {
    expect(await cropToBox(RAW_TEAL, box as never)).toBeNull();
  });

  it("returns null instead of throwing on undecodable input", async () => {
    expect(await cropToBox(Buffer.from("nope"), { x: 0.2, y: 0.2, width: 0.5, height: 0.5 })).toBeNull();
  });
});

describe("checkShotQuality", () => {
  let tealFinished: Buffer;
  let blackFinished: Buffer;

  beforeAll(async () => {
    tealFinished = (await finishWhiteShot(STUDIO_WHITE)).buffer;
    blackFinished = (await finishWhiteShot(HERO_AFTER)).buffer;
  });

  const base = { original: RAW_TEAL, originalBox: TEAL_BOX, variation: "studio_white" };

  it("passes the real teal pair", async () => {
    expect(await checkShotQuality({ ...base, generated: tealFinished })).toEqual([]);
  });

  it("passes the real black pair (with and without a box)", async () => {
    const params = { generated: blackFinished, original: HERO_BEFORE, variation: "studio_white" };
    expect(await checkShotQuality({ ...params, originalBox: BLACK_BOX })).toEqual([]);
    expect(await checkShotQuality({ ...params, originalBox: null })).toEqual([]);
  });

  it("flags a hue-rotated (teal -> red) product as colour_mismatch", async () => {
    const red = await sharp(tealFinished).modulate({ hue: 120 }).jpeg({ quality: 92 }).toBuffer();
    const problems = await checkShotQuality({ ...base, generated: red });
    expect(problems.map((p) => p.code)).toEqual(["colour_mismatch"]);
    expect(problems[0]!.message).toContain("teal");
  });

  it("flags a black product rendered light as colour_mismatch", async () => {
    const light = await sharp(blackFinished).negate({ alpha: false }).jpeg().toBuffer();
    const problems = await checkShotQuality({
      generated: light,
      original: HERO_BEFORE,
      originalBox: BLACK_BOX,
      variation: "studio_white",
    });
    expect(problems.map((p) => p.code)).toContain("colour_mismatch");
    expect(problems.find((p) => p.code === "colour_mismatch")!.message).toContain("dark/black");
  });

  it("tolerates a warm white-balance shift", async () => {
    const warm = await sharp(tealFinished)
      .recomb([
        [1.15, 0, 0],
        [0, 1, 0],
        [0, 0, 0.9],
      ])
      .jpeg({ quality: 92 })
      .toBuffer();
    expect(await checkShotQuality({ ...base, generated: warm })).toEqual([]);
  });

  it("only checks colour for the studio_white variation", async () => {
    const red = await sharp(tealFinished).modulate({ hue: 120 }).jpeg().toBuffer();
    expect(await checkShotQuality({ ...base, generated: red, variation: "lifestyle" })).toEqual([]);
  });

  it("reports cut_off and background_not_white from finishWhiteShot flags", async () => {
    const problems = await checkShotQuality({
      ...base,
      generated: tealFinished,
      productCutOff: true,
      backgroundFailed: true,
    });
    expect(problems).toEqual([
      {
        code: "cut_off",
        message: "the product is cut off at the edge of the frame; show the whole product with a clear margin around it",
      },
      { code: "background_not_white", message: "the background is not plain white" },
    ]);
  });

  it.each([
    "hero/studio-white.webp",
    "hero/studio-podium.webp",
    "images/hero-after.jpg",
    "images/demo-headphones.webp",
    "images/demo-headphones-lifestyle.webp",
    "images/demo-leather-bag.webp",
    "images/demo-watch-white.webp",
    "images/demo-watch-white-band.webp",
  ])("does not call real Gemini output %s blurry", async (file) => {
    const problems = await checkShotQuality({ ...base, generated: asset(file), variation: "lifestyle" });
    expect(problems).toEqual([]);
    expect(await measureSharpness(asset(file))).toBeGreaterThan(1.2);
  });

  it.each([
    ["white shaded", 225, 200],
    ["cream mug", 232, 215],
    ["black bag", 40, 90],
  ])("does not call a slightly soft (0-1px) %s product blurry after finishing", async (_label, lo, text) => {
    const g = (v: number) => `rgb(${v},${v},${v})`;
    const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="a"><stop offset="0" stop-color="${g(lo)}"/><stop offset="1" stop-color="${g(Math.min(lo + 25, 250))}"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="${g(254)}"/><rect x="300" y="250" width="420" height="560" rx="40" fill="url(#a)"/>
      <text x="380" y="480" font-size="70" font-family="Arial" fill="${g(text)}">LOGO</text><ellipse cx="512" cy="815" rx="230" ry="14" fill="${g(215)}"/></svg>`;
    for (const blur of [0, 0.6, 1.0]) {
      let pipeline = sharp(Buffer.from(svg));
      if (blur) pipeline = pipeline.blur(blur);
      const finished = await finishWhiteShot(await pipeline.jpeg({ quality: 92 }).toBuffer());
      const problems = await checkShotQuality({ ...base, generated: finished.buffer, variation: "lifestyle" });
      expect(problems).toEqual([]);
      const blurred = await sharp(finished.buffer).blur(8).jpeg().toBuffer();
      expect((await checkShotQuality({ ...base, generated: blurred, variation: "lifestyle" })).map((p) => p.code)).toEqual([
        "blurry",
      ]);
    }
  });

  it("skips the blur check when skipBlur is set", async () => {
    const blurred = await sharp(tealFinished).blur(8).jpeg().toBuffer();
    expect(await checkShotQuality({ ...base, generated: blurred, variation: "lifestyle", skipBlur: true })).toEqual([]);
  });

  it("does not call a small sharp product on lots of white blurry", async () => {
    const small = await sharp(tealFinished).resize(400).extend({ top: 800, bottom: 800, left: 800, right: 800, background: "#ffffff" }).jpeg().toBuffer();
    const problems = await checkShotQuality({ ...base, generated: small, variation: "lifestyle" });
    expect(problems).toEqual([]);
  });

  it.each([
    ["matte blue", "rgb(120,150,200)"],
    ["mid grey", "rgb(160,160,160)"],
  ])("does not call a flat, untextured but in-focus %s product blurry; flags it once blurred", async (_label, fill) => {
    const flat = await svgJpeg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#fff"/>
        <rect x="262" y="212" width="500" height="600" rx="30" fill="${fill}"/></svg>`
    );
    const sharpShot = await checkShotQuality({ ...base, generated: flat, variation: "lifestyle" });
    expect(sharpShot).toEqual([]);
    const blurred = await sharp(flat).blur(8).jpeg().toBuffer();
    const blurredShot = await checkShotQuality({ ...base, generated: blurred, variation: "lifestyle" });
    expect(blurredShot.map((p) => p.code)).toEqual(["blurry"]);
  });

  it("flags a heavily blurred shot", async () => {
    for (const source of [tealFinished, STUDIO_PODIUM, HERO_AFTER]) {
      const blurred = await sharp(source).blur(8).jpeg().toBuffer();
      const problems = await checkShotQuality({ ...base, generated: blurred, variation: "lifestyle" });
      expect(problems.map((p) => p.code)).toEqual(["blurry"]);
    }
  });

  it("never throws, even on garbage", async () => {
    const problems = await checkShotQuality({
      generated: Buffer.from("x"),
      original: Buffer.from("y"),
      originalBox: { x: Number.NaN, y: 0, width: 1, height: 1 },
      variation: "studio_white",
    });
    expect(problems).toEqual([]);
  });
});
