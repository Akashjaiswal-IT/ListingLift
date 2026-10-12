import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";

const { interactionsCreate, checkMock } = vi.hoisted(() => ({
  interactionsCreate: vi.fn(),
  checkMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create: interactionsCreate };
  },
}));
vi.mock("../ai/fidelity-check.service", () => ({ checkProductFidelity: checkMock }));

import { generateStudioImages } from "../ai/gemini.service";

describe("generateStudioImages fidelity loop", () => {
  const savedKey = process.env.GEMINI_API_KEY;
  let original: Buffer;
  let generatedB64: string;

  beforeEach(async () => {
    interactionsCreate.mockReset();
    checkMock.mockReset();
    process.env.GEMINI_API_KEY = "test-gemini-key";
    vi.spyOn(console, "warn").mockImplementation(() => {});

    original = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#1d4ed8" } })
      .jpeg()
      .toBuffer();
    generatedB64 = original.toString("base64");
    interactionsCreate.mockImplementation(async () => ({
      id: `int_${interactionsCreate.mock.calls.length}`,
      output_image: { data: generatedB64 },
    }));
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = savedKey;
    vi.restoreAllMocks();
  });

  const run = () => generateStudioImages({ originalImages: [original], prompt: "warm studio", count: 1 });
  const promptOf = (call: number) => interactionsCreate.mock.calls[call]![0].input[0].text as string;

  it("keeps the first image when the fidelity check passes", async () => {
    checkMock.mockResolvedValue({ pass: true, issues: [] });

    const out = await run();

    expect(interactionsCreate).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(1);
    expect(out[0]!.promptUsed).not.toContain("fidelity-fallback");
    expect(promptOf(0).startsWith("PRODUCT LOCK:")).toBe(true);
  });

  it("regenerates once with the issues when the first check fails and the second passes", async () => {
    checkMock
      .mockResolvedValueOnce({ pass: false, issues: ["water bottles added in side pockets"] })
      .mockResolvedValueOnce({ pass: true, issues: [] });

    const out = await run();

    expect(interactionsCreate).toHaveBeenCalledTimes(2);
    expect(promptOf(0)).not.toContain("PREVIOUS ATTEMPT WAS REJECTED");
    expect(promptOf(1)).toContain(
      "PREVIOUS ATTEMPT WAS REJECTED because: water bottles added in side pockets. Do NOT include any of these."
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.interactionId).toBe("int_2");
    expect(out[0]!.promptUsed).toContain("PREVIOUS ATTEMPT WAS REJECTED");
  });

  it("keeps the Gemini retry (not a pasted photo) when both attempts fail, recording the issues", async () => {
    checkMock.mockResolvedValue({ pass: false, issues: ["extra strap"] });

    const out = await run();

    expect(interactionsCreate).toHaveBeenCalledTimes(2);
    expect(checkMock).toHaveBeenCalledTimes(2);
    expect(out).toHaveLength(1);
    expect(out[0]!.interactionId).toBe("int_2");
    expect(out[0]!.buffer.toString("base64")).toBe(generatedB64);
    expect(out[0]!.fidelityIssues).toEqual(["extra strap"]);
    expect(out[0]!.promptUsed).not.toContain("fidelity-fallback");
  });

  it("keeps the first attempt when the retry has more problems", async () => {
    checkMock
      .mockResolvedValueOnce({ pass: false, issues: ["8 added to print"] })
      .mockResolvedValueOnce({ pass: false, issues: ["logo changed", "text invented"] });

    const out = await run();

    expect(out[0]!.interactionId).toBe("int_1");
    expect(out[0]!.fidelityIssues).toEqual(["8 added to print"]);
    expect(out[0]!.promptUsed).not.toContain("PREVIOUS ATTEMPT WAS REJECTED");
  });

  it("keeps the first Gemini image when the retry returns no image", async () => {
    checkMock.mockResolvedValue({ pass: false, issues: ["logo changed"] });
    interactionsCreate
      .mockResolvedValueOnce({ id: "int_first", output_image: { data: generatedB64 } })
      .mockResolvedValueOnce({ id: "int_empty", output_image: undefined });

    const out = await run();

    expect(interactionsCreate).toHaveBeenCalledTimes(2);
    expect(checkMock).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(1);
    expect(out[0]!.interactionId).toBe("int_first");
    expect(out[0]!.fidelityIssues).toEqual(["logo changed"]);
  });

  it("has no fidelityIssues when the first check passes", async () => {
    checkMock.mockResolvedValue({ pass: true, issues: [] });

    const out = await run();

    expect(out[0]!.fidelityIssues).toBeUndefined();
  });

  it("uses the Sharp composite only when Gemini returns no image at all", async () => {
    interactionsCreate.mockResolvedValue({ id: "int_empty", output_image: undefined });

    const out = await run();

    expect(checkMock).not.toHaveBeenCalled();
    expect(out).toHaveLength(1);
    expect(out[0]!.variationType).toBe("studio_white");
    expect((await sharp(out[0]!.buffer).metadata()).width).toBe(1024);
  });
});
