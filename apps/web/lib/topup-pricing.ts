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

// The slider is narrower than the server limit (10 - 2,000 credits per order)
export const CUSTOM_SLIDER_MIN = 10;
export const CUSTOM_SLIDER_MAX = 1000;
export const CUSTOM_SLIDER_STEP = 10;

function perCreditPaise(qty: number): number {
  if (qty >= 500) return 1100;
  if (qty >= 200) return 1400;
  if (qty >= 80) return 1700;
  if (qty >= 30) return 2000;
  return 2500;
}

/** Total price in rupees for a custom top-up of `qty` credits. */
export function getTopupPriceRupees(qty: number): number {
  return (qty * perCreditPaise(qty)) / 100;
}
