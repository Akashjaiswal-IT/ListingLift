/**
 * Shared types for the product-fidelity pipeline.
 *
 * The inventory is a structured list of what is VISIBLE on the product in the
 * seller's photo. It is written by analyzeProductPhotos (prompt-enhancer
 * service), injected into the Gemini prompt as must-keep details, and used by
 * the fidelity judge as a checklist. The reference photo always outranks it.
 */

/** Normalized (0..1) box around the whole product within one photo. */
export interface ProductBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProductInventory {
  /** Short product type, e.g. "backpack", "wallet", "digital watch". */
  category: string;
  /** Main visible material, e.g. "nylon ripstop", "leather", "brushed steel". */
  material: string;
  /** Main colours with where they appear, e.g. "black body", "light-blue stripe". */
  colours: string[];
  /** Distinctive visible features with position, described relative to the product's own panels. */
  details: string[];
  /** Countable parts that are clearly visible, e.g. { item: "zip pulls", count: 2 }. */
  counts: { item: string; count: number }[];
  /** Fully legible printed text, character for character. */
  exactText: string[];
  /** Visible signs of use or damage (scuffs, peeling print, frayed edges). */
  wear: string[];
  /** True when the product carries lots of small printed text (key legends, labels, fine print). */
  smallPrint?: boolean;
}

/** Shown on every image of a small-print product: image models cannot copy dense tiny text faithfully. */
export const SMALL_PRINT_NOTE =
  "Small printed text on the product may differ from your photo. Check it before uploading.";

export interface ProductAnalysis {
  /** Scene-only prompt (background, surface, lighting) for styled shots. */
  scenePrompt: string;
  /** Null when the analysis could not run or returned nothing usable. */
  inventory: ProductInventory | null;
  /** One entry per input photo, in order; null when no trustworthy box. */
  productBoxes: (ProductBox | null)[];
}

export interface InventoryPromptOptions {
  keepWear?: boolean;
}

const MAX_STRING = 160;
const LINE_BREAKS_RE = new RegExp("[\\r\\n\\t\\u2028\\u2029]+", "g");
const CONTROL_CHARS_RE = new RegExp("[\\u0000-\\u001f\\u007f]", "g");
const QUOTES_RE = new RegExp("[\"`\\u201c\\u201d\\u201e\\u201f\\u00ab\\u00bb]", "g");
const LIST_CAPS = { colours: 6, details: 12, counts: 10, exactText: 12, wear: 8 } as const;

/**
 * Cleans one model-written string before it is embedded in another prompt.
 * Double quotes and backticks are stripped so a value cannot break out of the
 * quoted text it is placed in; apostrophes are kept because printed text such
 * as "LEVI'S" must stay verbatim.
 */
function cleanString(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(LINE_BREAKS_RE, " ")
    .replace(CONTROL_CHARS_RE, "")
    .replace(QUOTES_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, MAX_STRING)
    .trim();
}

function cleanList(raw: unknown, cap: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const s = cleanString(item);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

function toCount(raw: unknown): number | null {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\s*\d+\s*$/.test(raw)
      ? Number(raw)
      : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : null;
}

function cleanCounts(raw: unknown): ProductInventory["counts"] {
  if (!Array.isArray(raw)) return [];
  const out: ProductInventory["counts"] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = cleanString((entry as any).item);
    const count = toCount((entry as any).count);
    if (!item || count === null) continue;
    out.push({ item, count });
    if (out.length >= LIST_CAPS.counts) break;
  }
  return out;
}

function isEmptyInventory(inv: ProductInventory): boolean {
  return (
    !inv.category &&
    !inv.material &&
    inv.colours.length === 0 &&
    inv.details.length === 0 &&
    inv.counts.length === 0 &&
    inv.exactText.length === 0 &&
    inv.wear.length === 0 &&
    !inv.smallPrint
  );
}

/** Validates untrusted model JSON into an inventory; null when nothing usable remains. */
export function sanitizeInventory(raw: unknown): ProductInventory | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const inv: ProductInventory = {
    category: cleanString(r.category),
    material: cleanString(r.material),
    colours: cleanList(r.colours, LIST_CAPS.colours),
    details: cleanList(r.details, LIST_CAPS.details),
    counts: cleanCounts(r.counts),
    exactText: cleanList(r.exactText, LIST_CAPS.exactText),
    wear: cleanList(r.wear, LIST_CAPS.wear),
    ...(r.smallPrint === true ? { smallPrint: true } : {}),
  };
  return isEmptyInventory(inv) ? null : inv;
}

/** Validates a normalized box, clamping it inside the frame; null when invalid. */
export function sanitizeProductBox(raw: unknown): ProductBox | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { x, y, width, height } = raw as Record<string, unknown>;
  if (![x, y, width, height].every((v) => typeof v === "number" && Number.isFinite(v))) {
    return null;
  }
  const bx = x as number;
  const by = y as number;
  if (bx < 0 || bx > 1 || by < 0 || by > 1) return null;
  if ((width as number) <= 0 || (width as number) > 1) return null;
  if ((height as number) <= 0 || (height as number) > 1) return null;
  const w = Math.min(width as number, 1 - bx);
  const h = Math.min(height as number, 1 - by);
  if (w <= 0 || h <= 0) return null;
  return { x: bx, y: by, width: w, height: h };
}


/** Must-keep block appended to the Gemini prompt. Returns "" for a null/empty inventory. */
export function inventoryToPromptBlock(
  inventory: ProductInventory | null | undefined,
  options: InventoryPromptOptions = {}
): string {
  const inv = sanitizeInventory(inventory);
  if (!inv) return "";
  const keepWear = options.keepWear === true;

  const parts: string[] = [];
  if (inv.category) parts.push(`Type: ${inv.category}.`);
  if (inv.material) parts.push(`Material: ${inv.material}.`);
  if (inv.colours.length) parts.push(`Colours: ${inv.colours.join("; ")}.`);
  if (inv.details.length) {
    parts.push(`Details: ${inv.details.map((d, i) => `${i + 1}) ${d}`).join(" ")}.`);
  }
  // Counts are left out of the prompt and the checklist on purpose: models miscount small
  // parts and an angled photo hides some, so a count can make the generator drop a real part
  // or the judge reject a correct image. Additions are caught by the judge's visual comparison.
  if (inv.exactText.length) {
    parts.push(
      `Printed text - reproduce character for character and add no other text: ${inv.exactText
        .map((t) => `"${t}"`)
        .join(", ")}.`
    );
  }
  if (keepWear && inv.wear.length) {
    parts.push(`Visible wear to keep exactly as in the photo: ${inv.wear.join("; ")}.`);
  }
  if (parts.length === 0) return "";

  return [
    "MUST-KEEP PRODUCT DETAILS (read from the seller's photo; the photo is the final authority - if this list and the photo ever disagree, follow the photo):",
    ...parts,
    "Nothing may be added to or removed from the product: no extra parts, pockets, straps, zips, hardware, stitching, panels, patterns, logos or text that are not in the photo.",
  ].join(" ");
}

/** Numbered checklist for the fidelity judge. Returns "" for a null/empty inventory. */
export function inventoryToChecklist(
  inventory: ProductInventory | null | undefined,
  options: InventoryPromptOptions = {}
): string {
  const inv = sanitizeInventory(inventory);
  if (!inv) return "";
  const keepWear = options.keepWear === true;

  const items: string[] = [
    ...inv.details.map((d) => `detail: ${d}`),
    ...inv.exactText.map((t) => `printed text "${t}" present and spelled exactly`),
    ...inv.colours.map((c) => `colour: ${c}`),
    ...(keepWear ? inv.wear.map((w) => `wear kept as in the original: ${w}`) : []),
  ];
  return items.map((line, i) => `${i + 1}. ${line}`).join("\n");
}
