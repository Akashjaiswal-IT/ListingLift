import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * Text for product cards is rendered by sharp's Pango/HarfBuzz engine from font
 * files bundled in ./fonts. Two reasons: the production image (node:alpine) has
 * no system fonts, so SVG <text> rendered as empty boxes; and HarfBuzz shapes
 * Devanagari correctly (matras, conjuncts), which simple text-to-path libraries do not.
 */

export type FontFace = "regular" | "medium" | "semibold" | "bold" | "extrabold" | "serif";

const FACES: Record<FontFace, { file: string; family: string }> = {
  regular: { file: "Poppins-Regular.ttf", family: "Poppins" },
  medium: { file: "Poppins-Medium.ttf", family: "Poppins Medium" },
  semibold: { file: "Poppins-SemiBold.ttf", family: "Poppins SemiBold" },
  bold: { file: "Poppins-Bold.ttf", family: "Poppins Bold" },
  extrabold: { file: "Poppins-ExtraBold.ttf", family: "Poppins ExtraBold" },
  serif: { file: "TiroDevanagariHindi-Regular.ttf", family: "Tiro Devanagari Hindi" },
};

let fontsDir: string | null = null;

/** Finds the bundled font folder in dev/tests (source tree) and in bundled app builds (repo-relative to cwd). */
export function getFontsDir(): string {
  if (fontsDir) return fontsDir;
  const candidates = [
    process.env.CARD_FONTS_DIR,
    typeof __dirname !== "undefined" ? path.join(__dirname, "fonts") : undefined,
    path.resolve(process.cwd(), "../../packages/services/card/fonts"),
    path.resolve(process.cwd(), "packages/services/card/fonts"),
  ].filter((p): p is string => !!p);
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, FACES.regular.file)));
  if (!found) {
    throw new Error(`Card fonts not found. Looked in: ${candidates.join(", ")}`);
  }
  fontsDir = found;
  return found;
}

const DEVANAGARI = /[ऀ-ॿ]/;

export function hasDevanagari(text: string): boolean {
  return DEVANAGARI.test(text);
}

/** Pango wants "#rrggbb" plus a separate alpha attribute, so translate rgba() colours. */
function pangoColour(color: string, attr: "foreground" | "strikethrough_color"): string {
  const m = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (!m) return `${attr}="${color}"`;
  const hex = `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
  const alpha = m[4] !== undefined ? Math.round(Math.min(1, Math.max(0, Number(m[4]))) * 100) : 100;
  return attr === "foreground" ? `foreground="${hex}" fgalpha="${alpha}%"` : `${attr}="${hex}"`;
}

function escapeMarkup(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface TextOptions {
  text: string;
  face: FontFace;
  /** Font size in pixels. */
  size: number;
  color: string;
  /** Wrap width in pixels; omit for a single unwrapped line. */
  maxWidth?: number;
  align?: "left" | "centre" | "right";
  /** Extra letter spacing in pixels (use for small caps labels). */
  letterSpacing?: number;
  /** Strike the text through (used for MRP). */
  strikethrough?: boolean;
  /** Line height as a multiple of size; Devanagari gets at least 1.35. */
  lineHeight?: number;
}

export interface RenderedText {
  buffer: Buffer;
  width: number;
  height: number;
}

// Control characters break Pango markup, and there is no emoji font (they would print as boxes).
// ZWJ/ZWNJ are kept: Devanagari uses them to control conjuncts.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}︎️⃣]/gu;

/** Cleans seller text for a card: drops control characters and emoji, tidies spaces. */
export function cleanCardText(text: string): string {
  return text
    .replace(CONTROL_CHARS, " ")
    .replace(EMOJI, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

const EMPTY_PNG = sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();

export async function renderText(input: TextOptions): Promise<RenderedText> {
  const opts = { ...input, text: cleanCardText(input.text) };
  if (!opts.text) return { buffer: await EMPTY_PNG, width: 1, height: 1 };
  const face = FACES[opts.face];
  const lineHeight = Math.max(opts.lineHeight ?? 1.2, hasDevanagari(opts.text) ? 1.35 : 0);
  const attrs = [
    pangoColour(opts.color, "foreground"),
    opts.letterSpacing ? `letter_spacing="${Math.round(opts.letterSpacing * 1024)}"` : "",
    opts.strikethrough ? `strikethrough="true" ${pangoColour(opts.color, "strikethrough_color")}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const { data, info } = await sharp({
    text: {
      text: `<span ${attrs}>${escapeMarkup(opts.text)}</span>`,
      font: `${face.family} ${opts.size}`,
      fontfile: path.join(getFontsDir(), face.file),
      dpi: 72,
      rgba: true,
      // word-char: break inside a word only when one word is wider than the line (SKU-style titles)
      ...(opts.maxWidth ? { width: Math.round(opts.maxWidth), wrap: "word-char" as const } : {}),
      align: opts.align ?? "left",
      // Pango spacing is extra space between lines, in points (= px at 72 dpi)
      spacing: Math.round(opts.size * (lineHeight - 1)),
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, width: info.width, height: info.height };
}

/**
 * Counts rendered lines. A single line's image is cropped close to the glyphs, while each
 * extra wrapped line adds the font's full line step, so measure both and derive the count.
 */
async function countLines(opts: TextOptions, height: number): Promise<number> {
  const sample = hasDevanagari(opts.text) ? "कीमत Ag" : "Ag";
  const base = { face: opts.face, size: opts.size, color: "#000", lineHeight: opts.lineHeight };
  const one = await renderText({ ...base, text: sample });
  const two = await renderText({ ...base, text: `${sample}\n${sample}` });
  const step = Math.max(1, two.height - one.height);
  return 1 + Math.max(0, Math.round((height - one.height) / step));
}

export interface FitOptions extends TextOptions {
  maxWidth: number;
  maxLines: number;
  /** Smallest size allowed before the text is shortened with an ellipsis. */
  minSize: number;
}

/**
 * Renders text that fits in `maxLines` lines of `maxWidth`: shrinks the size down to
 * `minSize`, then trims words (and, for one long word, characters) with an ellipsis.
 * The result is guaranteed to be no wider than `maxWidth`.
 */
export async function renderFittedText(input: FitOptions): Promise<RenderedText & { size: number }> {
  const opts = { ...input, text: cleanCardText(input.text) };
  const fits = async (text: string, size: number) => {
    const out = await renderText({ ...opts, size, text });
    const ok = out.width <= opts.maxWidth && (await countLines({ ...opts, size, text }, out.height)) <= opts.maxLines;
    return ok ? out : null;
  };

  for (let size = opts.size; size >= opts.minSize; size -= 2) {
    const out = await fits(opts.text, size);
    if (out) return { ...out, size };
  }

  const size = opts.minSize;
  const words = opts.text.split(/\s+/).filter(Boolean);
  for (let n = words.length - 1; n >= 1; n--) {
    const out = await fits(`${words.slice(0, n).join(" ")}…`, size);
    if (out) return { ...out, size };
  }
  const first = Array.from(words[0] ?? "");
  for (let n = first.length - 1; n >= 1; n--) {
    const out = await fits(`${first.slice(0, n).join("")}…`, size);
    if (out) return { ...out, size };
  }

  // Last resort: scale the rendered text down so it can never exceed the box.
  const out = await renderText({ ...opts, size, text: `${first[0] ?? ""}…`, maxWidth: undefined });
  if (out.width <= opts.maxWidth) return { ...out, size };
  const scaled = await sharp(out.buffer).resize({ width: Math.floor(opts.maxWidth) }).png().toBuffer({ resolveWithObject: true });
  return { buffer: scaled.data, width: scaled.info.width, height: scaled.info.height, size };
}
