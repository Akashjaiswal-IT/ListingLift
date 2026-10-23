import { describe, it, expect } from "vitest";
import {
  CARD_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  FESTIVALS,
  LEGACY_TEMPLATE_MAP,
  discountPercent,
  formatPhone,
  pickPaletteForProduct,
  resolveTemplate,
} from "../card/card-design";

describe("card templates", () => {
  it("has 24 unique templates across the four layouts", () => {
    const ids = CARD_TEMPLATES.map((t) => t.id);
    expect(ids).toHaveLength(24);
    expect(new Set(ids).size).toBe(24);
    expect(new Set(CARD_TEMPLATES.map((t) => t.layout))).toEqual(new Set(["studio", "bold", "premium", "utsav"]));
  });

  it("covers every festival with its own template", () => {
    for (const f of Object.keys(FESTIVALS)) expect(resolveTemplate(`utsav-${f}`).festival).toBe(f);
  });

  it("resolves current, retired and unknown ids", () => {
    expect(resolveTemplate("bold-peacock").id).toBe("bold-peacock");
    expect(resolveTemplate("diwali-sacred-diya").id).toBe("utsav-diwali");
    expect(resolveTemplate("minimal-luxury").id).toBe("premium-noir");
    expect(resolveTemplate("does-not-exist").id).toBe(DEFAULT_TEMPLATE_ID);
    expect(resolveTemplate(undefined).id).toBe(DEFAULT_TEMPLATE_ID);
  });

  it("maps every retired template to a template that exists", () => {
    expect(Object.keys(LEGACY_TEMPLATE_MAP)).toHaveLength(35);
    for (const target of Object.values(LEGACY_TEMPLATE_MAP)) {
      expect(CARD_TEMPLATES.some((t) => t.id === target)).toBe(true);
    }
  });
});

describe("card facts", () => {
  it("only reports a discount from a real, lower selling price, rounded down", () => {
    expect(discountPercent(1499, 899)).toBe(40);
    expect(discountPercent(1000, 601)).toBe(39);
    expect(discountPercent(1000, 1000)).toBeNull();
    expect(discountPercent(1000, 980)).toBeNull();
    expect(discountPercent(undefined, 899)).toBeNull();
  });

  it("formats Indian mobile numbers and leaves others as entered", () => {
    expect(formatPhone("9876543210")).toBe("+91 98765 43210");
    expect(formatPhone("+91 98765-43210")).toBe("+91 98765 43210");
    expect(formatPhone("919876543210")).toBe("+91 98765 43210");
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(formatPhone("")).toBeNull();
  });

  it("picks a palette that contrasts with the product colour", () => {
    expect(pickPaletteForProduct(null)).toBe("terracotta");
    expect(["peacock", "indigo"]).toContain(pickPaletteForProduct(15));
    expect(["terracotta", "haldi", "kumkum"]).toContain(pickPaletteForProduct(200));
  });
});
