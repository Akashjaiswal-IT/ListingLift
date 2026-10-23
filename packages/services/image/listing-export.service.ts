import sharp from "sharp";
import type { ProductBox } from "../ai/product-inventory";

/** Longest side of the exported main (white) image, in pixels. */
export const MARKETPLACE_MAIN_SIZE = 2000;

const PRODUCT_FILL = 0.85; // product's longer side as a share of the frame
const JPEG_MAIN = { quality: 92, chromaSubsampling: "4:4:4" as const };
// Only pixels this close to white may ever change. Real Gemini backdrops measure luma 253-255, chroma <= 3.
const NEAR_WHITE_LUMA = 246;
// After flat-fielding the backdrop sits at ~255, so a stricter cut keeps light product panels (244 -> ~247) intact
const NEAR_WHITE_LUMA_FLAT = 250;
const NEAR_WHITE_CHROMA = 6;
const FLAT_BAND = 0.035; // share of the side used as the backdrop sample band for the illumination fit
const FLAT_MIN_BACKDROP_SHARE = 0.9;
const FLAT_MAX_GAIN = 1.12; // never darken; never brighten more than a gentle vignette correction
const BORDER_BAND = 3; // px of the input frame checked for a clean white backdrop
const MAX_BORDER_NOT_WHITE = 0.02;

export interface WhiteShotResult {
  /** sRGB JPEG, MARKETPLACE_MAIN_SIZE square, background exactly #FFFFFF, product ~85% of frame. */
  buffer: Buffer;
  /** True when the product touched the frame edge in the generated image (Gemini cropped it). */
  productCutOff: boolean;
  /** True when the backdrop is not near-white (nothing is recoloured; the input is letterboxed instead). */
  backgroundFailed: boolean;
  /**
   * True when the backdrop detection looked untrustworthy (e.g. an edge-less white product), so the
   * input was only letterboxed onto white with no pixel changed. Callers should skip the blur check.
   */
  untouched?: boolean;
}

interface RgbImage {
  data: Uint8Array;
  width: number;
  height: number;
}

interface Box {
  x0: number;
  y0: number;
  x1: number; // inclusive
  y1: number; // inclusive
}

// ---------- pixel helpers ----------

async function decodeRgb(input: Buffer): Promise<RgbImage> {
  const { data, info } = await sharp(input)
    .rotate()
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error(`expected 3 channels, got ${info.channels}`);
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

function lumaAndChroma(img: RgbImage): { luma: Uint8Array; chroma: Uint8Array } {
  const n = img.width * img.height;
  const luma = new Uint8Array(n);
  const chroma = new Uint8Array(n);
  const d = img.data;
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    luma[p] = (r * 77 + g * 150 + b * 29 + 128) >> 8;
    chroma[p] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  return { luma, chroma };
}

function borderIndices(width: number, height: number, band: number): Int32Array {
  const list: number[] = [];
  for (let y = 0; y < height; y++) {
    const full = y < band || y >= height - band;
    for (let x = 0; x < width; x++) {
      if (!full && x === band) x = width - band;
      list.push(y * width + x);
    }
  }
  return Int32Array.from(list);
}

function percentile(values: Uint8Array | number[], q: number): number {
  const sorted = Array.from(values).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))]!;
}

function smoothstep(lo: number, hi: number, v: number): number {
  if (v <= lo) return 0;
  if (v >= hi) return 1;
  const t = (v - lo) / (hi - lo);
  return t * t * (3 - 2 * t);
}

function isNearWhite(luma: number, chroma: number, minLuma = NEAR_WHITE_LUMA): boolean {
  return luma >= minLuma && chroma <= NEAR_WHITE_CHROMA;
}

// ---------- flat-field (vignette / uneven backdrop lighting) correction ----------

/**
 * Backdrop illumination sampled along the four edges (smoothed luma per column/row), blended
 * inward with a Coons patch: matches the border exactly and varies smoothly inside.
 */
interface Field {
  width: number;
  height: number;
  top: Float32Array;
  bottom: Float32Array;
  left: Float32Array;
  right: Float32Array;
}

/** Fill gaps (NaN) by linear interpolation, then box-smooth; false when the profile has no samples. */
function finishProfile(values: Float32Array, window: number): boolean {
  const n = values.length;
  let prev = -1;
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(values[i]!)) continue;
    if (prev === -1) for (let k = 0; k < i; k++) values[k] = values[i]!;
    else for (let k = prev + 1; k < i; k++) values[k] = values[prev]! + ((values[i]! - values[prev]!) * (k - prev)) / (i - prev);
    prev = i;
  }
  if (prev === -1) return false;
  for (let k = prev + 1; k < n; k++) values[k] = values[prev]!;
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i]! + values[i]!;
  const half = Math.max(1, Math.round(window / 2));
  const smoothed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(n, i + half + 1);
    smoothed[i] = (prefix[b]! - prefix[a]!) / (b - a);
  }
  values.set(smoothed);
  return true;
}

/**
 * Measures the backdrop lighting in the outer band. Null when the band is not a near-white
 * backdrop (then nothing is corrected and the strict rules decide).
 */
function fitBackdropField(img: RgbImage, luma: Uint8Array, chroma: Uint8Array): Field | null {
  const { width, height } = img;
  const band = Math.max(2, Math.round(FLAT_BAND * Math.min(width, height)));
  const isBackdrop = (p: number) => chroma[p]! <= 8 && luma[p]! >= 222;
  let total = 0;
  let good = 0;
  const profile = (length: number, at: (i: number, d: number) => number): Float32Array => {
    const values = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      let count = 0;
      for (let d = 0; d < band; d++) {
        const p = at(i, d);
        total++;
        if (!isBackdrop(p)) continue;
        good++;
        sum += luma[p]!;
        count++;
      }
      // Need most of the band depth to be backdrop, else this position is product/shadow: interpolate
      values[i] = count >= band * 0.6 ? sum / count : Number.NaN;
    }
    return values;
  };
  const top = profile(width, (x, d) => d * width + x);
  const bottom = profile(width, (x, d) => (height - 1 - d) * width + x);
  const left = profile(height, (y, d) => y * width + d);
  const right = profile(height, (y, d) => y * width + width - 1 - d);
  if (good < FLAT_MIN_BACKDROP_SHARE * total) return null;
  const window = 0.03 * Math.min(width, height);
  for (const p of [top, bottom, left, right]) if (!finishProfile(p, window)) return null;
  return { width, height, top, bottom, left, right };
}

function fieldAt(f: Field, x: number, y: number): number {
  const u = f.width > 1 ? x / (f.width - 1) : 0;
  const v = f.height > 1 ? y / (f.height - 1) : 0;
  const tl = (f.top[0]! + f.left[0]!) / 2;
  const tr = (f.top[f.width - 1]! + f.right[0]!) / 2;
  const bl = (f.bottom[0]! + f.left[f.height - 1]!) / 2;
  const br = (f.bottom[f.width - 1]! + f.right[f.height - 1]!) / 2;
  return (
    (1 - v) * f.top[x]! +
    v * f.bottom[x]! +
    (1 - u) * f.left[y]! +
    u * f.right[y]! -
    ((1 - u) * (1 - v) * tl + u * (1 - v) * tr + (1 - u) * v * bl + u * v * br)
  );
}

function gainAt(f: Field, x: number, y: number): number {
  const value = fieldAt(f, x, y);
  if (!(value > 0)) return FLAT_MAX_GAIN;
  return Math.min(FLAT_MAX_GAIN, Math.max(1, 255 / value));
}

/** The same smooth gain on R, G and B of every pixel: hue preserved, nothing ever darkened. */
function applyFlatField(img: RgbImage, field: Field): RgbImage {
  const { data, width, height } = img;
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gain = gainAt(field, x, y);
      const i = (y * width + x) * 3;
      if (gain === 1) {
        out[i] = data[i]!;
        out[i + 1] = data[i + 1]!;
        out[i + 2] = data[i + 2]!;
        continue;
      }
      out[i] = Math.min(255, Math.round(data[i]! * gain));
      out[i + 1] = Math.min(255, Math.round(data[i + 1]! * gain));
      out[i + 2] = Math.min(255, Math.round(data[i + 2]! * gain));
    }
  }
  return { data: out, width, height };
}

/**
 * Diagnostics: whether a flat-field gain would be applied, its maximum, and its maximum on
 * product pixels (non-backdrop-like pixels of the uncorrected image).
 */
export async function flatFieldStats(
  input: Buffer
): Promise<{ applied: boolean; maxGain: number; maxGainOnProduct: number }> {
  const img = await decodeRgb(input);
  const { luma, chroma } = lumaAndChroma(img);
  const field = fitBackdropField(img, luma, chroma);
  if (!field) return { applied: false, maxGain: 1, maxGainOnProduct: 1 };
  let maxGain = 1;
  let maxGainOnProduct = 1;
  for (let y = 0; y < img.height; y += 2) {
    for (let x = 0; x < img.width; x += 2) {
      const gain = gainAt(field, x, y);
      maxGain = Math.max(maxGain, gain);
      const p = y * img.width + x;
      if (luma[p]! < 200 || chroma[p]! > 24) maxGainOnProduct = Math.max(maxGainOnProduct, gain);
    }
  }
  return { applied: true, maxGain, maxGainOnProduct };
}

/** Backdrop = near-white pixels connected to the border through near-white pixels (4-connected). */
function floodNearWhite(width: number, height: number, nearWhite: Uint8Array, border: Int32Array): Uint8Array {
  const n = width * height;
  const mask = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  for (const s of border) {
    if (nearWhite[s] && !mask[s]) {
      mask[s] = 1;
      stack[top++] = s;
    }
  }
  while (top > 0) {
    const p = stack[--top]!;
    const x = p % width;
    if (x > 0 && nearWhite[p - 1] && !mask[p - 1]) {
      mask[p - 1] = 1;
      stack[top++] = p - 1;
    }
    if (x < width - 1 && nearWhite[p + 1] && !mask[p + 1]) {
      mask[p + 1] = 1;
      stack[top++] = p + 1;
    }
    if (p >= width && nearWhite[p - width] && !mask[p - width]) {
      mask[p - width] = 1;
      stack[top++] = p - width;
    }
    if (p < n - width && nearWhite[p + width] && !mask[p + width]) {
      mask[p + width] = 1;
      stack[top++] = p + width;
    }
  }
  return mask;
}

interface Content {
  /** Union box of kept content components (product + shadow). */
  box: Box;
  /** 1 for pixels of kept content components. */
  mask: Uint8Array;
}

/**
 * Content = everything that is not whitened backdrop. Only tiny, faint specks (JPEG noise left
 * inside the backdrop) are ignored; any component with real colour or darkness is kept.
 */
function findContent(img: RgbImage, backdrop: Uint8Array, luma: Uint8Array, chroma: Uint8Array): Content | null {
  const { width, height } = img;
  const n = width * height;
  const label = new Int32Array(n);
  const stack = new Int32Array(n);
  const keep = new Uint8Array(n);
  const maxSpeck = Math.max(4, Math.round(n * 0.00002));
  let box: Box | null = null;
  let id = 0;
  const members: number[] = [];
  for (let s = 0; s < n; s++) {
    if (backdrop[s] || label[s]) continue;
    id++;
    members.length = 0;
    const cbox: Box = { x0: width, y0: height, x1: -1, y1: -1 };
    let faint = true;
    let top = 0;
    label[s] = id;
    stack[top++] = s;
    while (top > 0) {
      const p = stack[--top]!;
      members.push(p);
      const x = p % width;
      const y = (p - x) / width;
      if (x < cbox.x0) cbox.x0 = x;
      if (x > cbox.x1) cbox.x1 = x;
      if (y < cbox.y0) cbox.y0 = y;
      if (y > cbox.y1) cbox.y1 = y;
      if (luma[p]! < 225 || chroma[p]! > 20) faint = false;
      if (x > 0 && !backdrop[p - 1] && !label[p - 1]) {
        label[p - 1] = id;
        stack[top++] = p - 1;
      }
      if (x < width - 1 && !backdrop[p + 1] && !label[p + 1]) {
        label[p + 1] = id;
        stack[top++] = p + 1;
      }
      if (p >= width && !backdrop[p - width] && !label[p - width]) {
        label[p - width] = id;
        stack[top++] = p - width;
      }
      if (p < n - width && !backdrop[p + width] && !label[p + width]) {
        label[p + width] = id;
        stack[top++] = p + width;
      }
    }
    if (faint && members.length <= maxSpeck) continue;
    for (const p of members) keep[p] = 1;
    box = box
      ? {
          x0: Math.min(box.x0, cbox.x0),
          y0: Math.min(box.y0, cbox.y0),
          x1: Math.max(box.x1, cbox.x1),
          y1: Math.max(box.y1, cbox.y1),
        }
      : cbox;
  }
  return box ? { box, mask: keep } : null;
}

/**
 * The backdrop is clean when the input's outer band is (almost) all whitened backdrop. A larger
 * non-white share is still accepted when it is clearly product (dark or coloured) cut by the frame.
 */
function backdropIsClean(border: Int32Array, backdrop: Uint8Array, luma: Uint8Array, chroma: Uint8Array): boolean {
  let notWhite = 0;
  let productLike = 0;
  for (const p of border) {
    if (backdrop[p]) continue;
    notWhite++;
    if (luma[p]! < 200 || chroma[p]! > 24) productLike++;
  }
  const share = notWhite / border.length;
  if (share <= MAX_BORDER_NOT_WHITE) return true;
  return share <= 0.35 && productLike >= 0.5 * notWhite;
}

/** Content reaches within ~0.5% of an input edge along at least 1% of that side. */
function touchesFrame(content: Content, width: number, height: number): boolean {
  const { box, mask } = content;
  const mx = Math.max(2, Math.ceil(0.005 * width));
  const my = Math.max(2, Math.ceil(0.005 * height));
  if (box.x0 >= mx && box.y0 >= my && box.x1 < width - mx && box.y1 < height - my) return false;
  const countBand = (x0: number, x1: number, y0: number, y1: number, alongX: boolean): number => {
    const hit = new Uint8Array(alongX ? width : height);
    let count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const k = alongX ? x : y;
        if (mask[y * width + x] && !hit[k]) {
          hit[k] = 1;
          count++;
        }
      }
    }
    return count;
  };
  const minX = Math.max(3, Math.round(0.01 * width));
  const minY = Math.max(3, Math.round(0.01 * height));
  return (
    countBand(0, width, 0, my, true) >= minX ||
    countBand(0, width, height - my, height, true) >= minX ||
    countBand(0, mx, 0, height, false) >= minY ||
    countBand(width - mx, width, 0, height, false) >= minY
  );
}

/** Ramp backdrop pixels from NEAR_WHITE_LUMA (unchanged) to exactly 255; nothing else is touched. */
function whitenBackdrop(
  img: RgbImage,
  backdrop: Uint8Array,
  luma: Uint8Array,
  border: Int32Array,
  lo: number
): Uint8Array {
  const borderLuma: number[] = [];
  for (const p of border) if (backdrop[p]) borderLuma.push(luma[p]!);
  const hi = Math.min(252, Math.max(lo + 1, percentile(borderLuma, 0.1) - 1));
  const out = img.data.slice();
  const { data } = img;
  for (let p = 0; p < backdrop.length; p++) {
    if (!backdrop[p]) continue;
    const w = smoothstep(lo, hi, luma[p]!);
    if (w === 0) continue;
    const i = p * 3;
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(data[i + c]! + (255 - data[i + c]!) * w);
  }
  return out;
}

/**
 * Horizontal centre of the clearly-product pixels (dark or coloured). A soft side shadow then does
 * not push the product off-centre. Undefined for light products where those pixels are only details.
 */
function productCentreX(img: RgbImage, content: Content, luma: Uint8Array, chroma: Uint8Array): number | undefined {
  const { box, mask } = content;
  let x0 = img.width;
  let x1 = -1;
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const p = y * img.width + x;
      if (!mask[p] || (luma[p]! >= 200 && chroma[p]! <= 24)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
  }
  if (x1 < x0 || x1 - x0 + 1 < 0.6 * (box.x1 - box.x0 + 1)) return undefined;
  return (x0 + x1 + 1) / 2;
}

// ---------- framing / encoding ----------

async function encodeMain(raw: Uint8Array, size: number): Promise<Buffer> {
  return sharp(Buffer.from(raw.buffer, raw.byteOffset, raw.length), { raw: { width: size, height: size, channels: 3 } })
    .toColourspace("srgb")
    .withIccProfile("srgb")
    .jpeg(JPEG_MAIN)
    .toBuffer();
}

/**
 * Centre the content box, scale its longer side to 85% of the frame (lanczos3 only, no sharpening).
 * Outside the box there is only near-white backdrop; it fades to exact #FFFFFF over a short pad.
 */
async function frameOnWhite(img: RgbImage, out: Uint8Array, box: Box, centreX?: number): Promise<Buffer> {
  const size = MARKETPLACE_MAIN_SIZE;
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;
  const side = Math.max(bw, bh) / PRODUCT_FILL; // source pixels covered by the output square
  const scale = size / side;
  let left = (box.x0 + box.x1 + 1) / 2 - side / 2;
  if (centreX !== undefined) {
    // Centre on the product, but keep the whole content box (incl. shadow) 5% inside the frame
    const lo = box.x1 + 1 - 0.95 * side;
    const hi = box.x0 - 0.05 * side;
    if (lo <= hi) left = Math.min(hi, Math.max(lo, centreX - side / 2));
  }
  const top = (box.y0 + box.y1 + 1) / 2 - side / 2;

  const cx0 = Math.max(0, Math.ceil(left));
  const cy0 = Math.max(0, Math.ceil(top));
  const cx1 = Math.min(img.width, Math.floor(left + side));
  const cy1 = Math.min(img.height, Math.floor(top + side));
  const ox = Math.round((cx0 - left) * scale);
  const oy = Math.round((cy0 - top) * scale);
  const pw = Math.max(1, Math.min(size - ox, Math.round((cx1 - cx0) * scale)));
  const ph = Math.max(1, Math.min(size - oy, Math.round((cy1 - cy0) * scale)));

  const piece = await sharp(Buffer.from(out.buffer, out.byteOffset, out.length), {
    raw: { width: img.width, height: img.height, channels: 3 },
  })
    .extract({ left: cx0, top: cy0, width: cx1 - cx0, height: cy1 - cy0 })
    .resize(pw, ph, { kernel: "lanczos3", fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const canvas = new Uint8Array(size * size * 3).fill(255);
  const rowLen = Math.min(piece.info.width, size - ox) * 3;
  for (let y = 0; y < piece.info.height && oy + y < size; y++) {
    const src = y * piece.info.width * 3;
    canvas.set(piece.data.subarray(src, src + rowLen), ((oy + y) * size + ox) * 3);
  }

  const pad = Math.round(0.015 * size);
  const fx0 = Math.floor((box.x0 - left) * scale) - pad;
  const fy0 = Math.floor((box.y0 - top) * scale) - pad;
  const fx1 = Math.ceil((box.x1 + 1 - left) * scale) + pad;
  const fy1 = Math.ceil((box.y1 + 1 - top) * scale) + pad;
  for (let y = 0; y < size; y++) {
    const dy = y < fy0 ? fy0 - y : y > fy1 ? y - fy1 : 0;
    for (let x = 0; x < size; x++) {
      const dx = x < fx0 ? fx0 - x : x > fx1 ? x - fx1 : 0;
      if (dx === 0 && dy === 0) {
        x = Math.max(x, fx1);
        continue;
      }
      const t = Math.min(1, Math.max(dx, dy) / pad);
      const i = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) canvas[i + c] = t >= 1 ? 255 : Math.round(canvas[i + c]! + (255 - canvas[i + c]!) * t);
    }
  }
  return encodeMain(canvas, size);
}

async function letterboxOnWhite(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(MARKETPLACE_MAIN_SIZE, MARKETPLACE_MAIN_SIZE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255 },
      kernel: "lanczos3",
    })
    .toColourspace("srgb")
    .withIccProfile("srgb")
    .jpeg(JPEG_MAIN)
    .toBuffer();
}

async function failedShot(input: Buffer): Promise<WhiteShotResult> {
  let buffer = input;
  try {
    buffer = await letterboxOnWhite(input);
  } catch {
    // undecodable input: hand back what we were given; backgroundFailed tells the caller
  }
  return { buffer, productCutOff: false, backgroundFailed: true };
}

/**
 * Gemini always centres the product. A mostly-backdrop centre, a tiny content box or a sliver
 * means the flood probably swallowed an edge-less white product, so the result can't be trusted.
 */
function floodLooksWrong(img: RgbImage, backdrop: Uint8Array, box: Box): boolean {
  const { width, height } = img;
  const cx0 = Math.floor(width * 0.32);
  const cx1 = Math.ceil(width * 0.68);
  const cy0 = Math.floor(height * 0.32);
  const cy1 = Math.ceil(height * 0.68);
  let centre = 0;
  let centreBackdrop = 0;
  for (let y = cy0; y < cy1; y++) {
    for (let x = cx0; x < cx1; x++) {
      centre++;
      centreBackdrop += backdrop[y * width + x]!;
    }
  }
  if (centreBackdrop > 0.85 * centre) return true;
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;
  if (bw * bh < 0.03 * width * height) return true;
  return Math.max(bw, bh) / Math.min(bw, bh) > 6;
}

/** Letterbox the unmodified input onto white: no whitening, no reframing, no retry. */
async function untouchedShot(input: Buffer): Promise<WhiteShotResult> {
  try {
    return { buffer: await letterboxOnWhite(input), productCutOff: false, backgroundFailed: false, untouched: true };
  } catch {
    return failedShot(input);
  }
}

/**
 * Turns a Gemini "studio_white" shot into a marketplace main image: pure #FFFFFF backdrop,
 * product centred at 85% of a 2000px square. Only near-white backdrop pixels connected to the
 * border are changed; every other pixel is only resampled. Never throws.
 */
export async function finishWhiteShot(input: Buffer): Promise<WhiteShotResult> {
  try {
    const raw = await decodeRgb(input);
    const rawStats = lumaAndChroma(raw);
    // Flat-field a vignetted near-white backdrop first; skipped when the border is not backdrop-like
    const field = fitBackdropField(raw, rawStats.luma, rawStats.chroma);
    const img = field ? applyFlatField(raw, field) : raw;
    const { luma, chroma } = field ? lumaAndChroma(img) : rawStats;
    const whiteFrom = field ? NEAR_WHITE_LUMA_FLAT : NEAR_WHITE_LUMA;
    const n = img.width * img.height;
    const nearWhite = new Uint8Array(n);
    for (let p = 0; p < n; p++) nearWhite[p] = isNearWhite(luma[p]!, chroma[p]!, whiteFrom) ? 1 : 0;

    const border = borderIndices(img.width, img.height, BORDER_BAND);
    const backdrop = floodNearWhite(img.width, img.height, nearWhite, border);
    if (!backdropIsClean(border, backdrop, luma, chroma)) return failedShot(input);

    const content = findContent(img, backdrop, luma, chroma);
    if (!content) return failedShot(input); // blank frame: nothing to frame
    if (floodLooksWrong(img, backdrop, content.box)) return untouchedShot(input);

    const out = whitenBackdrop(img, backdrop, luma, border, whiteFrom);
    return {
      buffer: await frameOnWhite(img, out, content.box, productCentreX(img, content, luma, chroma)),
      productCutOff: touchesFrame(content, img.width, img.height),
      backgroundFailed: false,
    };
  } catch (err) {
    console.warn("finishWhiteShot failed, returning letterboxed original:", err);
    return failedShot(input);
  }
}

/**
 * Re-encode any image as an sRGB JPEG without resizing (marketplaces reject WebP).
 * Throws if the input cannot be decoded.
 */
export async function toMarketplaceJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .withIccProfile("srgb")
    .jpeg(JPEG_MAIN)
    .toBuffer();
}

function isUnit(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

/**
 * Crop a photo to the product box plus a margin. Returns null when the box is
 * missing, invalid, too small, or so large that cropping adds nothing.
 */
export async function cropToBox(
  input: Buffer,
  box: ProductBox | null | undefined,
  marginRatio = 0.15
): Promise<Buffer | null> {
  try {
    if (!box || !isUnit(box.x) || !isUnit(box.y) || !isUnit(box.width) || !isUnit(box.height)) return null;
    if (box.width <= 0 || box.height <= 0) return null;
    const bw = Math.min(box.width, 1 - box.x);
    const bh = Math.min(box.height, 1 - box.y);
    const area = bw * bh;
    if (!(area >= 0.03) || area > 0.75) return null;
    const margin = Number.isFinite(marginRatio) && marginRatio >= 0 ? marginRatio : 0.15;

    const meta = await sharp(input).metadata();
    const swap = (meta.orientation ?? 1) >= 5;
    const W = swap ? meta.height : meta.width;
    const H = swap ? meta.width : meta.height;
    if (!W || !H) return null;

    const x0 = Math.max(0, box.x - margin * bw);
    const y0 = Math.max(0, box.y - margin * bh);
    const x1 = Math.min(1, box.x + bw + margin * bw);
    const y1 = Math.min(1, box.y + bh + margin * bh);
    const left = Math.min(W - 1, Math.floor(x0 * W));
    const top = Math.min(H - 1, Math.floor(y0 * H));
    const width = Math.max(1, Math.min(W - left, Math.ceil(x1 * W) - left));
    const height = Math.max(1, Math.min(H - top, Math.ceil(y1 * H) - top));
    return await sharp(input).rotate().extract({ left, top, width, height }).jpeg({ quality: 90 }).toBuffer();
  } catch {
    return null;
  }
}

export type ShotProblemCode = "blurry" | "cut_off" | "colour_mismatch" | "background_not_white";

export interface ShotProblem {
  code: ShotProblemCode;
  /** Plain-English problem description, usable in a Gemini fix instruction. */
  message: string;
}

// Measured (lap²/grad²): real outputs 1.62..5.81; light/cream/black products at 1.0px blur 0.90..1.00 (1.5px 0.48); sigma 8 0.05..0.38.
const BLUR_MIN_SHARPNESS = 0.45;
const COLOUR_MAX_DELTA_L = 45;
// Real Gemini teal measures chroma ~22 (photo ~27); black/grey products measure < 5, so 15 still ignores neutrals
const COLOUR_MIN_CHROMA = 15;
const COLOUR_MAX_HUE_DIFF = 75;

/**
 * Variance of the 4-neighbour Laplacian at 512px, measured on structure pixels (not flat) within
 * 2px of content, so a flat matte product with a crisp silhouette counts as sharp. Null when there
 * is too little structure to judge.
 */
export async function measureSharpness(input: Buffer): Promise<number | null> {
  const { data, info } = await sharp(input)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const at = (x: number, y: number) => data[(y * width + x) * channels]!;
  const nearContent = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (at(x, y) >= NEAR_WHITE_LUMA) continue;
      for (let yy = Math.max(0, y - 2); yy <= Math.min(height - 1, y + 2); yy++) {
        for (let xx = Math.max(0, x - 2); xx <= Math.min(width - 1, x + 2); xx++) nearContent[yy * width + xx] = 1;
      }
    }
  }
  let count = 0;
  let lapEnergy = 0;
  let gradEnergy = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (!nearContent[y * width + x]) continue;
      const c = at(x, y);
      const l = at(x - 1, y);
      const r = at(x + 1, y);
      const u = at(x, y - 1);
      const d = at(x, y + 1);
      const gx = (r - l) / 2;
      const gy = (d - u) / 2;
      // Shallow ramps carry only 8-bit quantisation noise, which would make heavy blur look sharp
      if (gx * gx + gy * gy < 16) continue;
      const lap = 4 * c - l - r - u - d;
      count++;
      lapEnergy += lap * lap;
      gradEnergy += gx * gx + gy * gy;
    }
  }
  if (count < 0.002 * width * height || gradEnergy === 0) return null;
  // Laplacian energy relative to gradient energy ~ 1/edge-width²: independent of product contrast
  return lapEnergy / gradEnergy;
}

interface Lab {
  L: number;
  a: number;
  b: number;
  /** 75th-percentile per-pixel chroma: how colourful the coloured part is (mean a/b understates it). */
  C: number;
}

function srgbToLab(r: number, g: number, b: number): Omit<Lab, "C"> {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return { L: 116 * f(Y) - 16, a: 500 * (f(X) - f(Y)), b: 200 * (f(Y) - f(Z)) };
}

/** Interquartile mean per LAB channel: robust to highlights, shadows and small details. */
function robustLab(img: RgbImage, include: (x: number, y: number, i: number) => boolean, region: Box): Lab | null {
  const Ls: number[] = [];
  const As: number[] = [];
  const Bs: number[] = [];
  const Cs: number[] = [];
  const step = Math.max(1, Math.floor(Math.sqrt(((region.x1 - region.x0 + 1) * (region.y1 - region.y0 + 1)) / 40000)));
  for (let y = region.y0; y <= region.y1; y += step) {
    for (let x = region.x0; x <= region.x1; x += step) {
      const i = (y * img.width + x) * 3;
      if (!include(x, y, i)) continue;
      const lab = srgbToLab(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!);
      Ls.push(lab.L);
      As.push(lab.a);
      Bs.push(lab.b);
      Cs.push(Math.hypot(lab.a, lab.b));
    }
  }
  if (Ls.length < 200) return null;
  const iqm = (v: number[]) => {
    v.sort((p, q) => p - q);
    const s = v.slice(Math.floor(v.length * 0.25), Math.ceil(v.length * 0.75));
    return s.reduce((acc, n) => acc + n, 0) / s.length;
  };
  Cs.sort((p, q) => p - q);
  return { L: iqm(Ls), a: iqm(As), b: iqm(Bs), C: Cs[Math.floor(Cs.length * 0.75)]! };
}

function centralRegion(box: Box, keep: number): Box {
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const mx = (w * (1 - keep)) / 2;
  const my = (h * (1 - keep)) / 2;
  return {
    x0: Math.round(box.x0 + mx),
    y0: Math.round(box.y0 + my),
    x1: Math.max(Math.round(box.x0 + mx), Math.round(box.x1 - mx)),
    y1: Math.max(Math.round(box.y0 + my), Math.round(box.y1 - my)),
  };
}

async function originalProductLab(original: Buffer, box: ProductBox | null | undefined): Promise<Lab | null> {
  const img = await decodeRgb(original);
  const { width: W, height: H } = img;
  const valid =
    box && isUnit(box.x) && isUnit(box.y) && isUnit(box.width) && isUnit(box.height) && box.width > 0 && box.height > 0;
  const full: Box = valid
    ? {
        x0: Math.floor(box.x * W),
        y0: Math.floor(box.y * H),
        x1: Math.min(W - 1, Math.ceil((box.x + Math.min(box.width, 1 - box.x)) * W) - 1),
        y1: Math.min(H - 1, Math.ceil((box.y + Math.min(box.height, 1 - box.y)) * H) - 1),
      }
    : { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
  return robustLab(img, () => true, centralRegion(full, valid ? 0.6 : 0.4));
}

async function generatedProductLab(generated: Buffer): Promise<Lab | null> {
  const img = await decodeRgb(generated);
  const { luma, chroma } = lumaAndChroma(img);
  const nearWhite = new Uint8Array(luma.length);
  for (let p = 0; p < luma.length; p++) nearWhite[p] = isNearWhite(luma[p]!, chroma[p]!) ? 1 : 0;
  const backdrop = floodNearWhite(img.width, img.height, nearWhite, borderIndices(img.width, img.height, BORDER_BAND));
  const content = findContent(img, backdrop, luma, chroma);
  if (!content) return null;
  const { mask } = content;
  return robustLab(img, (x, y) => mask[y * img.width + x] === 1, centralRegion(content.box, 0.6));
}

function hueAngle(lab: Lab): number {
  return (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
}

function chromaOf(lab: Lab): number {
  return lab.C;
}

function describeColour(lab: Lab): string {
  const C = chromaOf(lab);
  if (lab.L < 30 && C < 25) return "dark/black";
  if (C < 12) return lab.L > 80 ? "white/off-white" : "grey";
  const h = (hueAngle(lab) + 360) % 360;
  if (h < 20 || h >= 340) return "pink/magenta";
  if (h < 50) return "red";
  if (h < 75) return "orange/brown";
  if (h < 105) return "yellow/beige";
  if (h < 165) return "green";
  if (h < 235) return "teal/cyan";
  if (h < 300) return "blue";
  return "purple";
}

/** Colour metrics used by the colour_mismatch check (exported for calibration and tests). */
export async function compareProductColour(
  generated: Buffer,
  original: Buffer,
  originalBox: ProductBox | null | undefined
): Promise<{ original: Lab; generated: Lab; deltaL: number; hueDiff: number; mismatch: boolean } | null> {
  const [orig, gen] = await Promise.all([originalProductLab(original, originalBox), generatedProductLab(generated)]);
  if (!orig || !gen) return null;
  const deltaL = Math.abs(orig.L - gen.L);
  let hueDiff = Math.abs(hueAngle(orig) - hueAngle(gen));
  if (hueDiff > 180) hueDiff = 360 - hueDiff;
  const bothChromatic = chromaOf(orig) > COLOUR_MIN_CHROMA && chromaOf(gen) > COLOUR_MIN_CHROMA;
  const mismatch = deltaL > COLOUR_MAX_DELTA_L || (bothChromatic && hueDiff > COLOUR_MAX_HUE_DIFF);
  return { original: orig, generated: gen, deltaL, hueDiff, mismatch };
}

/**
 * Deterministic checks for problems post-processing cannot fix. Must be lenient:
 * a false positive costs a paid Gemini retry.
 */
export async function checkShotQuality(params: {
  generated: Buffer;
  original: Buffer;
  originalBox: ProductBox | null | undefined;
  variation: string;
  productCutOff?: boolean;
  backgroundFailed?: boolean;
  /** Skip the blur check (e.g. finishWhiteShot returned `untouched`, so focus cannot be judged reliably). */
  skipBlur?: boolean;
}): Promise<ShotProblem[]> {
  const problems: ShotProblem[] = [];
  try {
    if (params.productCutOff) {
      problems.push({
        code: "cut_off",
        message: "the product is cut off at the edge of the frame; show the whole product with a clear margin around it",
      });
    }
    if (params.backgroundFailed) {
      problems.push({ code: "background_not_white", message: "the background is not plain white" });
    }
    try {
      const sharpness = params.skipBlur ? null : await measureSharpness(params.generated);
      if (sharpness !== null && sharpness < BLUR_MIN_SHARPNESS) {
        problems.push({ code: "blurry", message: "the image is blurry; the product must be in sharp focus with crisp detail" });
      }
    } catch {
      // unmeasurable: do not trigger a paid retry
    }
    if (params.variation === "studio_white") {
      try {
        const colour = await compareProductColour(params.generated, params.original, params.originalBox);
        if (colour?.mismatch) {
          problems.push({
            code: "colour_mismatch",
            message: `the product's main colour changed (it should be ${describeColour(colour.original)} like the photo)`,
          });
        }
      } catch {
        // unmeasurable: do not trigger a paid retry
      }
    }
    return problems;
  } catch {
    return [];
  }
}
