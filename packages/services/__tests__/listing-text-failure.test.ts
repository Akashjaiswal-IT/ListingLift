import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));
vi.mock("../ai/ai-observability", () => ({ trackAIGeneration: vi.fn() }));

import { generateListingText, generateListingTextStream } from "../ai/openai.service";

const params = { userTitle: "Canvas backpack", price: 700, discountPrice: undefined, originalImageUrls: [] };

// The seller paid for AI-written copy: a failure must throw (so the listing is refunded),
// never return template text.
describe("listing text when OpenAI fails", () => {
  const savedKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    createMock.mockReset();
    process.env.OPENAI_API_KEY = "sk-test-key";
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = savedKey;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("throws when the call fails", async () => {
    createMock.mockRejectedValue(new Error("503 unavailable"));
    await expect(generateListingText(params)).rejects.toThrow("503 unavailable");
  });

  it("throws when the reply is empty", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "" } }], usage: {} });
    await expect(generateListingText(params)).rejects.toThrow("no listing text");
  });

  it("throws without an API key, without calling OpenAI", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(generateListingText(params)).rejects.toThrow(/not configured/);
    await expect(generateListingTextStream(params)).rejects.toThrow(/not configured/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("throws when streaming fails", async () => {
    createMock.mockRejectedValue(new Error("stream broke"));
    await expect(generateListingTextStream(params)).rejects.toThrow("stream broke");
  });

  it("uses template text only with AI_OFFLINE_FALLBACK=1 outside production", async () => {
    vi.stubEnv("AI_OFFLINE_FALLBACK", "1");
    vi.stubEnv("NODE_ENV", "development");
    createMock.mockRejectedValue(new Error("503 unavailable"));
    const out = await generateListingText(params);
    expect(out.seoTitle).toContain("Canvas backpack");

    vi.stubEnv("NODE_ENV", "production");
    await expect(generateListingText(params)).rejects.toThrow("503 unavailable");
  });
});
