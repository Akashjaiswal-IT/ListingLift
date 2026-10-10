/**
 * Price display — CLIENT COPY.
 *
 * The authoritative version lives in the backend:
 *   packages/services/pricing/price.ts -> normalizePricing()
 *
 * Field semantics: `price` = MRP (struck-through), `discountPrice` = selling
 * price (what the customer pays). Keep the two implementations in sync - the
 * tests in price-display.test.ts mirror the service tests.
 */

export interface DisplayPricing {
  mrp?: number;
  selling?: number;
  discountPct?: number;
}

function validAmount(n?: number | null): number | undefined {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

export function normalizePricing(price?: number | null, discountPrice?: number | null): DisplayPricing {
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
