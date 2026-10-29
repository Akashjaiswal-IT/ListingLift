import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { trackAIGeneration } from "./ai-observability";
import { checkProductFidelity } from "./fidelity-check.service";
import {
  inventoryToPromptBlock,
  SMALL_PRINT_NOTE,
  type ProductBox,
  type ProductInventory,
} from "./product-inventory";
import {
  checkShotQuality,
  cropToBox,
  finishWhiteShot,
  toMarketplaceJpeg,
  type ShotProblem,
  type WhiteShotResult,
} from "../image/listing-export.service";
import {
  acquireGeminiCapacity,
  estimateGeminiCallUsd,
  GEMINI_CALL_TIMEOUT_MS,
  isGeminiRateLimitError,
  noteGeminiRateLimited,
} from "./gemini-rate-limiter";
import { aiOfflineFallbackAllowed } from "./offline-fallback";

const GEMINI_IMAGE_MODEL = "gemini-nano-banana-2.1";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("YOUR_GEMINI_API_KEY")) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export type FidelityStatus = "verified" | "issues" | "not_verified";

export interface GeneratedImageOutput {
  buffer: Buffer;
  interactionId: string;
  variationType: "studio_white" | "studio_premium" | "lifestyle" | "custom";
  promptUsed: string;
  // Set when the fidelity check still flagged this (kept) image after all attempts
  fidelityIssues?: string[];
  fidelityStatus: FidelityStatus;
  /** Gemini calls made for this slot (0 for the offline Sharp composite). */
  attempts: number;
}

type StudioVariation = GeneratedImageOutput["variationType"];
export type QualityMode = "standard" | "pro";

const variationTypes: StudioVariation[] = [
  "studio_white", // Variation 1: Guaranteed pure clean white background (#FFFFFF) for Amazon/Flipkart
  "studio_premium", // Variation 2: Premium pleasing editorial studio
  "lifestyle", // Variation 3: Aspirational lifestyle
  "custom", // Variation 4: Custom style
];

export interface StudioShotPlan {
  sourceIndex: number;
  variation: StudioVariation;
}

/**
 * Plans which uploaded photo and which variation each generated image uses.
 *
 * Multi-angle (Listing Kit, 2+ photos): round 1 makes one pure-white image per
 * photo in upload order, then later rounds cycle through the photos again with
 * alternating premium / lifestyle styling, so every angle is represented.
 * Otherwise (Quick Product): cycle variations by index, always from photo 0.
 */
export function planStudioShots(
  photoCount: number,
  count: number,
  multiAngle: boolean
): StudioShotPlan[] {
  const plan: StudioShotPlan[] = [];
  const styledVariations: StudioVariation[] = ["studio_premium", "lifestyle"];

  for (let i = 0; i < count; i++) {
    if (multiAngle && photoCount >= 2) {
      if (i < photoCount) {
        plan.push({ sourceIndex: i, variation: "studio_white" });
      } else {
        const round = i - photoCount;
        plan.push({
          sourceIndex: round % photoCount,
          variation: styledVariations[round % styledVariations.length]!,
        });
      }
    } else {
      plan.push({ sourceIndex: 0, variation: variationTypes[i % variationTypes.length]! });
    }
  }

  return plan;
}

const PRODUCT_DESIGN_LOCK =
  "PRODUCT LOCK: Reproduce the exact same product design as the reference photo(s): same model and silhouette, same panels, pockets, zippers, straps, handles and hardware, same colours and materials, and every logo, label and printed graphic exactly as printed (including faded or distressed print effects). Do NOT add, remove or replace any part, object, accessory or text. Pockets, holders and compartments stay empty if they are empty. Nothing inside, on, or attached to the product.";

// A "pixel-faithful" wording made Gemini paste the slouched, creased phone-photo
// product onto the new background, so presentation is allowed to improve.
const PRESENT_AS_NEW =
  "PRESENT IT AS BRAND-NEW RETAIL STOCK: standing upright and symmetrical, filled out to its natural structured shape, with no slouching, creases, wrinkles, dents, dust, lint, stains or loose threads, and its true colour under neutral light. Keep the material's natural surface texture visible: fabric weave, leather grain, stitching, brushed or polished metal finish. Texture is not damage. Only the product's condition and pose improve - never its design.";

const PRESENT_WITH_WEAR =
  "PRESENT IT CLEANLY AND HONESTLY: you may straighten its pose, fill out its natural shape, and improve background and lighting, but keep every visible sign of use exactly as in the photo (scuffs, scratches, fading, peeling print, worn edges). Do not make it look brand-new. Only the pose, background and lighting improve - never the product's design or condition.";

/** Placed FIRST in every prompt: the design never changes; presentation depends on keepWear. */
export function buildProductLock(keepWear: boolean): string {
  return `${PRODUCT_DESIGN_LOCK} ${keepWear ? PRESENT_WITH_WEAR : PRESENT_AS_NEW}`;
}

// One lighting plan for every variation so a listing's images look like one shoot.
const SHARED_LIGHTING =
  "Lighting: a soft key light from camera-left at about 45 degrees and slightly above the product, a white fill from the right that keeps the shadows open, daylight-balanced neutral colour (about 5500K), and a real soft contact shadow where the product meets the surface.";

const REAL_PHOTO =
  "It must look like a real photograph taken with a camera in a studio: true material texture, natural reflections and shadows, no illustrated or computer-generated look.";

export function buildSceneText(variation: StudioVariation, scenePrompt: string): string {
  switch (variation) {
    case "studio_white":
      // No scene prompt: the background must stay pure white
      return `Turn the reference photo into a catalog photograph of this same product on a seamless pure white (#FFFFFF) backdrop, with no tint, colour cast or gradient and nothing else in the frame. Camera at eye level with a 100mm lens at around f/11, so the whole product is sharp from front to back. The whole product is in frame and centred, with a comfortable margin on every side. ${SHARED_LIGHTING} ${REAL_PHOTO}`;
    case "studio_premium":
      return `Photograph this same product for a premium brand catalogue, standing on a sculpted stone pedestal (travertine, honed stone or matte ceramic). ${SHARED_LIGHTING} Keep the key light gentle and directional so it shapes the product. Shallow, natural depth of field: the product is fully sharp while the warm neutral background behind it falls softly out of focus. ${REAL_PHOTO} ${scenePrompt}`;
    case "lifestyle":
      return `Photograph this same product in a realistic, relatable home setting, such as a wooden table or shelf in a lived-in room. Soft natural window light from camera-left acts as the key light. ${SHARED_LIGHTING} Any props or decor stay in the background and never touch, overlap, or sit inside or on the product. The product is the clear, fully sharp subject. ${REAL_PHOTO} ${scenePrompt}`;
    default:
      return `Photograph this same product as a professional product photographer would, following this style direction: ${scenePrompt}. Unless that direction asks for different lighting: ${SHARED_LIGHTING} ${REAL_PHOTO}`;
  }
}

function safeInventoryBlock(inventory: ProductInventory | null | undefined, keepWear: boolean): string {
  if (!inventory) return "";
  try {
    return inventoryToPromptBlock(inventory, { keepWear }).trim();
  } catch (err) {
    console.warn("Could not build product inventory block, continuing without it:", err);
    return "";
  }
}

// Post-processing must never cost the user an image, so fall back to a plain JPEG encode.
async function safeJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    return await toMarketplaceJpeg(buffer);
  } catch (err) {
    console.warn("toMarketplaceJpeg failed, using a plain JPEG encode:", err);
    return sharp(buffer).jpeg({ quality: 92 }).toBuffer();
  }
}

async function safeCrop(buffer: Buffer, box: ProductBox | null | undefined): Promise<Buffer | null> {
  if (!box) return null;
  try {
    return await cropToBox(buffer, box);
  } catch (err) {
    console.warn("cropToBox failed, sending no close-up reference:", err);
    return null;
  }
}

/**
 * Offline studio composite for local development (see aiOfflineFallbackAllowed): studio
 * background + soft contact shadow, with the ORIGINAL photo placed centered. Never used
 * to replace a Gemini image that the fidelity check disliked.
 */
async function buildSharpStudioComposite(params: {
  baseImg: Buffer | undefined;
  variation: StudioVariation;
  prompt: string;
}): Promise<GeneratedImageOutput> {
  const { variation, prompt } = params;
  const baseImg =
    params.baseImg ||
    (await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    }).png().toBuffer());
  const interactionId = `int_gemini_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const isPureWhite = variation === "studio_white";
  const bg = isPureWhite
    ? { r: 255, g: 255, b: 255 } // 100% Pure White for Amazon/Flipkart standard
    : variation === "studio_premium"
    ? { r: 247, g: 245, b: 240 } // Warm luxury limestone/champagne
    : variation === "lifestyle"
    ? { r: 250, g: 246, b: 242 } // Warm organic daylight
    : { r: 240, g: 243, b: 246 }; // Modern slate studio

  const resizedProduct = await sharp(baseImg)
    .resize(800, 800, { fit: "inside" })
    .webp({ quality: 90 })
    .toBuffer();

  // Generate soft subtle contact shadow SVG beneath the product
  const shadowSvg = Buffer.from(`
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="contactShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="${isPureWhite ? "0.22" : "0.18"}"/>
          <stop offset="60%" stop-color="#000000" stop-opacity="${isPureWhite ? "0.08" : "0.05"}"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="512" cy="855" rx="330" ry="26" fill="url(#contactShadow)"/>
    </svg>
  `);

  const compositeBuffer = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: bg.r, g: bg.g, b: bg.b, alpha: 1 },
    },
  })
    .composite([
      { input: shadowSvg, top: 0, left: 0 },
      { input: resizedProduct, gravity: "center" },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  return {
    buffer: await safeJpeg(compositeBuffer),
    interactionId,
    variationType: variation,
    promptUsed: `${prompt} (${variation})`,
    fidelityStatus: "not_verified",
    attempts: 0,
  };
}

interface GeminiCallResult {
  buffer: Buffer | null;
  interactionId: string;
}

interface Candidate {
  /** Finished (post-processed) image. */
  buffer: Buffer;
  interactionId: string;
  prompt: string;
  detProblems: ShotProblem[];
  /** Null until the paid judge has run on this candidate. */
  judge: { pass: boolean; issues: string[]; verified: boolean } | null;
}

interface SlotContext {
  ai: GoogleGenAI;
  variation: StudioVariation;
  pro: boolean;
  keepWear: boolean;
  primary: Buffer;
  primaryBox: ProductBox | null;
  crop: Buffer | null;
  /** Original photos sent to Gemini and the judge (primary first; never the crop). */
  referenceImages: Buffer[];
  productInventory: ProductInventory | null;
}

/** Request options shared by every call in a slot; Pro upgrades only the white main image. */
function slotRequestOptions(ctx: SlotContext): Record<string, unknown> {
  const responseFormat: Record<string, unknown> = {
    type: "image",
    mime_type: "image/jpeg",
    aspect_ratio: "1:1",
  };
  if (!ctx.pro) return { response_format: responseFormat };
  return {
    response_format: { ...responseFormat, image_size: "2K" },
    generation_config: { thinking_level: "high" },
  };
}

function buildReferencePayload(prompt: string, ctx: SlotContext): any[] {
  const image = (buf: Buffer) => ({ type: "image", mime_type: "image/jpeg", data: buf.toString("base64") });
  const payload: any[] = [{ type: "text", text: prompt }];
  payload.push({ type: "text", text: "Reference photo — viewpoint and product:" }, image(ctx.primary));
  if (ctx.crop) {
    payload.push(
      { type: "text", text: "Close-up of the same product from that photo, for detail only:" },
      image(ctx.crop)
    );
  }
  for (const other of ctx.referenceImages.slice(1)) {
    payload.push({ type: "text", text: "Another angle of the same product, for detail only:" }, image(other));
  }
  return payload;
}

/**
 * Every Gemini image call goes through here: it waits for room under the shared project limits
 * (requests/minute and the rolling 10-minute spend cap), applies a per-attempt timeout (the SDK
 * default is none), and after a 429 pauses all callers. The SDK itself already retries 429/5xx
 * a few times with backoff before giving up.
 */
async function createInteraction(ai: unknown, params: Record<string, unknown>, imageSize: "1K" | "2K"): Promise<any> {
  await acquireGeminiCapacity(estimateGeminiCallUsd(imageSize));
  try {
    return await (ai as any).interactions.create(params, { timeout_ms: GEMINI_CALL_TIMEOUT_MS });
  } catch (err) {
    if (isGeminiRateLimitError(err)) await noteGeminiRateLimited();
    throw err;
  }
}

async function callGemini(
  ctx: SlotContext,
  request: Record<string, unknown>,
  promptText: string,
  attempt: number,
  kind: "fresh" | "fix"
): Promise<GeminiCallResult> {
  const start = Date.now();
  const interaction: any = await createInteraction(
    ctx.ai,
    { model: GEMINI_IMAGE_MODEL, ...request, ...slotRequestOptions(ctx) },
    ctx.pro ? "2K" : "1K"
  );
  const latencySeconds = (Date.now() - start) / 1000;

  const imageBase64 = interaction?.output_image?.data;
  const interactionId =
    interaction?.id || `int_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  trackAIGeneration({
    provider: "gemini",
    model: GEMINI_IMAGE_MODEL,
    input: promptText,
    output: imageBase64 ? `[Image generated: ${ctx.variation}]` : "[No image returned]",
    inputTokens: interaction?.usage?.total_input_tokens,
    outputTokens: interaction?.usage?.total_output_tokens,
    thoughtTokens: interaction?.usage?.total_thought_tokens,
    latencySeconds,
    traceId: interactionId,
    properties: {
      variation: ctx.variation,
      imageSize: ctx.pro ? "2K" : "1K",
      attempt,
      kind,
    },
  });

  return { buffer: imageBase64 ? Buffer.from(imageBase64, "base64") : null, interactionId };
}

function generateFresh(ctx: SlotContext, prompt: string, attempt: number) {
  return callGemini(ctx, { input: buildReferencePayload(prompt, ctx) }, prompt, attempt, "fresh");
}

// Multi-turn edit of the rejected image: keeps its good composition and only fixes what failed.
function generateFix(ctx: SlotContext, previousId: string, fixPrompt: string, attempt: number) {
  return callGemini(
    ctx,
    { input: fixPrompt, previous_interaction_id: previousId },
    fixPrompt,
    attempt,
    "fix"
  );
}

/** Post-processes a raw Gemini image and runs the free deterministic checks (no paid judge). */
async function finishCandidate(
  ctx: SlotContext,
  raw: Buffer,
  interactionId: string,
  prompt: string
): Promise<Candidate> {
  let finished: WhiteShotResult = { buffer: raw, productCutOff: false, backgroundFailed: false };
  try {
    finished =
      ctx.variation === "studio_white"
        ? await finishWhiteShot(raw)
        : { buffer: await toMarketplaceJpeg(raw), productCutOff: false, backgroundFailed: false };
  } catch (err) {
    console.warn(`Post-processing failed for ${ctx.variation}, using a plain JPEG:`, err);
    finished = { buffer: await sharp(raw).jpeg({ quality: 92 }).toBuffer(), productCutOff: false, backgroundFailed: false };
  }

  let detProblems: ShotProblem[] = [];
  try {
    detProblems = await checkShotQuality({
      generated: finished.buffer,
      original: ctx.primary,
      originalBox: ctx.primaryBox,
      variation: ctx.variation,
      productCutOff: finished.productCutOff,
      backgroundFailed: finished.backgroundFailed,
      // An untouched white shot could not be measured reliably, so never spend a retry on its blur score.
      skipBlur: finished.untouched === true,
    });
  } catch (err) {
    console.warn("checkShotQuality failed, skipping deterministic checks:", err);
  }

  return { buffer: finished.buffer, interactionId, prompt, detProblems, judge: null };
}

async function judgeCandidate(ctx: SlotContext, candidate: Candidate): Promise<void> {
  const judge = await checkProductFidelity({
    originalImages: ctx.referenceImages,
    generatedImage: candidate.buffer,
    inventory: ctx.productInventory,
    originalCrop: ctx.crop,
    keepWear: ctx.keepWear,
  });
  candidate.judge = { pass: judge.pass, issues: judge.issues, verified: judge.verified !== false };
}

/** Deterministic problems are free to find, so the paid judge only runs on clean candidates. */
async function evaluateCandidate(
  ctx: SlotContext,
  raw: Buffer,
  interactionId: string,
  prompt: string
): Promise<Candidate> {
  const candidate = await finishCandidate(ctx, raw, interactionId, prompt);
  if (candidate.detProblems.length === 0) await judgeCandidate(ctx, candidate);
  return candidate;
}

// An unverifiable image is accepted: retries are never spent on judge uncertainty.
function isAccepted(c: Candidate): boolean {
  return c.detProblems.length === 0 && !!c.judge && (c.judge.pass || !c.judge.verified);
}

function candidateIssues(c: Candidate): string[] {
  const judgeIssues = c.judge && c.judge.verified && !c.judge.pass ? c.judge.issues : [];
  return [...c.detProblems.map((p) => p.message), ...judgeIssues];
}

/** Fewest by `count`; ties go to the later attempt, which got the explicit feedback. */
function fewest(candidates: Candidate[], count: (c: Candidate) => number): Candidate {
  return candidates.reduce((best, c) => (count(c) <= count(best) ? c : best));
}

/** Every shipped image gets a fidelity verdict: judged candidates beat never-judged ones. */
async function pickCandidate(ctx: SlotContext, candidates: Candidate[]): Promise<Candidate> {
  const passing = candidates.find(isAccepted);
  if (passing) return passing;
  const judged = candidates.filter((c) => c.judge);
  if (judged.length > 0) return fewest(judged, (c) => c.judge!.issues.length);
  const best = fewest(candidates, (c) => c.detProblems.length);
  await judgeCandidate(ctx, best);
  return best;
}

function statusOf(c: Candidate): FidelityStatus {
  if (c.detProblems.length > 0) return "issues";
  if (!c.judge || !c.judge.verified) return "not_verified";
  return c.judge.pass ? "verified" : "issues";
}

const PRESENTATION_PROBLEMS: ShotProblem["code"][] = ["blurry", "cut_off", "background_not_white"];

function buildFixPrompt(previous: Candidate, keepWear: boolean): string {
  const issueText = candidateIssues(previous).join("; ");
  const presentationOnly =
    previous.detProblems.length > 0 &&
    previous.detProblems.every((p) => PRESENTATION_PROBLEMS.includes(p.code));
  const note = presentationOnly
    ? "These are photography problems, not product problems: leave the product itself exactly as it is. "
    : "";
  return `PREVIOUS ATTEMPT WAS REJECTED because: ${issueText}. In the image you just generated, fix ONLY these problems. ${note}Keep everything else exactly the same: the product's design and every detail, and every part of the photo the problems above do not mention. ${buildProductLock(keepWear)}`;
}

/**
 * maxCalls is a hard cap on Gemini calls per slot. Call 1 is fresh; later calls
 * are targeted multi-turn fixes of the last rejected image, except that a failed
 * fix and Pro's 3rd call regenerate fresh (a second edit of a twice-rejected
 * image tends to stack artefacts).
 */
async function generateSlot(
  ctx: SlotContext,
  specializedPrompt: string
): Promise<GeneratedImageOutput | null> {
  const maxCalls = ctx.pro ? 3 : 2;
  const candidates: Candidate[] = [];
  let calls = 0;
  let fixFailed = false;

  while (calls < maxCalls) {
    const previous = candidates[candidates.length - 1];
    if (previous && isAccepted(previous)) break;
    const callNo = calls + 1;
    calls++;

    if (!previous) {
      // Errors on the first call propagate: the caller isolates them per slot
      const result = await generateFresh(ctx, specializedPrompt, callNo);
      if (!result.buffer) return null;
      candidates.push(await evaluateCandidate(ctx, result.buffer, result.interactionId, specializedPrompt));
      continue;
    }

    const issueText = candidateIssues(previous).join("; ");
    console.warn(`Rejected ${ctx.variation} image (call ${callNo - 1}): ${issueText}`);
    const useFix = !fixFailed && callNo < 3;
    const prompt = useFix
      ? buildFixPrompt(previous, ctx.keepWear)
      : `${specializedPrompt} PREVIOUS ATTEMPT WAS REJECTED because: ${issueText}. Do NOT include any of these.`;

    let result: GeminiCallResult = { buffer: null, interactionId: "" };
    try {
      result = useFix
        ? await generateFix(ctx, previous.interactionId, prompt, callNo)
        : await generateFresh(ctx, prompt, callNo);
    } catch (err) {
      console.warn(`${useFix ? "Targeted fix" : "Regeneration"} failed for ${ctx.variation}:`, err);
    }
    if (!result.buffer) {
      // A failed fix hands the remaining budget to a fresh regeneration
      if (useFix) {
        fixFailed = true;
        continue;
      }
      break;
    }
    candidates.push(await evaluateCandidate(ctx, result.buffer, result.interactionId, prompt));
  }

  const chosen = await pickCandidate(ctx, candidates);
  const fidelityStatus = statusOf(chosen);
  const issues = candidateIssues(chosen);
  if (fidelityStatus === "issues") {
    console.warn(`Keeping flagged ${ctx.variation} image after ${calls} calls: ${issues.join("; ")}`);
  }

  return {
    buffer: chosen.buffer,
    interactionId: chosen.interactionId,
    variationType: ctx.variation,
    promptUsed: chosen.prompt,
    ...(fidelityStatus === "issues" ? { fidelityIssues: issues } : {}),
    fidelityStatus,
    attempts: calls,
  };
}

export async function generateStudioImages(params: {
  originalImages: Buffer[];
  prompt: string;
  count: number;
  multiAngle?: boolean;
  productInventory?: ProductInventory | null;
  /** One entry per original image, aligned by index. */
  productBoxes?: (ProductBox | null)[];
  keepWear?: boolean;
  qualityMode?: QualityMode;
}): Promise<GeneratedImageOutput[]> {
  const {
    originalImages,
    prompt,
    count,
    multiAngle = false,
    productInventory = null,
    productBoxes,
    keepWear = false,
    qualityMode = "standard",
  } = params;
  const ai = getGeminiClient();

  const useMultiAngle = multiAngle && originalImages.length >= 2;
  const shotPlan = planStudioShots(originalImages.length, count, useMultiAngle);
  const productLock = buildProductLock(keepWear);
  const inventoryBlock = safeInventoryBlock(productInventory, keepWear);

  const fallbackAll = async () => {
    const results: GeneratedImageOutput[] = [];
    for (const { sourceIndex, variation } of shotPlan) {
      results.push(await buildSharpStudioComposite({ baseImg: originalImages[sourceIndex], variation, prompt }));
    }
    return results;
  };
  if (!ai) {
    if (aiOfflineFallbackAllowed()) return fallbackAll();
    throw new Error("Gemini image model is not configured (GEMINI_API_KEY)");
  }

  // Per slot: an image, null (Gemini returned none) or "error"
  const slots: (GeneratedImageOutput | null | "error")[] = [];
  let firstError: unknown;
  for (let i = 0; i < count; i++) {
    const { sourceIndex, variation } = shotPlan[i]!;
    try {
      const primaryIndex = useMultiAngle ? sourceIndex : 0;
      const primary = originalImages[primaryIndex]!;

      // Multi-angle: the assigned photo first (the viewpoint to reproduce),
      // followed by up to 2 other photos purely as detail references.
      let referenceImages = originalImages.slice(0, 3);
      let viewpointLock = "";
      if (useMultiAngle) {
        referenceImages = [
          primary,
          ...originalImages.filter((_, idx) => idx !== sourceIndex).slice(0, 2),
        ];
        viewpointLock = `VIEWPOINT LOCK: Reproduce the product from the SAME camera angle and viewpoint as the FIRST reference photo (this is angle ${sourceIndex + 1} of ${originalImages.length}). The close-up and other angles are ONLY for product detail, texture and colour accuracy - do NOT switch to their viewpoint. `;
      }

      const primaryBox = productBoxes?.[primaryIndex] ?? null;
      const ctx: SlotContext = {
        ai,
        variation,
        pro: qualityMode === "pro" && variation === "studio_white",
        keepWear,
        primary,
        primaryBox,
        crop: await safeCrop(primary, primaryBox),
        referenceImages,
        productInventory,
      };

      const specializedPrompt = [productLock, inventoryBlock, `${viewpointLock}${buildSceneText(variation, prompt)}`]
        .filter(Boolean)
        .join(" ");

      slots.push(await generateSlot(ctx, specializedPrompt));
    } catch (err) {
      trackAIGeneration({
        provider: "gemini",
        model: GEMINI_IMAGE_MODEL,
        input: prompt,
        output: "",
        latencySeconds: 0,
        isError: true,
        errorMessage: String(err),
      });
      console.warn(`Gemini generation failed for ${variation} (slot ${i + 1}):`, err);
      firstError ??= err;
      slots.push("error");
    }
  }

  const produced = slots.filter((s): s is GeneratedImageOutput => !!s && s !== "error");
  if (produced.length < count && !aiOfflineFallbackAllowed()) {
    // The seller paid for every slot: fail the listing so the job retries and then refunds,
    // instead of delivering their own photo pasted on a background.
    const reason = firstError ? `: ${firstError instanceof Error ? firstError.message : String(firstError)}` : " (no image returned)";
    throw new Error(`Gemini produced ${produced.length} of ${count} studio images${reason}`);
  }

  // Local development with AI_OFFLINE_FALLBACK=1 only: composites stand in for missing slots
  if (produced.length === 0) return fallbackAll();

  const results: GeneratedImageOutput[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot === "error") {
      const { sourceIndex, variation } = shotPlan[i]!;
      results.push(await buildSharpStudioComposite({ baseImg: originalImages[sourceIndex], variation, prompt }));
    } else if (slot) {
      results.push(productInventory?.smallPrint ? withSmallPrintNote(slot) : slot);
    }
  }
  return results;
}

// The judge only checks fully legible text, so a "verified" small-print product could still
// carry redrawn tiny labels; never let it show as verified.
function withSmallPrintNote(output: GeneratedImageOutput): GeneratedImageOutput {
  return {
    ...output,
    fidelityStatus: "issues",
    fidelityIssues: [...(output.fidelityIssues ?? []), SMALL_PRINT_NOTE],
  };
}

// The user may have asked for a coloured background, so white finishing only applies when it succeeds.
async function finishReEdit(
  raw: Buffer,
  variationType: string | undefined
): Promise<{ buffer: Buffer; isWhiteShot: boolean }> {
  if (variationType === "studio_white") {
    try {
      const finished = await finishWhiteShot(raw);
      if (!finished.backgroundFailed) return { buffer: finished.buffer, isWhiteShot: true };
    } catch (err) {
      console.warn("finishWhiteShot failed on re-edit, using a plain JPEG:", err);
    }
  }
  return { buffer: await safeJpeg(raw), isWhiteShot: false };
}

export async function reEditStudioImage(params: {
  originalImages: Buffer[];
  previousImage: Buffer;
  interactionId: string;
  newPrompt: string;
  keepWear?: boolean;
  /** Variation of the image being edited; "studio_white" keeps the marketplace white finishing. */
  variationType?: string;
}): Promise<GeneratedImageOutput> {
  const { interactionId, newPrompt, keepWear = false, variationType } = params;
  const ai = getGeminiClient();
  // No silent stand-in for a paid re-edit (the old fallback recoloured the previous image):
  // every failure throws so the re-edit processor marks the job failed and refunds the credit.
  if (!ai) throw new Error("Re-edit is unavailable: the image model is not configured");

  // Multi-turn editing with previous_interaction_id continues the original generation
  const interaction: any = await createInteraction(ai, {
    model: GEMINI_IMAGE_MODEL,
    input: `${buildProductLock(keepWear)} Apply the user's requested change to the scene. Only change the product itself if the user explicitly asks to change the product. User request: ${newPrompt}`,
    previous_interaction_id: interactionId,
    response_format: {
      type: "image",
      mime_type: "image/jpeg",
      aspect_ratio: "1:1",
    },
  }, "1K");

  const imageBase64 = interaction?.output_image?.data;
  if (!imageBase64) throw new Error("Re-edit failed: the image model returned no image");

  const finished = await finishReEdit(Buffer.from(imageBase64, "base64"), variationType);
  return {
    buffer: finished.buffer,
    interactionId: interaction?.id || `int_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    // A re-edit that is still a valid white shot stays the main image, so later re-edits keep the white finishing.
    variationType: finished.isWhiteShot ? "studio_white" : "custom",
    promptUsed: newPrompt,
    fidelityStatus: "not_verified",
    attempts: 1,
  };
}
