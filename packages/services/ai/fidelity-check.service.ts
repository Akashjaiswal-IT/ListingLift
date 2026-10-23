import OpenAI from "openai";
import sharp from "sharp";
import { trackAIGeneration } from "./ai-observability";
import { inventoryToChecklist, type ProductInventory } from "./product-inventory";

// gpt-4.1 read printed text and product boxes correctly on real seller photos where gpt-4o-mini did not, and
// gpt-4o-mini bills ~15x more tokens per image, so per call it costs about the same or less.
export const FIDELITY_JUDGE_MODEL = "gpt-4.1";
const FIDELITY_TIMEOUT_MS = 15000;
const MAX_JUDGE_SIDE = 1024;

export interface ProductFidelityResult {
  pass: boolean;
  issues: string[];
  /** False when the judge could not run (no key, error, timeout, bad reply). */
  verified: boolean;
}

const UNVERIFIED: ProductFidelityResult = { pass: true, issues: [], verified: false };

// Keeps token cost and latency bounded; non-image buffers are sent as-is.
async function toJudgeJpeg(buf: Buffer): Promise<Buffer> {
  try {
    return await sharp(buf)
      .rotate()
      .resize(MAX_JUDGE_SIDE, MAX_JUDGE_SIDE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    return buf;
  }
}

function imagePart(buf: Buffer) {
  return {
    type: "image_url" as const,
    image_url: { url: `data:image/jpeg;base64,${buf.toString("base64")}`, detail: "high" as const },
  };
}

function buildJudgePrompt(checklist: string, keepWear: boolean, hasCrop: boolean): string {
  const checklistSection = checklist
    ? `CHECKLIST (written from the original photo by another model - it can contain mistakes):
${checklist}
For EACH numbered item: first confirm it is visible in the ORIGINAL. If it is NOT visible in the original, it is a list error - ignore it and put its number in "listErrors". If it is visible in the original, check it is preserved in the GENERATED image; if not, FAIL and name it.
`
    : "";

  const wearRule = keepWear
    ? "WEAR: the seller wants the product shown in its real condition. Scuffs, scratches, fading, peeling print or frayed edges that are visible in the original must still be visible in the generated image - removed or reduced wear is a FAILURE."
    : "WEAR: removed scuffs, scratches, fading, peeling print or frayed edges are fine (the product is presented as new).";

  return `You are a strict but fair e-commerce quality inspector.
Compare the PRODUCT in the GENERATED image against the ORIGINAL product photo(s)${hasCrop ? " and the ORIGINAL close-up crop" : ""}. The product must not be altered: nothing added, nothing removed, no text changed.

${checklistSection}Then check the whole product for:
- ADDITIONS: anything on the product in the generated image that is not on the original - extra parts, pockets, straps, zips, buttons, hardware, stitching lines, seams, panels, patterns, logos or text.
- REMOVALS: parts visible in the original that are missing in the generated image.
- TEXT: any printed text that is changed, garbled, misspelled or invented is a FAILURE.
- COLOUR / MATERIAL: a clearly different base colour or material is a FAILURE.

PASS (ignore) these intended improvements: the product straightened or re-posed, a filled-out shape, creases, wrinkles, dust or lint removed, colour / white-balance / lighting correction, a different camera angle, sharper detail, and background or props that do not touch the product. Judge the orientation of stripes and panels relative to the product's own seams and edges, NOT the image frame - an angled photo can make a vertical stripe look diagonal. When the original is shot at an angle, a straightened view may also reveal the matching counterpart of a part that was visible on the other side (e.g. the second side pocket of a bag); that is not an addition. Anything else new on the product, or anything placed in or on it, IS an addition.
${wearRule}

Fail only for concrete differences you can point to. Do not fail for things you cannot see clearly in the original.

Respond ONLY with JSON: {"pass": boolean, "issues": string[], "listErrors": number[]}.
Each issue is one short concrete sentence naming what changed and where, usable as a fix instruction (e.g. "an extra zip was added on the left side panel", "the printed text 'fx-991MS' is garbled"). Use an empty issues list when pass is true.`;
}

/**
 * Asks a vision model whether the product in a generated image is identical to
 * the original photo(s). Fail-open: with no API key, or on any error, timeout or
 * unparsable reply, it returns pass with verified=false so generation never breaks.
 */
export async function checkProductFidelity(params: {
  originalImages: Buffer[];
  generatedImage: Buffer;
  inventory?: ProductInventory | null;
  originalCrop?: Buffer | null;
  keepWear?: boolean;
}): Promise<ProductFidelityResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("YOUR_OPENAI_API_KEY") || apiKey === "sk-mock-key") {
    return { ...UNVERIFIED };
  }

  const keepWear = params.keepWear === true;
  const checklist = inventoryToChecklist(params.inventory, { keepWear });
  const promptText = buildJudgePrompt(checklist, keepWear, !!params.originalCrop);

  const startTime = Date.now();
  try {
    const [originals, crop, generated] = await Promise.all([
      Promise.all(params.originalImages.slice(0, 2).map(toJudgeJpeg)),
      params.originalCrop ? toJudgeJpeg(params.originalCrop) : Promise.resolve(null),
      toJudgeJpeg(params.generatedImage),
    ]);

    const content = [
      { type: "text" as const, text: promptText },
      ...originals.flatMap((buf) => [{ type: "text" as const, text: "ORIGINAL photo:" }, imagePart(buf)]),
      ...(crop
        ? [{ type: "text" as const, text: "ORIGINAL close-up crop of the same product:" }, imagePart(crop)]
        : []),
      { type: "text" as const, text: "GENERATED image to verify:" },
      imagePart(generated),
    ];

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create(
      {
        model: FIDELITY_JUDGE_MODEL,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
        temperature: 0,
      },
      { timeout: FIDELITY_TIMEOUT_MS, maxRetries: 0 }
    );

    const raw = response.choices[0]?.message?.content?.trim() || "";

    trackAIGeneration({
      provider: "openai",
      model: FIDELITY_JUDGE_MODEL,
      input: promptText,
      output: raw,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      latencySeconds: (Date.now() - startTime) / 1000,
    });

    const parsed = JSON.parse(raw);
    if (typeof parsed?.pass !== "boolean") {
      throw new Error("Unexpected fidelity check reply");
    }
    if (parsed.pass) return { pass: true, issues: [], verified: true };

    const issues: string[] = Array.isArray(parsed.issues)
      ? parsed.issues
          .filter((s: unknown) => typeof s === "string" || typeof s === "number")
          .map((s: unknown) => String(s).replace(/\s+/g, " ").trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 8)
      : [];
    if (issues.length === 0) issues.push("product differs from the original photo");
    return { pass: false, issues, verified: true };
  } catch (err) {
    trackAIGeneration({
      provider: "openai",
      model: FIDELITY_JUDGE_MODEL,
      input: promptText,
      output: "",
      latencySeconds: (Date.now() - startTime) / 1000,
      isError: true,
      errorMessage: String(err),
    });
    console.warn("Product fidelity check failed, accepting image:", err);
    return { ...UNVERIFIED };
  }
}
