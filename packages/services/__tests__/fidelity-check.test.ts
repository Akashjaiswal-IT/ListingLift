import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));

import { checkProductFidelity } from "../ai/fidelity-check.service";

const images = { originalImages: [Buffer.from("orig")], generatedImage: Buffer.from("gen") };
const reply = (content: string) => ({ choices: [{ message: { content } }], usage: {} });

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

  it("passes without calling OpenAI when the key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    expect(await checkProductFidelity(images)).toEqual({ pass: true, issues: [] });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("passes (fail-open) when the client throws", async () => {
    createMock.mockRejectedValue(new Error("timeout"));
    expect(await checkProductFidelity(images)).toEqual({ pass: true, issues: [] });
  });

  it("passes (fail-open) when the reply is not valid JSON", async () => {
    createMock.mockResolvedValue(reply("not json"));
    expect(await checkProductFidelity(images)).toEqual({ pass: true, issues: [] });
  });

  it("returns the issues when the product was changed", async () => {
    createMock.mockResolvedValue(
      reply(JSON.stringify({ pass: false, issues: ["water bottles added in side pockets"] }))
    );
    expect(await checkProductFidelity(images)).toEqual({
      pass: false,
      issues: ["water bottles added in side pockets"],
    });
  });

  it("returns pass when the product is identical", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [] })));
    expect(await checkProductFidelity(images)).toEqual({ pass: true, issues: [] });
  });

  it("sends up to 2 originals and the generated image, all at high detail", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [] })));
    await checkProductFidelity({
      originalImages: [Buffer.from("a"), Buffer.from("b"), Buffer.from("c"), Buffer.from("d")],
      generatedImage: Buffer.from("gen"),
    });

    const body = createMock.mock.calls[0]![0];
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });
    const imageParts = body.messages[0].content.filter((p: any) => p.type === "image_url");
    expect(imageParts.map((p: any) => p.image_url.detail)).toEqual(["high", "high", "high"]);
  });

  it("tells the model to ignore intended improvements like straightening and wrinkle removal", async () => {
    createMock.mockResolvedValue(reply(JSON.stringify({ pass: true, issues: [] })));
    await checkProductFidelity(images);

    const prompt = createMock.mock.calls[0]![0].messages[0].content[0].text as string;
    expect(prompt).toContain("straightening or re-posing");
    expect(prompt).toContain("wrinkles or creases removed");
    expect(prompt).toContain("When unsure, PASS.");
  });
});
