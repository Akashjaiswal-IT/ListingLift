import { describe, it, expect } from "vitest";
import { normalizePricing, formatINR } from "./price-display";

/**
 * Mirrors packages/services/__tests__/pricing.test.ts so the client copy can
 * never silently drift from the server's normalizePricing().
 */
describe("price-display normalizePricing", () => {
  it("keeps MRP and selling price when both are valid", () => {
    expect(normalizePricing(1200, 700)).toEqual({ mrp: 1200, selling: 700, discountPct: 42 });
  });

  it("heals legacy swapped data", () => {
    expect(normalizePricing(700, 1200)).toEqual({ mrp: 1200, selling: 700, discountPct: 42 });
  });

  it("returns only selling when both are equal", () => {
    expect(normalizePricing(500, 500)).toEqual({ selling: 500 });
  });

  it("treats a single value as the selling price", () => {
    expect(normalizePricing(799, undefined)).toEqual({ selling: 799 });
    expect(normalizePricing(undefined, 799)).toEqual({ selling: 799 });
    expect(normalizePricing(null, 799)).toEqual({ selling: 799 });
  });

  it("returns nothing (no fake default) when there is no valid price", () => {
    expect(normalizePricing()).toEqual({});
    expect(normalizePricing(0, 0)).toEqual({});
    expect(normalizePricing(NaN, -1)).toEqual({});
  });

  it("formats with Indian digit grouping", () => {
    expect(formatINR(1200)).toBe("₹1,200");
  });
});
