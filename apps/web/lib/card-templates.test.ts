import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  CARD_TEMPLATES_INFO,
  CARD_TEMPLATES_MAP,
  DEFAULT_TEMPLATE_ID,
  LEGACY_TEMPLATE_MAP,
  resolveTemplateId,
} from "./card-templates";

describe("resolveTemplateId", () => {
  it("keeps current template ids", () => {
    expect(resolveTemplateId("bold-haldi")).toBe("bold-haldi");
    expect(resolveTemplateId("utsav-eid")).toBe("utsav-eid");
  });

  it("maps retired template ids to their replacement", () => {
    expect(resolveTemplateId("minimal-luxury")).toBe("premium-noir");
    expect(resolveTemplateId("diwali-sacred-diya")).toBe("utsav-diwali");
    expect(resolveTemplateId("clean-modern")).toBe("studio-auto");
  });

  it("falls back to the default for unknown or missing ids", () => {
    expect(resolveTemplateId("no-such-template")).toBe(DEFAULT_TEMPLATE_ID);
    expect(resolveTemplateId("")).toBe(DEFAULT_TEMPLATE_ID);
    expect(resolveTemplateId(undefined)).toBe(DEFAULT_TEMPLATE_ID);
    expect(resolveTemplateId(null)).toBe(DEFAULT_TEMPLATE_ID);
  });

  it("every legacy id resolves to a template that exists", () => {
    for (const legacyId of Object.keys(LEGACY_TEMPLATE_MAP)) {
      expect(CARD_TEMPLATES_MAP[resolveTemplateId(legacyId)]).toBeDefined();
    }
  });
});

/** The web app can't import @repo/services, so check this mirror against the source file's text. */
describe("card-templates mirrors packages/services/card/card-design.ts", () => {
  const source = readFileSync(
    path.resolve(__dirname, "../../../packages/services/card/card-design.ts"),
    "utf8"
  );

  it("has the 24 templates, each id present in the source", () => {
    expect(CARD_TEMPLATES_INFO).toHaveLength(24);
    expect(new Set(CARD_TEMPLATES_INFO.map((t) => t.id)).size).toBe(24);
    for (const { id, layout } of CARD_TEMPLATES_INFO) {
      // Palette and festival templates are generated as `${layout}-${key}` from a record key.
      const key = id.slice(layout.length + 1);
      const appears = source.includes(`"${id}"`) || new RegExp(`(^|[\\s{"])${key}"?:\\s*\\{`, "m").test(source);
      expect(appears, `${id} not found in card-design.ts`).toBe(true);
    }
  });

  it("matches the number of templates the source generates", () => {
    const record = (name: string) => {
      const body = source.match(new RegExp(`export const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`))?.[1] ?? "";
      return [...body.matchAll(/^\s+"?([a-z-]+)"?:\s*\{/gm)].map((m) => m[1]);
    };
    const palettes = record("PALETTES");
    const festivals = record("FESTIVALS");
    const singles = [...source.matchAll(/\{ id: "([a-z-]+)", layout:/g)].map((m) => m[1]);
    expect(palettes.length).toBe(5);
    expect(singles.length + palettes.length * 2 + festivals.length).toBe(CARD_TEMPLATES_INFO.length);
    for (const f of festivals) expect(CARD_TEMPLATES_MAP[`utsav-${f}`]).toBeDefined();
    for (const p of palettes) {
      expect(CARD_TEMPLATES_MAP[`studio-${p}`]).toBeDefined();
      expect(CARD_TEMPLATES_MAP[`bold-${p}`]).toBeDefined();
    }
  });

  it("has the same default and legacy map", () => {
    expect(source).toContain(`DEFAULT_TEMPLATE_ID = "${DEFAULT_TEMPLATE_ID}"`);
    const sourceLegacyPairs = source.match(/LEGACY_TEMPLATE_MAP[^{]*\{([\s\S]*?)\};/)?.[1]?.match(/"[^"]+":\s*"[^"]+"/g) ?? [];
    expect(Object.keys(LEGACY_TEMPLATE_MAP)).toHaveLength(sourceLegacyPairs.length);
    for (const [from, to] of Object.entries(LEGACY_TEMPLATE_MAP)) {
      expect(source).toContain(`"${from}": "${to}"`);
    }
  });
});
