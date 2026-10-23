import { describe, it, expect } from "vitest";
import { generateFallbackListingText, sanitizeListingText, type GenerateTextParams } from "../ai/openai.service";

const base: GenerateTextParams = {
  userTitle: "Casio fx-991MS Scientific Calculator",
  price: 1295,
  discountPrice: 1095,
  storeName: "Sharma Stationers",
  whatsappNumber: "9876543210",
  productInventory: {
    category: "scientific calculator",
    material: "plastic body",
    colours: ["dark grey"],
    details: ["two-line display", "slide-on cover"],
    counts: [],
    exactText: ["CASIO", "fx-991MS"],
    wear: [],
  },
};

// Claims the seller never confirmed must never appear unless turned on.
const UNAPPROVED = /cash on delivery|free delivery|easy return|hassle[- ]free|7[- ]day|warranty|guarantee|country of origin|made in india/i;
const URGENCY = /hurry|stock running|limited time|only few|runs out|grab yours|before it'?s gone/i;

describe("generateFallbackListingText", () => {
  it("invents no delivery, COD, return, warranty or origin claims when the seller enabled none", () => {
    const out = generateFallbackListingText({ ...base, sellerFacts: {} });
    const blob = [out.seoDescription, ...out.keyFeatures, out.meeshoListing.description, out.whatsappCaption, out.instagramCaption].join(" ");
    expect(blob).not.toMatch(UNAPPROVED);
    expect(blob).not.toMatch(URGENCY);
  });

  it("prints only the trust claims the seller turned on", () => {
    const out = generateFallbackListingText({ ...base, sellerFacts: { cod: true, madeInIndia: true } });
    const wa = out.whatsappCaption.toLowerCase();
    expect(wa).toContain("cash on delivery");
    expect(wa).toContain("made in india");
    expect(wa).not.toContain("free delivery");
    expect(wa).not.toContain("return");
  });

  it("describes the real product from the photo inventory, not a fabric guess", () => {
    const out = generateFallbackListingText({ ...base, sellerFacts: {} });
    expect(out.keyFeatures.join(" ")).toContain("plastic body");
    expect(out.keyFeatures.join(" ")).not.toMatch(/fabric|cotton|size/i);
  });

  it("writes the contact line from the seller's own number", () => {
    const out = generateFallbackListingText({ ...base, sellerFacts: {} });
    expect(out.whatsappCaption).toContain("+91 98765 43210");
  });

  it("caps hashtags at 5 and keeps the price out of every text field", () => {
    const out = generateFallbackListingText({ ...base, sellerFacts: {} });
    expect(out.instagramHashtags.length).toBeLessThanOrEqual(5);
    expect(out.seoTitle).not.toMatch(/₹|\brs\b/i);
  });
});

describe("sanitizeListingText guardrails", () => {
  const parsed = {
    seoTitle: "BEST SELLER " + "Super Premium ".repeat(8) + "Calculator",
    seoDescription: "Great calculator. ".repeat(20),
    keyFeatures: ["401 functions", "two-line display"],
    keywords: ["casio", "calculator"],
    meeshoListing: {
      title: "BEST SELLER Casio fx-991MS!! $ _ {Calculator} #1 Top Rated",
      description: "A scientific calculator with 401 functions.",
      category: "Electronics",
      subcategory: "Calculators",
    },
    whatsappCaption: "Casio fx-991MS\n{{PRICE_LINE}}\nCall us at 9876543210\nVisit https://mystore.example\nOffer at ₹99999 only",
    instagramCaption: "Casio fx-991MS scientific calculator for students",
    instagramHashtags: ["#a", "#b", "#c", "#d", "#e", "#f", "#g", "#h", "#i"],
  };

  it("enforces lengths, strips banned characters and promo words, caps hashtags", () => {
    const out = sanitizeListingText(parsed, { ...base, sellerFacts: {} });
    expect(out.seoTitle.length).toBeLessThanOrEqual(60);
    expect(out.seoDescription.length).toBeLessThanOrEqual(160);
    expect(out.meeshoListing.title).not.toMatch(/[!$?_{}^¬¦]/);
    expect(out.meeshoListing.title.toLowerCase()).not.toMatch(/best seller|top rated|#1/);
    expect(out.instagramHashtags.length).toBe(5);
  });

  it("writes the price line itself and drops the model's phone number, link and any wrong amount", () => {
    const out = sanitizeListingText(parsed, { ...base, sellerFacts: {} });
    expect(out.whatsappCaption).toContain("₹1,095");
    expect(out.whatsappCaption).not.toContain("99999");
    expect(out.whatsappCaption).not.toContain("9876543210\n"); // model's inline number line is gone
    expect(out.whatsappCaption).not.toContain("https://mystore.example");
    // the server contact line (formatted) is appended instead
    expect(out.whatsappCaption).toContain("+91 98765 43210");
  });

  it("uses a Hindi contact line when the seller's language is Hindi", () => {
    const out = sanitizeListingText(parsed, { ...base, language: "hi", sellerFacts: {} });
    expect(out.whatsappCaption).toContain("ऑर्डर के लिए");
  });
});
