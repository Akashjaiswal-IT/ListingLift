import { describe, it, expect } from "vitest";
import {
  normalizePricing,
  formatINR,
  buildPriceLine,
  findDisallowedAmounts,
} from "../pricing/price";
import { sanitizeListingText, generateFallbackListingText } from "../ai/openai.service";

describe("normalizePricing", () => {
  it("keeps MRP and selling price when both are valid", () => {
    expect(normalizePricing(1200, 700)).toEqual({ mrp: 1200, selling: 700, discountPct: 42 });
  });

  it("heals legacy swapped data (selling saved as price, MRP as discountPrice)", () => {
    expect(normalizePricing(700, 1200)).toEqual({ mrp: 1200, selling: 700, discountPct: 42 });
  });

  it("returns only selling when both are equal", () => {
    expect(normalizePricing(500, 500)).toEqual({ selling: 500 });
  });

  it("treats a single value as the selling price", () => {
    expect(normalizePricing(799, undefined)).toEqual({ selling: 799 });
    expect(normalizePricing(undefined, 799)).toEqual({ selling: 799 });
  });

  it("ignores zero, negative, NaN and infinite values", () => {
    expect(normalizePricing(0, 0)).toEqual({});
    expect(normalizePricing(NaN, undefined)).toEqual({});
    expect(normalizePricing(Infinity, -5)).toEqual({});
    expect(normalizePricing(0, 700)).toEqual({ selling: 700 });
    expect(normalizePricing(NaN, 700)).toEqual({ selling: 700 });
  });
});

describe("formatINR / buildPriceLine", () => {
  it("formats with Indian digit grouping", () => {
    expect(formatINR(700)).toBe("₹700");
    expect(formatINR(1200)).toBe("₹1,200");
    expect(formatINR(125000)).toBe("₹1,25,000");
  });

  it("builds a line with MRP and discount", () => {
    expect(buildPriceLine(normalizePricing(1200, 700))).toBe("💰 *Price:* ₹700 ~₹1,200~ (42% OFF)");
  });

  it("builds a line with only the selling price", () => {
    expect(buildPriceLine(normalizePricing(undefined, 700))).toBe("💰 *Price:* ₹700");
  });

  it("returns an empty string when there is no price", () => {
    expect(buildPriceLine(normalizePricing())).toBe("");
  });
});

describe("findDisallowedAmounts", () => {
  it("flags amounts that were not entered", () => {
    expect(findDisallowedAmounts("Only ₹1,200 today", [700])).toEqual(["₹1,200"]);
    expect(findDisallowedAmounts("Now Rs. 699!", [700])).toEqual(["Rs. 699"]);
    expect(findDisallowedAmounts("Pay INR 999.00 only", [700])).toEqual(["INR 999.00"]);
    expect(findDisallowedAmounts("Rs 499 and ₹ 250", [])).toHaveLength(2);
  });

  it("passes allowed values in any formatting", () => {
    expect(findDisallowedAmounts("₹700 (MRP ₹1,200)", [700, 1200])).toEqual([]);
    expect(findDisallowedAmounts("Rs. 1200 / INR 700.00", [700, 1200])).toEqual([]);
  });

  it("ignores text without currency markers", () => {
    expect(findDisallowedAmounts("Ships in 24 hrs, 100% cotton", [])).toEqual([]);
  });
});

describe("sanitizeListingText", () => {
  const params = { userTitle: "Cotton Kurti", price: 1200, discountPrice: 700 };

  const llmOutput = {
    seoTitle: "Cotton Kurti for Women",
    seoDescription: "Buy Cotton Kurti at just ₹999 today with COD.",
    keyFeatures: ["Soft cotton fabric", "Now at Rs. 699 only", "Easy wash", "Fast dispatch"],
    keywords: ["kurti", "cotton kurti under ₹999"],
    meeshoListing: {
      title: "Cotton Kurti Women",
      description: "Fabric: Cotton\nPrice: ₹999 (MRP: ₹699)\nReturns: 7 days",
      category: "Women Ethnic Wear",
      subcategory: "Kurtis",
    },
    whatsappCaption: "✨ New Arrival ✨\n{{PRICE_LINE}}\nPrice: ₹999 (MRP: ₹699)\n📏 Sizes: M, L",
    instagramCaption: "Love this kurti!\nGrab it for just ₹999\nDM to order",
    instagramHashtags: ["#kurti", "#sale"],
  };

  it("replaces AI-written prices with the seller's exact prices", () => {
    const out = sanitizeListingText(llmOutput, params);

    expect(out.whatsappCaption).toContain("₹700");
    expect(out.whatsappCaption).toContain("₹1,200");
    expect(out.whatsappCaption).toContain("42% OFF");
    expect(out.whatsappCaption).not.toContain("{{PRICE_LINE}}");

    const everything = JSON.stringify(out);
    expect(everything).not.toContain("999");
    expect(everything).not.toContain("699");
  });

  it("drops offending lines in multi-line fields and keeps the rest", () => {
    const out = sanitizeListingText(llmOutput, params);
    expect(out.meeshoListing.description).toBe("Fabric: Cotton\nReturns: 7 days");
    expect(out.instagramCaption).toBe("Love this kurti!\nDM to order");
    expect(out.whatsappCaption).toContain("📏 Sizes: M, L");
  });

  it("falls back for single-line fields and feature items with bad amounts", () => {
    const fallback = generateFallbackListingText(params);
    const out = sanitizeListingText(llmOutput, params);
    expect(out.seoDescription).toBe(fallback.seoDescription);
    // The clean bullets are kept; the one with a bad amount is swapped for a price-free fallback bullet.
    expect(out.keyFeatures[0]).toBe("Soft cotton fabric");
    expect(out.keyFeatures[2]).toBe("Easy wash");
    expect(findDisallowedAmounts(out.keyFeatures.join(" "), [700, 1200])).toEqual([]);
    expect(out.keywords).toEqual(["kurti"]);
  });

  it("inserts the price line after the first line when the token is missing", () => {
    const out = sanitizeListingText(
      { ...llmOutput, whatsappCaption: "✨ New Arrival ✨\n📏 Sizes: M, L" },
      params
    );
    expect(out.whatsappCaption.split("\n")).toEqual([
      "✨ New Arrival ✨",
      "💰 *Price:* ₹700 ~₹1,200~ (42% OFF)",
      "📏 Sizes: M, L",
    ]);
  });

  it("heals legacy swapped listings", () => {
    const out = sanitizeListingText(llmOutput, { userTitle: "Cotton Kurti", price: 700, discountPrice: 1200 });
    expect(out.whatsappCaption).toContain("💰 *Price:* ₹700 ~₹1,200~");
  });

  it("removes the price line and any amounts when no price was entered", () => {
    const out = sanitizeListingText(llmOutput, { userTitle: "Cotton Kurti" });
    expect(out.whatsappCaption).not.toContain("₹");
    expect(out.whatsappCaption).not.toContain("{{PRICE_LINE}}");
    expect(JSON.stringify(out)).not.toMatch(/₹|Rs\./);
  });

  it("strips leftover tokens from other fields", () => {
    const out = sanitizeListingText({ ...llmOutput, seoTitle: "Kurti {{PRICE_LINE}} Women" }, params);
    expect(out.seoTitle).not.toContain("{{PRICE_LINE}}");
  });

  it("fallback text uses the seller's exact prices", () => {
    const fallback = generateFallbackListingText(params);
    expect(fallback.whatsappCaption).toContain("💰 *Price:* ₹700 ~₹1,200~ (42% OFF)");
    expect(fallback.seoDescription).toContain("₹700");
  });
});
