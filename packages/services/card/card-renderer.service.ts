import sharp from "sharp";
import { normalizePricing, formatINR } from "../pricing/price";
import { cleanCardText, renderText, renderFittedText, type FontFace, type RenderedText } from "./card-text";
import {
  COPY,
  FESTIVALS,
  PALETTES,
  PREMIUM,
  discountPercent,
  formatPhone,
  pickPaletteForProduct,
  resolveTemplate,
  type CardLanguage,
  type CardTemplate,
  type TrustBadges,
} from "./card-design";
import { checkIcon, chatIcon, festivalEmblem } from "./card-motifs";
import { finishWhiteShot } from "../image/listing-export.service";

export * from "./card-design";

export interface SellerInfo {
  storeName?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
  logoBuffer?: Buffer;
}

export interface CardRenderParams {
  productImage?: Buffer;
  productImageBuffer?: Buffer;
  productTitle?: string;
  title?: string;
  price?: number;
  discountPrice?: number;
  ctaText?: string;
  templateId?: string;
  sellerInfo?: SellerInfo;
  storeName?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
  /** Card copy language; the product title is always shown as the seller wrote it. */
  language?: CardLanguage;
  /** Only badges the seller switched on are drawn; nothing is claimed on their behalf. */
  trustBadges?: TrustBadges;
}

export interface RenderedCards {
  whatsappCard: Buffer;
  whatsapp: Buffer;
  instagramPost: Buffer;
  instagramStory: Buffer;
}

type FormatId = "whatsapp" | "post" | "story";

// Story keeps clear of Instagram/WhatsApp UI: ~250px top, ~340px bottom.
const FORMATS: Record<FormatId, { w: number; h: number; safeTop: number; safeBottom: number }> = {
  whatsapp: { w: 1080, h: 1080, safeTop: 0, safeBottom: 0 },
  post: { w: 1080, h: 1350, safeTop: 0, safeBottom: 0 },
  story: { w: 1080, h: 1920, safeTop: 250, safeBottom: 340 },
};

const JPEG = { quality: 92, chromaSubsampling: "4:4:4" as const };

// ---------------------------------------------------------------------------
// Product preparation (shared by all three cards)
// ---------------------------------------------------------------------------

interface PreparedProduct {
  buffer: Buffer;
  width: number;
  height: number;
  /** True when the image sits on a pure white backdrop and can blend into a white panel. */
  whiteBackdrop: boolean;
  /** Dominant hue of the product, or null for neutral (black/white/grey) products. */
  hue: number | null;
  /** Panel colour matching the photo backdrop, so the photo edge is invisible on the panel. */
  surface: string;
}

async function prepareProduct(input: Buffer): Promise<PreparedProduct> {
  const base = await sharp(input).rotate().flatten({ background: "#FFFFFF" }).toColourspace("srgb").jpeg({ quality: 95 }).toBuffer();
  const { data, info } = await sharp(base).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let borderWhite = 0;
  let borderTotal = 0;
  const borderLuma: number[] = [];
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 300));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels;
      const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
      const onBorder = x < width * 0.02 || x > width * 0.98 || y < height * 0.02 || y > height * 0.98;
      if (onBorder) {
        borderTotal++;
        if (Math.min(r, g, b) >= 246) {
          borderWhite++;
          borderLuma.push(Math.round((r + g + b) / 3));
        }
      } else if (Math.min(r, g, b) < 235) {
        sumR += r; sumG += g; sumB += b; count++;
      }
    }
  }
  const whiteBackdrop = borderTotal > 0 && borderWhite / borderTotal > 0.96;

  let hue: number | null = null;
  if (count > 0) {
    const r = sumR / count / 255, g = sumG / count / 255, b = sumB / count / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min > 0.12) {
      const d = max - min;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      hue = (h * 60 + 360) % 360;
    }
  }

  if (!whiteBackdrop) {
    return { buffer: base, width, height, whiteBackdrop, hue, surface: "#FFFFFF" };
  }

  // Older or re-edited shots have an uneven off-white backdrop that would show as a faint box on the
  // pure-white panel. The main-image finisher evens out the lighting and pushes only near-white
  // backdrop pixels to #FFFFFF (the product is never erased or recoloured). Already-pure-white
  // main shots skip this step.
  let source: Buffer = base;
  let surface: string | undefined;
  let minBorder = 255;
  for (const l of borderLuma) if (l < minBorder) minBorder = l;
  if (minBorder >= 254) {
    surface = "#FFFFFF";
  } else {
    try {
      const finished = await finishWhiteShot(base);
      if (!finished.backgroundFailed && !finished.untouched) {
        source = finished.buffer;
        surface = "#FFFFFF";
      }
    } catch {
      // Fall back to matching the panel to the backdrop colour below.
    }
  }
  if (!surface) {
    borderLuma.sort((a, b) => a - b);
    const hex = (borderLuma[Math.floor(borderLuma.length / 2)] ?? 255).toString(16).padStart(2, "0");
    surface = `#${hex}${hex}${hex}`;
  }

  // Trim the white margin so the product can be sized precisely in each card.
  const trimmed = await sharp(source).trim({ background: "#FFFFFF", threshold: 10 }).toBuffer({ resolveWithObject: true });
  return { buffer: trimmed.data, width: trimmed.info.width, height: trimmed.info.height, whiteBackdrop, hue, surface };
}

/** Fits the product inside a box; non-white photos get rounded corners so they read as a photo on the panel. */
async function placeProduct(p: PreparedProduct, boxW: number, boxH: number): Promise<{ buffer: Buffer; width: number; height: number }> {
  const scale = Math.min(boxW / p.width, boxH / p.height);
  const width = Math.max(1, Math.round(p.width * scale));
  const height = Math.max(1, Math.round(p.height * scale));
  const resized = await sharp(p.buffer).resize(width, height, { kernel: "lanczos3" }).png().toBuffer();
  if (p.whiteBackdrop) return { buffer: resized, width, height };
  const mask = Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="28" ry="28" fill="#fff"/></svg>`);
  return { buffer: await sharp(resized).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer(), width, height };
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

interface Layer {
  input: Buffer;
  left: number;
  top: number;
  w: number;
  h: number;
}

/** Where a text block or the product landed; used by tests to prove nothing overlaps. */
export interface LayoutBox {
  kind: "text" | "product";
  x: number;
  y: number;
  w: number;
  h: number;
}

class Canvas {
  readonly svg: string[] = [];
  readonly layers: Layer[] = [];
  readonly boxes: LayoutBox[] = [];
  /** Space the layout gave the product (the product itself may be narrower or shorter). */
  productSlot: { w: number; h: number } | null = null;
  constructor(readonly w: number, readonly h: number, readonly bg: string) {}

  shape(fragment: string) {
    this.svg.push(fragment);
  }
  image(input: Buffer, left: number, top: number, size: { w: number; h: number }, kind: LayoutBox["kind"] = "product") {
    const l = Math.round(left);
    const t = Math.round(top);
    this.layers.push({ input, left: l, top: t, w: size.w, h: size.h });
    this.boxes.push({ kind, x: l, y: t, w: size.w, h: size.h });
  }
  text(t: RenderedText, left: number, top: number) {
    this.image(t.buffer, left, top, { w: t.width, h: t.height }, "text");
  }

  async toJpeg(): Promise<Buffer> {
    const svg = Buffer.from(
      `<svg width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}" xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="soft" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#000" flood-opacity="0.14"/></filter></defs>
        ${this.svg.join("\n")}</svg>`
    );
    return sharp({ create: { width: this.w, height: this.h, channels: 3, background: this.bg } })
      .composite([{ input: svg, left: 0, top: 0 }, ...(await Promise.all(this.layers.map((l) => this.clip(l)))).filter((l) => l !== null)])
      .toColourspace("srgb")
      .jpeg(JPEG)
      .toBuffer();
  }

  /** Safety net: sharp refuses layers that overhang the card, so crop them to the visible part. */
  private async clip(l: Layer): Promise<{ input: Buffer; left: number; top: number } | null> {
    const x0 = Math.max(0, l.left), y0 = Math.max(0, l.top);
    const x1 = Math.min(this.w, l.left + l.w), y1 = Math.min(this.h, l.top + l.h);
    if (x1 <= x0 || y1 <= y0) return null;
    if (x0 === l.left && y0 === l.top && x1 === l.left + l.w && y1 === l.top + l.h) return { input: l.input, left: l.left, top: l.top };
    const input = await sharp(l.input).extract({ left: x0 - l.left, top: y0 - l.top, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
    return { input, left: x0, top: y0 };
  }
}

function roundedPanel(x: number, y: number, w: number, h: number, r: number, fill: string, shadow = true, stroke?: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}"${shadow ? ' filter="url(#soft)"' : ""}${stroke ? ` stroke="${stroke}" stroke-width="2"` : ""}/>`;
}

/** Jharokha-style pointed arch: straight sides rising into a soft Indian ogee apex. */
function archPath(x: number, top: number, w: number, bottom: number): string {
  const cx = x + w / 2;
  const shoulder = top + w * 0.42;
  return `M${x},${bottom} L${x},${shoulder} C${x},${shoulder - w * 0.36} ${cx - w * 0.14},${top + w * 0.05} ${cx},${top} C${cx + w * 0.14},${top + w * 0.05} ${x + w},${shoulder - w * 0.36} ${x + w},${shoulder} L${x + w},${bottom} Z`;
}

/** Inner box of the arch that the product may occupy (below the apex curve). */
function archProductBox(x: number, top: number, w: number, bottom: number, pad: number) {
  const boxTop = top + w * 0.3;
  return { x: x + pad, y: boxTop, w: w - pad * 2, h: bottom - boxTop - pad };
}

async function pill(
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  opts: { face: FontFace; size: number; color: string; bg: string; padX: number; padY: number; align?: "left" | "centre" | "right"; outline?: string; icon?: "check" | "chat"; iconColor?: string; checkColor?: string }
): Promise<{ width: number; height: number }> {
  const t = await renderText({ text, face: opts.face, size: opts.size, color: opts.color });
  const iconSize = opts.icon ? Math.round(opts.size * 1.05) : 0;
  const gap = opts.icon ? Math.round(opts.size * 0.4) : 0;
  const width = t.width + opts.padX * 2 + iconSize + gap;
  const height = Math.max(t.height, iconSize) + opts.padY * 2;
  const left = opts.align === "centre" ? x - width / 2 : opts.align === "right" ? x - width : x;
  canvas.shape(
    `<rect x="${left}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" ry="${height / 2}" fill="${opts.bg}"${opts.outline ? ` stroke="${opts.outline}" stroke-width="2.5"` : ""}/>`
  );
  if (opts.icon) {
    const iy = y + (height - iconSize) / 2;
    const ix = left + opts.padX;
    canvas.shape(opts.icon === "check" ? checkIcon(ix, iy, iconSize, opts.iconColor ?? opts.color, opts.checkColor) : chatIcon(ix, iy, iconSize, opts.iconColor ?? opts.color));
  }
  canvas.text(t, left + opts.padX + iconSize + gap, y + (height - t.height) / 2);
  return { width, height };
}

// ---------------------------------------------------------------------------
// Content shared by all layouts
// ---------------------------------------------------------------------------

interface CardContent {
  lang: CardLanguage;
  title: string;
  store: string | null;
  phone: string | null;
  handle: string | null;
  selling: string | null;
  mrp: string | null;
  pct: number | null;
  save: string | null;
  cta: string | null;
  trust: string[];
  /** Lines allowed for the product title (reduced to 1 when space is tight). */
  titleLines: number;
}

function buildContent(params: CardRenderParams): CardContent {
  const lang: CardLanguage = params.language === "hi" ? "hi" : "en";
  const copy = COPY[lang];
  const { mrp, selling } = normalizePricing(params.price, params.discountPrice);
  const pct = discountPercent(mrp, selling);
  const phone = formatPhone(params.sellerInfo?.whatsappNumber || params.whatsappNumber);
  const rawHandle = cleanCardText(params.sellerInfo?.instagramHandle || params.instagramHandle || "").replace(/^@+/, "");
  const handle = rawHandle ? `@${rawHandle}` : null;
  const badges = params.trustBadges || {};
  const trust = (["cod", "freeDelivery", "easyReturns", "madeInIndia"] as const).filter((k) => badges[k]).map((k) => copy.trust[k]);
  // A call to action is only printed when the buyer has a way to act on it.
  const cta = phone
    ? cleanCardText(params.ctaText || "") || copy.orderOnWhatsapp
    : handle
      ? lang === "hi" ? `ऑर्डर के लिए ${handle} पर DM करें` : `DM ${handle} to order`
      : null;

  return {
    lang,
    title: cleanCardText(params.productTitle || params.title || "") || (lang === "hi" ? "नया प्रोडक्ट" : "New Arrival"),
    store: cleanCardText(params.sellerInfo?.storeName || params.storeName || "") || null,
    phone,
    handle,
    selling: selling !== undefined ? formatINR(selling) : null,
    mrp: mrp !== undefined ? formatINR(mrp) : null,
    pct,
    save: pct !== null && mrp !== undefined && selling !== undefined ? copy.save(formatINR(mrp - selling)) : null,
    cta,
    trust,
    titleLines: 2,
  };
}

interface Colors {
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  onAccent: string;
  /** Header store name colour. */
  label: string;
  panel: string;
}

const M = 56; // outer margin

/** Store name (left) and contact (right). Returns the header's bottom y. */
async function drawHeader(canvas: Canvas, c: CardContent, col: Colors, top: number, centred = false): Promise<number> {
  let bottom = top;
  const inner = canvas.w - 2 * M;
  const iconSize = 32;
  const contact = !centred ? c.phone || c.handle : null;
  // Contact gets up to ~45% of the row and the store name the rest, so the two can never meet.
  let contactWidth = 0;
  if (contact) {
    const t = await renderFittedText({ text: contact, face: "medium", size: 27, minSize: 20, maxLines: 1, maxWidth: inner * 0.45 - (c.phone ? iconSize + 10 : 0), color: col.ink });
    const x = canvas.w - M - t.width;
    canvas.text(t, x, top);
    if (c.phone) canvas.shape(chatIcon(x - iconSize - 10, top - 2, iconSize, col.accent));
    contactWidth = t.width + (c.phone ? iconSize + 10 : 0);
    bottom = Math.max(bottom, top + t.height);
  }
  if (c.store) {
    const maxWidth = centred ? inner : contact ? inner - contactWidth - 40 : inner;
    const t = await renderFittedText({ text: c.store.toUpperCase(), face: "semibold", size: 26, minSize: 18, maxLines: 1, maxWidth, color: col.label, letterSpacing: 3 });
    canvas.text(t, centred ? (canvas.w - t.width) / 2 : M, top);
    bottom = Math.max(bottom, top + t.height);
  }
  return bottom;
}

/** Selling price, struck MRP and (optionally) the discount chip on one row, bottom-aligned at `bottom`. */
async function drawPriceRow(
  canvas: Canvas,
  c: CardContent,
  col: Colors,
  bottom: number,
  opts: { sellSize: number; face?: FontFace; sellColor?: string; align?: "left" | "centre"; chip?: boolean; chipBg?: string; chipColor?: string }
): Promise<number> {
  if (!c.selling) return bottom;
  const gap = 22;
  const maxRow = canvas.w - 2 * M;
  const measureRow = async (sellSize: number, withMrp: boolean, withChip: boolean) => {
    const sell = await renderText({ text: c.selling!, face: opts.face ?? "extrabold", size: sellSize, color: opts.sellColor ?? col.ink });
    const mrp = withMrp && c.mrp && c.mrp !== c.selling ? await renderText({ text: `${COPY[c.lang].mrp} ${c.mrp}`, face: "medium", size: Math.round(sellSize * 0.38), color: col.muted, strikethrough: true }) : null;
    const chipText = withChip && opts.chip && c.pct !== null ? COPY[c.lang].off(c.pct) : null;
    const chipMeasure = chipText ? await renderText({ text: chipText, face: "bold", size: Math.round(sellSize * 0.4), color: "#000" }) : null;
    const total = sell.width + (mrp ? gap + mrp.width : 0) + (chipMeasure ? gap + chipMeasure.width + 44 : 0);
    return { sellSize, sell, mrp, chipText, chipMeasure, total };
  };
  // Lakh-sized prices can be wide: shrink first, then drop the chip, then the MRP — never overflow.
  let row = await measureRow(opts.sellSize, true, true);
  for (let s = opts.sellSize - 6; row.total > maxRow && s >= Math.round(opts.sellSize * 0.6); s -= 6) row = await measureRow(s, true, true);
  if (row.total > maxRow) row = await measureRow(row.sellSize, true, false);
  if (row.total > maxRow) row = await measureRow(row.sellSize, false, false);
  const { sell, mrp, chipText, chipMeasure, total } = row;
  opts = { ...opts, sellSize: row.sellSize };
  let x = opts.align === "centre" ? (canvas.w - total) / 2 : M;
  const top = bottom - sell.height;
  canvas.text(sell, x, top);
  x += sell.width + gap;
  if (mrp) {
    canvas.text(mrp, x, bottom - mrp.height - sell.height * 0.1);
    x += mrp.width + gap;
  }
  if (chipText && chipMeasure) {
    const chipH = chipMeasure.height + 22;
    await pill(canvas, chipText, x, bottom - chipH - sell.height * 0.06, { face: "bold", size: Math.round(opts.sellSize * 0.4), color: opts.chipColor ?? col.onAccent, bg: opts.chipBg ?? col.accent, padX: 22, padY: 11 });
  }
  return top;
}

/** Trust chips in a wrapping row that ends at `bottom`. Returns the row's top y. */
async function drawTrust(canvas: Canvas, c: CardContent, col: Colors, bottom: number, style: { bg: string; color: string; iconColor: string; checkColor?: string; outline?: string }, centred = false): Promise<number> {
  if (!c.trust.length) return bottom;
  const measured = await Promise.all(c.trust.map((t) => renderText({ text: t, face: "medium", size: 26, color: style.color })));
  const chipH = Math.max(...measured.map((m) => m.height)) + 24;
  const widths = measured.map((m) => m.width + 30 + 28 + 10);
  const gap = 14;
  const rows: number[][] = [[]];
  let rowW = 0;
  widths.forEach((w, i) => {
    if (rowW + w > canvas.w - 2 * M && rows[rows.length - 1]!.length) {
      rows.push([]);
      rowW = 0;
    }
    rows[rows.length - 1]!.push(i);
    rowW += w + gap;
  });
  let y = bottom - rows.length * chipH - (rows.length - 1) * gap;
  const top = y;
  for (const row of rows) {
    const rowWidth = row.reduce((s, i) => s + widths[i]!, 0) + gap * (row.length - 1);
    let x = centred ? (canvas.w - rowWidth) / 2 : M;
    for (const i of row) {
      await pill(canvas, c.trust[i]!, x, y, { face: "medium", size: 26, color: style.color, bg: style.bg, padX: 15, padY: 12, icon: "check", iconColor: style.iconColor, checkColor: style.checkColor, outline: style.outline });
      x += widths[i]! + gap;
    }
    y += chipH + gap;
  }
  return top;
}

/** Full-width call-to-action pill for Stories; ends at `bottom`. Returns its top y. */
async function drawCta(canvas: Canvas, c: CardContent, bottom: number, style: { bg: string; color: string; outline?: string }): Promise<number> {
  if (!c.cta) return bottom;
  const label = c.phone ? `${c.cta}  ·  ${c.phone}` : c.cta;
  const t = await renderFittedText({ text: label, face: "semibold", size: 36, minSize: 26, maxLines: 1, maxWidth: canvas.w - 2 * M - 120, color: style.color });
  const h = t.height + 56;
  const top = bottom - h;
  canvas.shape(`<rect x="${M}" y="${top}" width="${canvas.w - 2 * M}" height="${h}" rx="${h / 2}" ry="${h / 2}" fill="${style.bg}"${style.outline ? ` stroke="${style.outline}" stroke-width="3"` : ""}/>`);
  if (c.phone) canvas.shape(chatIcon((canvas.w - t.width) / 2 - 54, top + (h - 40) / 2, 40, style.color));
  canvas.text(t, (canvas.w - t.width) / 2 + (c.phone ? 24 : 0), top + (h - t.height) / 2);
  return top;
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

interface LayoutArgs {
  format: FormatId;
  template: CardTemplate;
  content: CardContent;
  product: PreparedProduct;
}

async function studioLayout({ format, template, content: c, product }: LayoutArgs): Promise<Canvas> {
  const f = FORMATS[format];
  const pal = PALETTES[template.palette === "auto" || !template.palette ? pickPaletteForProduct(product.hue) : template.palette];
  const col: Colors = { bg: pal.tint, ink: pal.ink, muted: pal.muted, accent: pal.accent, onAccent: pal.onAccent, label: pal.accent, panel: "#FFFFFF" };
  const canvas = new Canvas(f.w, f.h, col.bg);

  const headerBottom = await drawHeader(canvas, c, col, f.safeTop + M);
  let bottom = f.h - f.safeBottom - M;
  if (format === "story") bottom = (await drawCta(canvas, c, bottom, { bg: pal.accent, color: pal.onAccent })) - 28;
  bottom = (await drawTrust(canvas, c, col, bottom, { bg: "#FFFFFF", color: pal.ink, iconColor: pal.accent })) - (c.trust.length ? 26 : 0);
  if (format !== "whatsapp" && c.save) {
    const s = await renderText({ text: c.save, face: "semibold", size: 30, color: pal.accent });
    canvas.text(s, M, bottom - s.height);
    bottom -= s.height + 14;
  }
  const priceTop = await drawPriceRow(canvas, c, col, bottom, { sellSize: format === "whatsapp" ? 84 : 96, chip: true });
  const title = await renderFittedText({ text: c.title, face: "semibold", size: format === "whatsapp" ? 46 : 52, minSize: 36, maxLines: c.titleLines, maxWidth: f.w - 2 * M, color: pal.ink });
  const titleTop = priceTop - (c.selling ? 18 : 0) - title.height;
  canvas.text(title, M, titleTop);

  const panelTop = headerBottom + (headerBottom > f.safeTop + M ? 30 : 0);
  const panelBottom = titleTop - 34;
  canvas.shape(roundedPanel(M, panelTop, f.w - 2 * M, panelBottom - panelTop, 40, product.surface));
  await drawProductIn(canvas, product, M + 40, panelTop + 40, f.w - 2 * M - 80, panelBottom - panelTop - 80);
  return canvas;
}

async function boldLayout({ format, template, content: c, product }: LayoutArgs): Promise<Canvas> {
  const f = FORMATS[format];
  const pal = PALETTES[template.palette && template.palette !== "auto" ? template.palette : pickPaletteForProduct(product.hue)];
  const softOnAccent = pal.onAccent === "#FFFFFF" ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.62)";
  const col: Colors = { bg: pal.accent, ink: pal.onAccent, muted: softOnAccent, accent: pal.onAccent, onAccent: pal.accent, label: pal.onAccent, panel: "#FFFFFF" };
  const canvas = new Canvas(f.w, f.h, col.bg);

  const headerBottom = await drawHeader(canvas, c, col, f.safeTop + M);

  // The offer is the hero: "40% OFF" when there is a real discount, otherwise the price itself.
  const heroText = c.pct !== null ? COPY[c.lang].off(c.pct) : c.selling;
  let y = headerBottom + 26;
  if (heroText) {
    const hero = await renderFittedText({ text: heroText, face: "extrabold", size: format === "whatsapp" ? 120 : 140, minSize: 80, maxLines: 1, maxWidth: f.w - 2 * M, color: pal.onAccent });
    canvas.text(hero, M, y);
    y += hero.height;
    if (c.pct !== null && c.save) {
      y += 18;
      const p = await pill(canvas, c.save, M, y, { face: "bold", size: 36, color: pal.accent, bg: pal.onAccent, padX: 28, padY: 14 });
      y += p.height;
    }
  }

  let bottom = f.h - f.safeBottom - M;
  if (format === "story") bottom = (await drawCta(canvas, c, bottom, { bg: pal.onAccent, color: pal.accent })) - 28;
  if (c.trust.length) {
    const chipBg = pal.onAccent === "#FFFFFF" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.10)";
    bottom = (await drawTrust(canvas, c, col, bottom, { bg: chipBg, color: pal.onAccent, iconColor: pal.onAccent, checkColor: pal.accent })) - (c.trust.length ? 26 : 0);
  }
  // When the hero already shows the price, the bottom row only adds the struck MRP context.
  const priceTop = c.pct !== null ? await drawPriceRow(canvas, c, col, bottom, { sellSize: format === "whatsapp" ? 72 : 84, sellColor: pal.onAccent }) : bottom;
  const title = await renderFittedText({ text: c.title, face: "semibold", size: format === "whatsapp" ? 44 : 50, minSize: 34, maxLines: c.titleLines, maxWidth: f.w - 2 * M, color: pal.onAccent });
  const titleTop = priceTop - (c.pct !== null && c.selling ? 16 : 0) - title.height;
  canvas.text(title, M, titleTop);

  const panelTop = y + 34;
  const panelBottom = titleTop - 32;
  canvas.shape(roundedPanel(M, panelTop, f.w - 2 * M, panelBottom - panelTop, 40, product.surface));
  await drawProductIn(canvas, product, M + 36, panelTop + 36, f.w - 2 * M - 72, panelBottom - panelTop - 72);
  return canvas;
}

async function premiumLayout({ format, template, content: c, product }: LayoutArgs): Promise<Canvas> {
  const f = FORMATS[format];
  const tone = PREMIUM[template.premiumTone ?? "noir"];
  const canvas = new Canvas(f.w, f.h, tone.bg);
  // The frame spans the whole card; only the content keeps to the Story safe zone.
  const inset = 30;
  canvas.shape(`<rect x="${inset}" y="${inset}" width="${f.w - 2 * inset}" height="${f.h - 2 * inset}" fill="none" stroke="${tone.gold}" stroke-opacity="0.55" stroke-width="1.5"/>`);

  let top = f.safeTop + M + 14;
  if (c.store) {
    const s = await renderFittedText({ text: c.store.toUpperCase(), face: "medium", size: 24, minSize: 18, maxLines: 1, maxWidth: f.w - 4 * M, color: tone.gold, letterSpacing: 5 });
    canvas.text(s, (f.w - s.width) / 2, top);
    top += s.height + 30;
  }

  let bottom = f.h - f.safeBottom - M - 14;
  if (format === "story") bottom = (await drawCta(canvas, c, bottom, { bg: "transparent", color: tone.gold, outline: tone.gold })) - 30;
  if (format !== "story" && (c.phone || c.handle)) {
    const t = await renderText({ text: (c.phone || c.handle)!, face: "regular", size: 26, color: tone.muted, letterSpacing: 1 });
    canvas.text(t, (f.w - t.width) / 2, bottom - t.height);
    bottom -= t.height + 26;
  }
  bottom = (await drawTrust(canvas, c, { bg: tone.bg, ink: tone.ink, muted: tone.muted, accent: tone.gold, onAccent: tone.bg, label: tone.gold, panel: "#fff" }, bottom, { bg: "transparent", color: tone.ink, iconColor: tone.gold, outline: tone.frame }, true)) - (c.trust.length ? 26 : 0);

  if (c.selling) {
    const parts: RenderedText[] = [await renderText({ text: c.selling, face: "semibold", size: format === "whatsapp" ? 54 : 62, color: tone.gold })];
    if (c.mrp && c.mrp !== c.selling) parts.push(await renderText({ text: c.mrp, face: "regular", size: 28, color: tone.muted, strikethrough: true }));
    if (c.pct !== null) parts.push(await renderText({ text: COPY[c.lang].off(c.pct).toUpperCase(), face: "medium", size: 24, color: tone.gold, letterSpacing: 3 }));
    const gap = 26;
    const total = parts.reduce((s, p) => s + p.width, 0) + gap * (parts.length - 1);
    let x = (f.w - total) / 2;
    const h0 = parts[0]!.height;
    parts.forEach((p, i) => {
      canvas.text(p, x, i === 0 ? bottom - h0 : bottom - p.height - h0 * 0.12);
      x += p.width + gap;
    });
    bottom -= h0 + 20;
  }
  const title = await renderFittedText({ text: c.title, face: "serif", size: format === "whatsapp" ? 48 : 54, minSize: 36, maxLines: c.titleLines, maxWidth: f.w - 4 * M, color: tone.ink, align: "centre" });
  canvas.text(title, (f.w - title.width) / 2, bottom - title.height);
  bottom -= title.height + 34;

  const archW = Math.min(f.w - 4 * M, Math.round((bottom - top) * 0.82));
  const archX = (f.w - archW) / 2;
  canvas.shape(`<path d="${archPath(archX, top, archW, bottom)}" fill="${product.surface}"${template.premiumTone === "ivory" ? ` stroke="${tone.gold}" stroke-opacity="0.6" stroke-width="2"` : ""} filter="url(#soft)"/>`);
  const box = archProductBox(archX, top, archW, bottom, 44);
  await drawProductIn(canvas, product, box.x, box.y, box.w, box.h);
  return canvas;
}

async function utsavLayout({ format, template, content: c, product }: LayoutArgs): Promise<Canvas> {
  const f = FORMATS[format];
  const fest = FESTIVALS[template.festival ?? "diwali"];
  const canvas = new Canvas(f.w, f.h, fest.field);
  const yTop = f.safeTop;
  const yBot = f.h - f.safeBottom;

  // Regional borders: Bengali lal-paar red band for Durga Puja, Kerala kasavu gold band for Onam.
  // The border spans the whole card; only the content keeps to the Story safe zone.
  if (template.festival === "durga-puja" || template.festival === "onam") {
    const band = 20;
    canvas.shape(`<rect x="${band / 2}" y="${band / 2}" width="${f.w - band}" height="${f.h - band}" fill="none" stroke="${fest.accent}" stroke-width="${band}"/>`);
  } else {
    canvas.shape(`<rect x="26" y="26" width="${f.w - 52}" height="${f.h - 52}" rx="18" fill="none" stroke="${fest.accent}" stroke-opacity="0.75" stroke-width="2"/>`);
  }

  // Greeting framed by a matched pair of the festival emblem (one motif, mirrored for balance).
  let top = yTop + M + 6;
  const emblem = format === "whatsapp" ? 76 : 92;
  const greeting = await renderFittedText({ text: fest.greeting[c.lang], face: "serif", size: format === "whatsapp" ? 50 : 58, minSize: 34, maxLines: 1, maxWidth: f.w - 4 * M - 2 * (emblem + 28), color: fest.accent, align: "centre" });
  const headH = Math.max(greeting.height, emblem);
  canvas.text(greeting, (f.w - greeting.width) / 2, top + (headH - greeting.height) / 2);
  const festId = template.festival ?? "diwali";
  const ey = top + headH / 2;
  canvas.shape(festivalEmblem(festId, (f.w - greeting.width) / 2 - 28 - emblem / 2, ey, emblem, fest.accent));
  canvas.shape(festivalEmblem(festId, (f.w + greeting.width) / 2 + 28 + emblem / 2, ey, emblem, fest.accent));
  top += headH + (format === "whatsapp" ? 22 : 32);

  const col: Colors = { bg: fest.field, ink: fest.ink, muted: fest.muted, accent: fest.accent, onAccent: fest.onAccent, label: fest.accent, panel: "#FFFFFF" };
  let bottom = yBot - M;
  if (format === "story") bottom = (await drawCta(canvas, c, bottom, { bg: fest.accent, color: fest.onAccent })) - 28;
  if (format !== "story" && (c.phone || c.handle || c.store)) {
    const line = [c.store, c.phone || c.handle].filter(Boolean).join("  ·  ");
    const t = await renderFittedText({ text: line, face: "medium", size: 27, minSize: 20, maxLines: 1, maxWidth: f.w - 4 * M, color: fest.muted, align: "centre" });
    canvas.text(t, (f.w - t.width) / 2, bottom - t.height);
    bottom -= t.height + 22;
  }
  if (c.trust.length) {
    const chipBg = fest.dark ? "rgba(255,255,255,0.10)" : "#FFFFFF";
    bottom = (await drawTrust(canvas, c, col, bottom, { bg: chipBg, color: fest.ink, iconColor: fest.accent }, true)) - (c.trust.length ? 24 : 0);
  }
  const priceTop = await drawPriceRow(canvas, c, col, bottom, { sellSize: format === "whatsapp" ? 72 : 86, align: "centre", chip: true, sellColor: fest.ink });
  const title = await renderFittedText({ text: c.title, face: "semibold", size: format === "whatsapp" ? 42 : 48, minSize: 32, maxLines: c.titleLines, maxWidth: f.w - 4 * M, color: fest.ink, align: "centre" });
  const titleTop = priceTop - (c.selling ? 16 : 0) - title.height;
  canvas.text(title, (f.w - title.width) / 2, titleTop);
  const archBottom = titleTop - 30;

  const archW = Math.min(f.w - 2 * M - 220, Math.round((archBottom - top) * 0.86));
  const archX = (f.w - archW) / 2;
  canvas.shape(`<path d="${archPath(archX, top, archW, archBottom)}" fill="${product.surface}" filter="url(#soft)"/>`);
  canvas.shape(`<path d="${archPath(archX - 12, top - 14, archW + 24, archBottom)}" fill="none" stroke="${fest.accent}" stroke-opacity="0.8" stroke-width="2"/>`);
  const box = archProductBox(archX, top, archW, archBottom, 42);
  await drawProductIn(canvas, product, box.x, box.y, box.w, box.h);
  return canvas;
}

async function drawProductIn(canvas: Canvas, product: PreparedProduct, x: number, y: number, w: number, h: number): Promise<void> {
  canvas.productSlot = { w, h };
  if (w < 40 || h < 40) return;
  const placed = await placeProduct(product, w, h);
  // Sit the product slightly low in its box, as on a surface, rather than floating dead centre.
  canvas.image(placed.buffer, x + (w - placed.width) / 2, y + (h - placed.height) * 0.6, { w: placed.width, h: placed.height });
}

const LAYOUTS = { studio: studioLayout, bold: boldLayout, premium: premiumLayout, utsav: utsavLayout } as const;

/**
 * Renders a format, and if text and badges squeeze the product below ~30% of the usable height,
 * re-renders with less: first without the "you save" line, then a one-line title, then no badges.
 */
async function renderWithRoomForProduct(
  layout: (args: LayoutArgs) => Promise<Canvas>,
  format: FormatId,
  template: CardTemplate,
  content: CardContent,
  product: PreparedProduct
): Promise<Canvas> {
  const f = FORMATS[format];
  const usable = f.h - f.safeTop - f.safeBottom;
  // The square WhatsApp card has room for two trust badges; the taller formats show all of them.
  const base = format === "whatsapp" ? { ...content, trust: content.trust.slice(0, 2) } : content;
  const levels: CardContent[] = [
    base,
    { ...base, save: null },
    { ...base, save: null, titleLines: 1 },
    { ...base, save: null, titleLines: 1, trust: [] },
  ];
  let canvas: Canvas | null = null;
  for (const c of levels) {
    canvas = await layout({ format, template, content: c, product });
    if (canvas.productSlot && canvas.productSlot.h >= usable * 0.3) return canvas;
  }
  return canvas!;
}

/**
 * Renders the WhatsApp card (1080×1080), Instagram post (1080×1350, 4:5) and Story
 * (1080×1920) as sRGB JPEGs. The product photo is placed as-is on a white surface — it
 * is never cut out or recoloured — and only seller-provided facts are printed.
 */
export async function renderSocialCards(params: CardRenderParams): Promise<RenderedCards> {
  return (await renderCardsWithLayout(params)).cards;
}

export interface CardLayoutReport {
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  boxes: LayoutBox[];
}

/** Same as renderSocialCards, plus where every text block and the product were placed. */
export async function renderCardsWithLayout(
  params: CardRenderParams
): Promise<{ cards: RenderedCards; layouts: Record<FormatId, CardLayoutReport> }> {
  const imgBuffer = params.productImage || params.productImageBuffer;
  if (!imgBuffer) throw new Error("Product image buffer is required for card rendering");

  const template = resolveTemplate(params.templateId);
  const content = buildContent(params);
  const product = await prepareProduct(imgBuffer);
  const layout = LAYOUTS[template.layout];

  const formats = ["whatsapp", "post", "story"] as const;
  const canvases = await Promise.all(formats.map((format) => renderWithRoomForProduct(layout, format, template, content, product)));
  const [whatsapp, post, story] = await Promise.all(canvases.map((c) => c.toJpeg()));
  const layouts = Object.fromEntries(
    formats.map((format, i) => {
      const f = FORMATS[format];
      return [format, { width: f.w, height: f.h, safeTop: f.safeTop, safeBottom: f.safeBottom, boxes: canvases[i]!.boxes }];
    })
  ) as Record<FormatId, CardLayoutReport>;
  return { cards: { whatsappCard: whatsapp!, whatsapp: whatsapp!, instagramPost: post!, instagramStory: story! }, layouts };
}
