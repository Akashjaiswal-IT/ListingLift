/**
 * Credit packs shown on the landing page — CLIENT COPY.
 *
 * The authoritative list (and what Razorpay actually charges) lives in the backend:
 *   packages/services/payment.service.ts -> CREDIT_PACKS
 * The /pricing page reads the live list from the server; the landing page uses this
 * copy so it renders instantly. The EXPECTED table in credit-packs.test.ts must match
 * packages/services/__tests__/credit-packs.test.ts so the two can never drift.
 */
export interface DisplayPack {
  id: "trial" | "starter" | "standard" | "pro";
  credits: number;
  priceRupees: number;
  perCreditRupees: number;
}

export const LANDING_PACKS: readonly [DisplayPack, DisplayPack, DisplayPack, DisplayPack] = [
  { id: "trial", credits: 15, priceRupees: 499, perCreditRupees: 33.27 },
  { id: "starter", credits: 40, priceRupees: 1199, perCreditRupees: 29.98 },
  { id: "standard", credits: 100, priceRupees: 2499, perCreditRupees: 24.99 },
  { id: "pro", credits: 250, priceRupees: 5499, perCreditRupees: 22.0 },
];

export function formatPackPrice(pack: DisplayPack): string {
  return `₹${pack.priceRupees.toLocaleString("en-IN")}`;
}
