import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));

import { checkProductFidelity } from "../ai/fidelity-check.service";
import type { ProductInventory } from "../ai/product-inventory";

const images = { originalImages: [Buffer.from("orig")], generatedImage: Buffer.from("gen") };
const reply = (content: string) => ({ choices: [{ message: { content } }], usage: {} });
const UNVERIFIED = { pass: true, issues: [], verified: false };

const inventory: ProductInventory = {
  category: "calculator",
  material: "plastic",
  colours: ["black body"],
  details: ["solar panel above the display"],
  counts: [{ item: "function keys", count: 4 }],
  exactText: ["CASIO", "fx-991MS"],
  wear: ["scuff on the bottom edge"],
};

const promptOf = (callIndex = 0) =>
  createMock.mock.calls[callIndex]![0].messages[0].content[0].text as string;
const textParts = () =>
  createMock.mock.calls[0]![0].messages[0].content
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text as string);

describe("checkProductFidelity", () => {
  const savedKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    createMock.mockReset();
    process.env.OPENAI_API_KEY = "sk-test-key";
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = savedKey;
    vi.restoreAllMocks();
  });

  it("is unverified without calling OpenAI when the key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    expect(await checkProductFidelity(images)).toEqual(UNVERIFIED);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("is unverified without calling OpenAI for the mock key", async () => {
    process.env.OPENAI_API_KEY = "sk-mock-key";
    expect(await checkProductFidelity(images)).toEqual(UNVERIFIED);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("fails open (unverified) when the client throws", async () => {
    createMock.mockRejectedValue(new Error("timeout"));
    expect(await checkProductFidelity(images)).toEqual(UNVERIFIED);
  });

  it("fails open (unverified) when the reply is not valid JSON", async () => {
    createMock.mockResolvedValue(reply("not json"));
    expect(await checkProductFidelity(images)).toEqual(UNVERIFIED);
  });

  it("fails open (unverified) when pass is not a boolean", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: "no", issues: ["x"] })));
    expect(await checkProductFidelity(images)).toEqual(UNVERIFIED);
  });

  it("returns verified issues when the product was changed", async () => {
    createMock.mockResolvedValue(
      reply(JSON.stringify({ pass: false, issues: ["water bottles added in side pockets"], listErrors: [] }))
    );
    expect(await checkProductFidelity(images)).toEqual({
      pass: false,
      issues: ["water bottles added in side pockets"],
      verified: true,
    });
  });

  it("adds a generic issue when the judge fails without naming one", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: false, issues: [] })));
    expect(await checkProductFidelity(images)).toEqual({
      pass: false,
      issues: ["product differs from the original photo"],
      verified: true,
    });
  });

  it("returns a verified pass with no issues when the product is identical", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: ["ignored"] })));
    expect(await checkProductFidelity(images)).toEqual({ pass: true, issues: [], verified: true });
  });

  it("sends up to 2 originals and the generated image, all at high detail, with fixed settings", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [] })));
    await checkProductFidelity({
      originalImages: [Buffer.from("a"), Buffer.from("b"), Buffer.from("c"), Buffer.from("d")],
      generatedImage: Buffer.from("gen"),
    });

    const [body, options] = createMock.mock.calls[0]!;
    expect(body.model).toBe("gpt-4.1");
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(options).toEqual({ timeout: 15000, maxRetries: 0 });
    const imageParts = body.messages[0].content.filter((p: any) => p.type === "image_url");
    expect(imageParts.map((p: any) => p.image_url.detail)).toEqual(["high", "high", "high"]);
  });

  it("falls back to the raw buffers when sharp cannot decode them", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [] })));
    await checkProductFidelity(images);
    const urls = createMock.mock.calls[0]![0].messages[0].content
      .filter((p: any) => p.type === "image_url")
      .map((p: any) => p.image_url.url);
    expect(urls).toEqual([
      `data:image/jpeg;base64,${Buffer.from("orig").toString("base64")}`,
      `data:image/jpeg;base64,${Buffer.from("gen").toString("base64")}`,
    ]);
  });

  it("downscales real images to at most 1024px JPEG", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [] })));
    const big = await sharp({
      create: { width: 2048, height: 1536, channels: 3, background: { r: 200, g: 10, b: 10 } },
    })
      .png()
      .toBuffer();
    await checkProductFidelity({ originalImages: [big], generatedImage: big });
    const url = createMock.mock.calls[0]![0].messages[0].content.find((p: any) => p.type === "image_url")
      .image_url.url as string;
    const meta = await sharp(Buffer.from(url.split(",")[1]!, "base64")).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBe(1024);
  });

  it("sends the original close-up crop between the originals and the generated image", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [] })));
    await checkProductFidelity({ ...images, originalCrop: Buffer.from("crop") });

    const content = createMock.mock.calls[0]![0].messages[0].content;
    const labels = textParts().slice(1);
    expect(labels).toEqual([
      "ORIGINAL photo:",
      "ORIGINAL close-up crop of the same product:",
      "GENERATED image to verify:",
    ]);
    const imageUrls = content.filter((p: any) => p.type === "image_url").map((p: any) => p.image_url.url);
    expect(imageUrls[1]).toBe(`data:image/jpeg;base64,${Buffer.from("crop").toString("base64")}`);
    expect(promptOf()).toContain("ORIGINAL close-up crop");
  });

  it("omits the crop when none is given", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [] })));
    await checkProductFidelity(images);
    expect(textParts()).not.toContain("ORIGINAL close-up crop of the same product:");
  });

  it("includes the inventory checklist and asks for listErrors", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [], listErrors: [2] })));
    await checkProductFidelity({ ...images, inventory });

    const prompt = promptOf();
    expect(prompt).toContain("CHECKLIST");
    expect(prompt).toContain("1. detail: solar panel above the display");
    expect(prompt).toContain('printed text "fx-991MS" present and spelled exactly');
    expect(prompt).toContain('"listErrors"');
    expect(prompt).not.toContain("scuff on the bottom edge");
  });

  it("has no checklist section without an inventory", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [] })));
    await checkProductFidelity({ ...images, inventory: null });
    expect(promptOf()).not.toContain("CHECKLIST");
  });

  it("treats removed wear as fine by default and as a failure with keepWear", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [] })));
    await checkProductFidelity({ ...images, inventory });
    await checkProductFidelity({ ...images, inventory, keepWear: true });

    expect(promptOf(0)).toContain("removed scuffs, scratches, fading, peeling print or frayed edges are fine");
    expect(promptOf(1)).toContain("removed or reduced wear is a FAILURE");
    expect(promptOf(1)).toContain("scuff on the bottom edge");
  });

  it("tells the model to ignore intended improvements and only fail for concrete differences", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [] })));
    await checkProductFidelity(images);

    const prompt = promptOf();
    expect(prompt).toContain("straightened or re-posed");
    expect(prompt).toContain("creases, wrinkles, dust or lint removed");
    expect(prompt).toContain("NOT the image frame");
    expect(prompt).toContain("Fail only for concrete differences you can point to.");
    expect(prompt).not.toContain("When unsure, PASS.");
  });
});
