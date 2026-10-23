import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({
  interactionsCreate: vi.fn(),
  checkMock: vi.fn(),
  finishWhiteShot: vi.fn(),
  toMarketplaceJpeg: vi.fn(),
  cropToBox: vi.fn(),
  checkShotQuality: vi.fn(),
  trackAIGeneration: vi.fn(),
  inventoryToPromptBlock: vi.fn(),
}));
const { interactionsCreate, checkMock } = mocks;

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create: mocks.interactionsCreate };
  },
}));
vi.mock("../ai/fidelity-check.service", () => ({ checkProductFidelity: mocks.checkMock }));
vi.mock("../image/listing-export.service", () => ({
  finishWhiteShot: mocks.finishWhiteShot,
  toMarketplaceJpeg: mocks.toMarketplaceJpeg,
  cropToBox: mocks.cropToBox,
  checkShotQuality: mocks.checkShotQuality,
}));
vi.mock("../ai/ai-observability", () => ({ trackAIGeneration: mocks.trackAIGeneration }));
vi.mock("../ai/product-inventory", () => ({
  inventoryToPromptBlock: mocks.inventoryToPromptBlock,
  SMALL_PRINT_NOTE: "SMALL_PRINT_NOTE_MARKER",
}));

import { generateStudioImages, reEditStudioImage, buildProductLock } from "../ai/gemini.service";
import type { ProductInventory } from "../ai/product-inventory";

const inventory: ProductInventory = {
  category: "backpack",
  material: "nylon",
  colours: ["black body"],
  details: ["front zip pocket"],
  counts: [{ item: "zip pulls", count: 2 }],
  exactText: ["NOMAD"],
  wear: [],
};

describe("generateStudioImages fidelity loop", () => {
  const savedKey = process.env.GEMINI_API_KEY;
  let original: Buffer;
  let generatedB64: string;

  beforeEach(async () => {
    Object.values(mocks).forEach((m) => m.mockReset());
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
    mocks.finishWhiteShot.mockImplementation(async (b: Buffer) => ({
      buffer: b,
      productCutOff: false,
      backgroundFailed: false,
    }));
    mocks.toMarketplaceJpeg.mockImplementation(async (b: Buffer) => b);
    mocks.cropToBox.mockResolvedValue(null);
    mocks.checkShotQuality.mockResolvedValue([]);
    mocks.inventoryToPromptBlock.mockReturnValue("MUST KEEP: INVENTORY_MARKER");
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = savedKey;
    vi.restoreAllMocks();
  });

  type RunOpts = Partial<Parameters<typeof generateStudioImages>[0]>;
  const run = (opts: RunOpts = {}) =>
    generateStudioImages({ originalImages: [original], prompt: "warm studio", count: 1, ...opts });
  const req = (call: number) => interactionsCreate.mock.calls[call]![0];
  const promptOf = (call: number): string => {
    const input = req(call).input;
    return typeof input === "string" ? input : input[0].text;
  };
  const pass = { pass: true, issues: [], verified: true };
  const fail = (...issues: string[]) => ({ pass: false, issues, verified: true });

  it("keeps the first image when the fidelity check passes", async () => {
    checkMock.mockResolvedValue(pass);

    const out = await run();

    expect(interactionsCreate).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(1);
    expect(out[0]!.fidelityStatus).toBe("verified");
    expect(out[0]!.attempts).toBe(1);
    expect(out[0]!.fidelityIssues).toBeUndefined();
    expect(promptOf(0).startsWith("PRODUCT LOCK:")).toBe(true);
  });

  it("never shows a small-print product as verified: adds the note and marks it for checking", async () => {
    checkMock.mockResolvedValue(pass);

    const out = await run({ productInventory: { ...inventory, smallPrint: true } });

    expect(out[0]!.fidelityStatus).toBe("issues");
    expect(out[0]!.fidelityIssues).toEqual(["SMALL_PRINT_NOTE_MARKER"]);
    expect(interactionsCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps existing issues and appends the small-print note", async () => {
    checkMock.mockResolvedValue(fail("an extra zip was added"));

    const out = await run({ productInventory: { ...inventory, smallPrint: true } });

    expect(out[0]!.fidelityIssues).toEqual(["an extra zip was added", "SMALL_PRINT_NOTE_MARKER"]);
  });

  it("leaves products without small print as verified", async () => {
    checkMock.mockResolvedValue(pass);

    const out = await run({ productInventory: inventory });

    expect(out[0]!.fidelityStatus).toBe("verified");
  });

  it("skips the blur check for a white shot that finishing left untouched", async () => {
    checkMock.mockResolvedValue(pass);
    mocks.finishWhiteShot.mockImplementation(async (b: Buffer) => ({
      buffer: b,
      productCutOff: false,
      backgroundFailed: false,
      untouched: true,
    }));

    await run();

    expect(mocks.checkShotQuality).toHaveBeenCalledWith(expect.objectContaining({ skipBlur: true }));
  });

  it("keeps the blur check for a normally finished white shot", async () => {
    checkMock.mockResolvedValue(pass);

    await run();

    expect(mocks.checkShotQuality).toHaveBeenCalledWith(expect.objectContaining({ skipBlur: false }));
  });

  it("labels the reference images and adds the close-up crop after the primary photo", async () => {
    checkMock.mockResolvedValue(pass);
    const crop = Buffer.from("crop-bytes");
    mocks.cropToBox.mockResolvedValue(crop);
    const second = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } })
      .jpeg()
      .toBuffer();
    const box = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };

    await run({ originalImages: [original, second], productBoxes: [box, null] });

    const input = req(0).input as any[];
    expect(input.map((p) => p.type)).toEqual(["text", "text", "image", "text", "image", "text", "image"]);
    expect(input[1].text).toBe("Reference photo — viewpoint and product:");
    expect(input[2].data).toBe(original.toString("base64"));
    expect(input[3].text).toBe("Close-up of the same product from that photo, for detail only:");
    expect(input[4].data).toBe(crop.toString("base64"));
    expect(input[5].text).toBe("Another angle of the same product, for detail only:");
    expect(input[6].data).toBe(second.toString("base64"));
    expect(mocks.cropToBox).toHaveBeenCalledWith(original, box);
    // The judge gets the originals plus the crop separately
    expect(checkMock.mock.calls[0]![0].originalImages).toEqual([original, second]);
    expect(checkMock.mock.calls[0]![0].originalCrop).toBe(crop);
  });

  it("uses the assigned angle as primary in multi-angle mode", async () => {
    checkMock.mockResolvedValue(pass);
    const second = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } })
      .jpeg()
      .toBuffer();

    await run({ originalImages: [original, second], count: 2, multiAngle: true });

    const input = req(1).input as any[];
    expect(input[0].text).toContain("VIEWPOINT LOCK");
    expect(input[2].data).toBe(second.toString("base64"));
    expect(input[4].data).toBe(original.toString("base64"));
  });

  it("fixes a rejected image with a multi-turn targeted edit", async () => {
    checkMock.mockResolvedValueOnce(fail("water bottles added in side pockets")).mockResolvedValueOnce(pass);

    const out = await run();

    expect(interactionsCreate).toHaveBeenCalledTimes(2);
    expect(promptOf(0)).not.toContain("PREVIOUS ATTEMPT WAS REJECTED");
    expect(req(1).previous_interaction_id).toBe("int_1");
    expect(req(1).input).toContain("PREVIOUS ATTEMPT WAS REJECTED because: water bottles added in side pockets");
    expect(req(1).input).toContain("fix ONLY");
    expect(req(1).input).toContain("PRODUCT LOCK:");
    expect(out[0]!.interactionId).toBe("int_2");
    expect(out[0]!.fidelityStatus).toBe("verified");
    expect(out[0]!.attempts).toBe(2);
    expect(out[0]!.promptUsed).toContain("fix ONLY");
  });

  it("standard: a failing fix uses the last allowed call, so the slot stops at 2 calls", async () => {
    checkMock.mockResolvedValue(fail("logo changed"));
    interactionsCreate
      .mockResolvedValueOnce({ id: "int_first", output_image: { data: generatedB64 } })
      .mockRejectedValueOnce(new Error("previous interaction expired"))
      .mockResolvedValue({ id: "int_never", output_image: { data: generatedB64 } });

    const out = await run();

    expect(interactionsCreate).toHaveBeenCalledTimes(2);
    expect(out[0]!.interactionId).toBe("int_first");
    expect(out[0]!.attempts).toBe(2);
    expect(out[0]!.fidelityStatus).toBe("issues");
  });

  it("pro: a fix that throws hands the next call to a fresh regeneration (3 calls max)", async () => {
    checkMock.mockResolvedValueOnce(fail("logo changed")).mockResolvedValueOnce(pass);
    interactionsCreate
      .mockResolvedValueOnce({ id: "int_first", output_image: { data: generatedB64 } })
      .mockRejectedValueOnce(new Error("previous interaction expired"))
      .mockResolvedValueOnce({ id: "int_fresh", output_image: { data: generatedB64 } });

    const out = await run({ qualityMode: "pro" });

    expect(interactionsCreate).toHaveBeenCalledTimes(3);
    expect(req(1).previous_interaction_id).toBe("int_first");
    expect(req(2).previous_interaction_id).toBeUndefined();
    expect(promptOf(2)).toContain(
      "PREVIOUS ATTEMPT WAS REJECTED because: logo changed. Do NOT include any of these."
    );
    expect(out[0]!.interactionId).toBe("int_fresh");
    expect(out[0]!.attempts).toBe(3);
    expect(out[0]!.fidelityStatus).toBe("verified");
  });

  it("pro: a fix with no image also falls back to fresh and never exceeds 3 calls", async () => {
    checkMock.mockResolvedValue(fail("logo changed"));
    interactionsCreate
      .mockResolvedValueOnce({ id: "int_first", output_image: { data: generatedB64 } })
      .mockResolvedValueOnce({ id: "int_empty", output_image: undefined })
      .mockResolvedValue({ id: "int_fresh", output_image: { data: generatedB64 } });

    const out = await run({ qualityMode: "pro" });

    expect(interactionsCreate).toHaveBeenCalledTimes(3);
    expect(out[0]!.interactionId).toBe("int_fresh");
    expect(out[0]!.attempts).toBe(3);
    expect(out[0]!.promptUsed).toContain("Do NOT include any of these.");
  });

  it("keeps the first image when every retry call returns nothing", async () => {
    checkMock.mockResolvedValue(fail("logo changed"));
    interactionsCreate
      .mockResolvedValueOnce({ id: "int_first", output_image: { data: generatedB64 } })
      .mockResolvedValue({ id: "int_empty", output_image: undefined });

    const out = await run();

    expect(checkMock).toHaveBeenCalledTimes(1);
    expect(out[0]!.interactionId).toBe("int_first");
    expect(out[0]!.fidelityStatus).toBe("issues");
    expect(out[0]!.fidelityIssues).toEqual(["logo changed"]);
  });

  it("standard: stops after 2 calls when both fail and keeps the later attempt on a tie", async () => {
    checkMock.mockResolvedValue(fail("extra strap"));

    const out = await run();

    expect(interactionsCreate).toHaveBeenCalledTimes(2);
    expect(checkMock).toHaveBeenCalledTimes(2);
    expect(out[0]!.interactionId).toBe("int_2");
    expect(out[0]!.fidelityStatus).toBe("issues");
    expect(out[0]!.fidelityIssues).toEqual(["extra strap"]);
    expect(out[0]!.attempts).toBe(2);
  });

  it("standard: keeps the attempt with the fewest issues", async () => {
    checkMock
      .mockResolvedValueOnce(fail("8 added to print"))
      .mockResolvedValueOnce(fail("logo changed", "text invented"));

    const out = await run();

    expect(out[0]!.interactionId).toBe("int_1");
    expect(out[0]!.fidelityIssues).toEqual(["8 added to print"]);
    expect(out[0]!.promptUsed).not.toContain("PREVIOUS ATTEMPT WAS REJECTED");
  });

  it("standard request has today's shape: no image_size and no generation_config", async () => {
    checkMock.mockResolvedValueOnce(fail("x")).mockResolvedValueOnce(pass);

    await run({ qualityMode: "standard" });

    for (const call of [0, 1]) {
      expect(req(call).response_format).toEqual({ type: "image", mime_type: "image/jpeg", aspect_ratio: "1:1" });
      expect("generation_config" in req(call)).toBe(false);
    }
  });

  it("pro studio_white: 2K + high thinking, up to 3 attempts, 3rd attempt is fresh", async () => {
    checkMock
      .mockResolvedValueOnce(fail("a", "b"))
      .mockResolvedValueOnce(fail("c", "d"))
      .mockResolvedValueOnce(fail("e"));

    const out = await run({ qualityMode: "pro" });

    expect(interactionsCreate).toHaveBeenCalledTimes(3);
    for (const call of [0, 1, 2]) {
      expect(req(call).response_format.image_size).toBe("2K");
      expect(req(call).generation_config).toEqual({ thinking_level: "high" });
    }
    expect(req(1).previous_interaction_id).toBe("int_1");
    expect(req(2).previous_interaction_id).toBeUndefined();
    expect(promptOf(2)).toContain("PREVIOUS ATTEMPT WAS REJECTED because: c; d. Do NOT include any of these.");
    expect(out[0]!.interactionId).toBe("int_3");
    expect(out[0]!.fidelityIssues).toEqual(["e"]);
    expect(out[0]!.attempts).toBe(3);
  });

  it("pro styled shots stay standard: max 2 attempts, no 2K or thinking", async () => {
    checkMock.mockResolvedValueOnce(pass).mockResolvedValue(fail("x"));

    await run({ qualityMode: "pro", count: 2 });

    // slot 1 (white) = 1 call, slot 2 (premium) = 2 calls
    expect(interactionsCreate).toHaveBeenCalledTimes(3);
    expect(req(0).response_format.image_size).toBe("2K");
    for (const call of [1, 2]) {
      expect(req(call).response_format.image_size).toBeUndefined();
      expect(req(call).generation_config).toBeUndefined();
    }
  });

  it("does not retry when the judge could not verify", async () => {
    checkMock.mockResolvedValue({ pass: true, issues: [], verified: false });

    const out = await run();

    expect(interactionsCreate).toHaveBeenCalledTimes(1);
    expect(out[0]!.fidelityStatus).toBe("not_verified");
    expect(out[0]!.fidelityIssues).toBeUndefined();
  });

  it("skips the paid judge when the deterministic check finds a problem and retries with its message", async () => {
    mocks.checkShotQuality
      .mockResolvedValueOnce([{ code: "cut_off", message: "the product is cut off at the frame edge" }])
      .mockResolvedValueOnce([]);
    checkMock.mockResolvedValue(pass);

    const out = await run();

    expect(checkMock).toHaveBeenCalledTimes(1);
    expect(req(1).input).toContain("PREVIOUS ATTEMPT WAS REJECTED because: the product is cut off at the frame edge");
    expect(out[0]!.fidelityStatus).toBe("verified");
  });

  it("judges the best never-judged candidate once before shipping it", async () => {
    mocks.checkShotQuality
      .mockResolvedValueOnce([
        { code: "blurry", message: "blurry" },
        { code: "cut_off", message: "cut off" },
      ])
      .mockResolvedValueOnce([{ code: "blurry", message: "blurry" }]);
    checkMock.mockResolvedValue(fail("logo changed"));

    const out = await run();

    expect(interactionsCreate).toHaveBeenCalledTimes(2);
    expect(checkMock).toHaveBeenCalledTimes(1);
    expect(out[0]!.interactionId).toBe("int_2");
    expect(out[0]!.fidelityStatus).toBe("issues");
    expect(out[0]!.fidelityIssues).toEqual(["blurry", "logo changed"]);
  });

  it("an image with deterministic problems is 'issues' even when the judge passes it", async () => {
    mocks.checkShotQuality.mockResolvedValue([{ code: "blurry", message: "blurry" }]);
    checkMock.mockResolvedValue(pass);

    const out = await run();

    expect(checkMock).toHaveBeenCalledTimes(1);
    expect(out[0]!.fidelityStatus).toBe("issues");
    expect(out[0]!.fidelityIssues).toEqual(["blurry"]);
  });

  it("prefers a judged candidate over a deterministically failed one with fewer problems", async () => {
    mocks.checkShotQuality
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ code: "blurry", message: "blurry" }]);
    checkMock.mockResolvedValue(fail("logo changed", "strap added"));

    const out = await run();

    expect(checkMock).toHaveBeenCalledTimes(1);
    expect(out[0]!.interactionId).toBe("int_1");
    expect(out[0]!.fidelityIssues).toEqual(["logo changed", "strap added"]);
  });

  it("asks for a background-only fix without touching the product", async () => {
    mocks.checkShotQuality
      .mockResolvedValueOnce([{ code: "background_not_white", message: "the background is not plain white" }])
      .mockResolvedValueOnce([]);
    checkMock.mockResolvedValue(pass);

    await run();

    const fix = req(1).input as string;
    expect(fix).toContain(
      "PREVIOUS ATTEMPT WAS REJECTED because: the background is not plain white. In the image you just generated, fix ONLY these problems."
    );
    expect(fix).toContain("not product problems: leave the product itself exactly as it is");
  });

  it("isolates a failing slot: paid slots are kept, only the failed one becomes a composite", async () => {
    checkMock.mockResolvedValue(pass);
    interactionsCreate
      .mockResolvedValueOnce({ id: "int_ok", output_image: { data: generatedB64 } })
      .mockRejectedValueOnce(new Error("429 rate limited"));

    const out = await run({ count: 2 });

    expect(out).toHaveLength(2);
    expect(out[0]!.interactionId).toBe("int_ok");
    expect(out[0]!.fidelityStatus).toBe("verified");
    expect(out[1]!.variationType).toBe("studio_premium");
    expect(out[1]!.attempts).toBe(0);
    expect(out[1]!.fidelityStatus).toBe("not_verified");
  });

  it("falls back to composites for every slot when every slot fails", async () => {
    interactionsCreate.mockRejectedValue(new Error("503"));

    const out = await run({ count: 2 });

    expect(out).toHaveLength(2);
    expect(out.every((o) => o.attempts === 0)).toBe(true);
  });

  it("finishes white shots with finishWhiteShot and styled shots with toMarketplaceJpeg", async () => {
    checkMock.mockResolvedValue(pass);
    const whiteOut = Buffer.from("white-finished");
    mocks.finishWhiteShot.mockResolvedValue({ buffer: whiteOut, productCutOff: true, backgroundFailed: false });

    const out = await run({ count: 2 });

    expect(out[0]!.buffer).toBe(whiteOut);
    expect(mocks.checkShotQuality.mock.calls[0]![0]).toMatchObject({
      generated: whiteOut,
      variation: "studio_white",
      productCutOff: true,
    });
    expect(mocks.toMarketplaceJpeg).toHaveBeenCalled();
  });

  it("uses the keepWear lock wording", async () => {
    checkMock.mockResolvedValue(pass);

    await run({ keepWear: true, productInventory: inventory });

    expect(promptOf(0)).toContain("keep every visible sign of use");
    expect(promptOf(0)).not.toContain("BRAND-NEW RETAIL STOCK");
    expect(mocks.inventoryToPromptBlock).toHaveBeenCalledWith(inventory, { keepWear: true });
    expect(checkMock.mock.calls[0]![0].keepWear).toBe(true);
  });

  it("places the inventory block right after the product lock", async () => {
    checkMock.mockResolvedValue(pass);

    await run({ productInventory: inventory });

    const prompt = promptOf(0);
    expect(prompt.startsWith(`${buildProductLock(false)} MUST KEEP: INVENTORY_MARKER `)).toBe(true);
    expect(checkMock.mock.calls[0]![0].inventory).toBe(inventory);
  });

  it("forwards usage tokens and attempt properties to observability", async () => {
    checkMock.mockResolvedValue(pass);
    interactionsCreate.mockResolvedValue({
      id: "int_u",
      output_image: { data: generatedB64 },
      usage: { total_input_tokens: 120, total_output_tokens: 1290, total_thought_tokens: 55 },
    });

    await run({ qualityMode: "pro" });

    expect(mocks.trackAIGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        inputTokens: 120,
        outputTokens: 1290,
        thoughtTokens: 55,
        properties: { variation: "studio_white", imageSize: "2K", attempt: 1, kind: "fresh" },
      })
    );
  });

  it("uses the Sharp composite (JPEG, not_verified) only when Gemini returns no image at all", async () => {
    interactionsCreate.mockResolvedValue({ id: "int_empty", output_image: undefined });

    const out = await run();

    expect(checkMock).not.toHaveBeenCalled();
    expect(out).toHaveLength(1);
    expect(out[0]!.variationType).toBe("studio_white");
    expect(out[0]!.fidelityStatus).toBe("not_verified");
    expect(out[0]!.attempts).toBe(0);
    const meta = await sharp(out[0]!.buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1024);
  });

  it("never uses computer-render buzzwords in any prompt", async () => {
    checkMock.mockResolvedValue(fail("x"));

    await run({ count: 4, productInventory: inventory, qualityMode: "pro" });
    await run({ count: 4, keepWear: true });

    expect(interactionsCreate.mock.calls.length).toBeGreaterThan(0);
    for (let i = 0; i < interactionsCreate.mock.calls.length; i++) {
      expect(promptOf(i)).not.toMatch(/8K|UHD|award-winning|pristine|advertising campaign/i);
    }
  });
});

describe("reEditStudioImage", () => {
  const savedKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.toMarketplaceJpeg.mockImplementation(async (b: Buffer) => b);
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = savedKey;
    vi.restoreAllMocks();
  });

  it("uses the keepWear lock and returns JPEG via toMarketplaceJpeg", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const img = Buffer.from("gemini-jpeg");
    mocks.interactionsCreate.mockResolvedValue({ id: "int_re", output_image: { data: img.toString("base64") } });

    const out = await reEditStudioImage({
      originalImages: [],
      previousImage: img,
      interactionId: "int_prev",
      newPrompt: "blue background",
      keepWear: true,
    });

    const call = mocks.interactionsCreate.mock.calls[0]![0];
    expect(call.previous_interaction_id).toBe("int_prev");
    expect(call.input).toContain("keep every visible sign of use");
    expect(mocks.toMarketplaceJpeg).toHaveBeenCalled();
    expect(out.interactionId).toBe("int_re");
  });

  it("keeps the white finishing when re-editing a studio_white image", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const raw = Buffer.from("gemini-raw");
    const white = Buffer.from("white-2000");
    mocks.interactionsCreate.mockResolvedValue({ id: "int_re", output_image: { data: raw.toString("base64") } });
    mocks.finishWhiteShot.mockResolvedValue({ buffer: white, productCutOff: false, backgroundFailed: false });

    const out = await reEditStudioImage({
      originalImages: [],
      previousImage: raw,
      interactionId: "int_prev",
      newPrompt: "softer shadow",
      variationType: "studio_white",
    });

    expect(out.buffer).toBe(white);
    expect(out.variationType).toBe("studio_white");
    expect(mocks.toMarketplaceJpeg).not.toHaveBeenCalled();
  });

  it("skips white finishing when the edited background is not white (user asked for colour)", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const raw = Buffer.from("gemini-raw");
    mocks.interactionsCreate.mockResolvedValue({ id: "int_re", output_image: { data: raw.toString("base64") } });
    mocks.finishWhiteShot.mockResolvedValue({ buffer: Buffer.from("x"), productCutOff: false, backgroundFailed: true });

    const out = await reEditStudioImage({
      originalImages: [],
      previousImage: raw,
      interactionId: "int_prev",
      newPrompt: "pink background",
      variationType: "studio_white",
    });

    expect(out.buffer.equals(raw)).toBe(true);
    expect(out.variationType).toBe("custom");
    expect(mocks.toMarketplaceJpeg).toHaveBeenCalledWith(raw);
  });

  it("does not run white finishing for styled images", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const raw = Buffer.from("gemini-raw");
    mocks.interactionsCreate.mockResolvedValue({ id: "int_re", output_image: { data: raw.toString("base64") } });

    await reEditStudioImage({
      originalImages: [],
      previousImage: raw,
      interactionId: "int_prev",
      newPrompt: "x",
      variationType: "lifestyle",
    });

    expect(mocks.finishWhiteShot).not.toHaveBeenCalled();
  });

  // A failed paid re-edit must throw (never return a stand-in image) so the processor refunds the credit.
  const reEditArgs = { originalImages: [], previousImage: Buffer.from("prev"), interactionId: "int_prev", newPrompt: "x" };

  it("throws instead of returning a stand-in image when the image model is not configured", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(reEditStudioImage(reEditArgs)).rejects.toThrow(/not configured/);
  });

  it("throws when Gemini returns no image", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    mocks.interactionsCreate.mockResolvedValue({ id: "int_empty", output_image: undefined });
    await expect(reEditStudioImage(reEditArgs)).rejects.toThrow(/returned no image/);
  });

  it("throws when the Gemini call fails", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    mocks.interactionsCreate.mockRejectedValue(new Error("503 unavailable"));
    await expect(reEditStudioImage(reEditArgs)).rejects.toThrow(/503/);
  });
});

describe("buildProductLock", () => {
  it("always starts with PRODUCT LOCK and switches presentation on keepWear", () => {
    expect(buildProductLock(false).startsWith("PRODUCT LOCK:")).toBe(true);
    expect(buildProductLock(true).startsWith("PRODUCT LOCK:")).toBe(true);
    expect(buildProductLock(false)).toContain("Texture is not damage.");
    expect(buildProductLock(true)).toContain("Do not make it look brand-new.");
  });
});
