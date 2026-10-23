/**
 * Custom top-up pricing — CLIENT COPY.
 *
 * The authoritative version lives in the backend:
 *   packages/services/payment.service.ts -> getTopupPricePaise()
 *
 * The tiers are duplicated on purpose; the EXPECTED table in
 * topup-pricing.test.ts must match packages/services/__tests__/topup.pricing.test.ts
 * so the price shown here always equals what the server charges.
 */

// The slider is narrower than the server limit (15 - 2,000 credits per order).
// Step 5 from 15 lands exactly on every tier boundary (40, 100, 250, 500, 1000).
export const CUSTOM_SLIDER_MIN = 15;
export const CUSTOM_SLIDER_MAX = 1000;
export const CUSTOM_SLIDER_STEP = 5;

function perCreditPaise(qty: number): number {
  if (qty >= 1000) return 2000;
  if (qty >= 500) return 2100;
  if (qty >= 250) return 2200;
  if (qty >= 100) return 2500;
  if (qty >= 40) return 3000;
  return 3400;
}

/** Total price in rupees for a custom top-up of `qty` credits. */
export function getTopupPriceRupees(qty: number): number {
  return (qty * perCreditPaise(qty)) / 100;
}
