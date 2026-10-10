/**
 * Single source of truth for price handling.
 *
 * Field semantics across DB/API/services: `price` = MRP (original, struck-through),
 * `discountPrice` = selling price (what the customer pays). An AI model must never
 * be the source of a price number - everything customers see goes through here.
 */

export interface NormalizedPricing {
  mrp?: number;
  selling?: number;
  discountPct?: number;
}

function validAmount(n?: number): number | undefined {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

export function normalizePricing(price?: number, discountPrice?: number): NormalizedPricing {
  const a = validAmount(price);
  const b = validAmount(discountPrice);

  if (a === undefined && b === undefined) return {};
  if (a === undefined || b === undefined) return { selling: (a ?? b)! };
  if (a === b) return { selling: a };

  // Legacy listings were saved with the two inputs swapped, so heal at read time.
  const mrp = Math.max(a, b);
  const selling = Math.min(a, b);
  return { mrp, selling, discountPct: Math.round(((mrp - selling) / mrp) * 100) };
}

export function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** WhatsApp-style price line, or "" when there is no selling price. */
export function buildPriceLine(p: NormalizedPricing): string {
  if (p.selling === undefined) return "";
  if (p.mrp === undefined) return `💰 *Price:* ${formatINR(p.selling)}`;
  const off = p.discountPct ? ` (${p.discountPct}% OFF)` : "";
  return `💰 *Price:* ${formatINR(p.selling)} ~${formatINR(p.mrp)}~${off}`;
}

// ₹ / Rs / Rs. / INR followed by a number (commas and decimals allowed)
const CURRENCY_AMOUNT = /(?:₹|\b(?:Rs\.?|INR))\s*(\d[\d,]*(?:\.\d+)?)/gi;

/** Returns currency amounts in `text` whose numeric value is not in `allowed`. */
export function findDisallowedAmounts(text: string, allowed: number[]): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(CURRENCY_AMOUNT)) {
    const value = parseFloat(match[1]!.replace(/,/g, ""));
    if (!allowed.some((a) => Math.abs(a - value) < 0.005)) {
      found.push(match[0].trim());
    }
  }
  return found;
}
