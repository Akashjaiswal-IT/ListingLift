import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { trackAIGeneration } from "./ai-observability";
import { checkProductFidelity } from "./fidelity-check.service";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("YOUR_GEMINI_API_KEY")) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export interface GeneratedImageOutput {
  buffer: Buffer;
  interactionId: string;
  variationType: "studio_white" | "studio_premium" | "lifestyle" | "custom";
  promptUsed: string;
  // Set when the fidelity check still flagged this (kept) image after the retry
  fidelityIssues?: string[];
}

type StudioVariation = GeneratedImageOutput["variationType"];

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

// Placed FIRST in every prompt: the product must stay identical to the photo(s).
const PRODUCT_LOCK_RULE =
  "PRODUCT LOCK: The product must be pixel-faithful to the reference photo(s). Do NOT add, remove or change ANY part, object, accessory, content, logo, text, colour, or material. Pockets, holders and compartments must look exactly as in the photo (empty if empty). No items inside, on, or attached to the product. You may ONLY change: background, surface, lighting, shadows, reflections, and minor straightening of the product's pose.";

/**
 * Fallback studio composite for development/offline/testing, or when Gemini
 * returns no image: studio background + soft contact shadow, with the ORIGINAL
 * photo placed centered. Never used to replace a Gemini image that the fidelity
 * check disliked - a pasted raw phone photo is worse than a minor deviation.
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
    .webp({ quality: 90 })
    .toBuffer();

  return {
    buffer: compositeBuffer,
    interactionId,
    variationType: variation,
    promptUsed: `${prompt} (${variation})`,
  };
}

export async function generateStudioImages(params: {
  originalImages: Buffer[];
  prompt: string;
  count: number;
  multiAngle?: boolean;
}): Promise<GeneratedImageOutput[]> {
  const { originalImages, prompt, count, multiAngle = false } = params;
  const ai = getGeminiClient();

  const useMultiAngle = multiAngle && originalImages.length >= 2;
  const shotPlan = planStudioShots(originalImages.length, count, useMultiAngle);

  if (ai) {
    try {
      const results: GeneratedImageOutput[] = [];

      for (let i = 0; i < count; i++) {
        const { sourceIndex, variation } = shotPlan[i]!;
        let sceneText = "";

        if (variation === "studio_white") {
          sceneText = `Commercial product catalog photography of the exact product shown, set against a seamless, solid 100% pure white background (#FFFFFF). The subject product is standing upright, perfectly centered, crisp, with sharp edges and rich textures. Natural, soft subtle contact shadow anchored directly under the base of the product on the pure white floor, creating realistic depth without dirt or tint. Studio diffused softbox lighting with even balance and accurate true-to-life colors. Zero background clutter, zero gray cast, 100% Amazon, Flipkart, and Meesho marketplace standard e-commerce hero image. ${prompt}`;
        } else if (variation === "studio_premium") {
          sceneText = `Award-winning luxury commercial studio product photography of the exact product shown. The product is standing upright and elegantly displayed on a minimalist sculpted pedestal or podium (matte stone, travertine, or architectural ceramic). Soft dramatic studio rim lighting, cinematic fill light, gentle warm ambient glow, and refined directional shadows. Subtle shallow depth of field with a beautifully blurred, warm neutral architectural studio background. 8K UHD advertising campaign aesthetic, ultra-clean and pleasing to the eyes. ${prompt}`;
        } else if (variation === "lifestyle") {
          sceneText = `Modern aesthetic lifestyle commercial product photography of the exact product shown. The product is standing upright and staged in an aspirational, sunlit contemporary home setting (clean wooden surface, soft morning sunlight through window). Any props or decor may appear only in the background and must never touch, overlap, or sit inside or on the product. Natural ambient shadows, authentic atmosphere, premium lifestyle catalog visual. ${prompt}`;
        } else {
          sceneText = `Creative commercial product photography of the exact product shown, styled according to: ${prompt}. Pristine lighting, commercial advertising grade.`;
        }

        // Multi-angle: the assigned photo goes first (the viewpoint to reproduce),
        // followed by up to 2 other photos purely as detail references.
        let referenceImages = originalImages.slice(0, 3);
        let viewpointLock = "";
        if (useMultiAngle) {
          referenceImages = [
            originalImages[sourceIndex]!,
            ...originalImages.filter((_, idx) => idx !== sourceIndex).slice(0, 2),
          ];
          viewpointLock = `VIEWPOINT LOCK: Reproduce the product from the SAME camera angle and viewpoint as the FIRST reference image (this is angle ${sourceIndex + 1} of ${originalImages.length}). The other reference images are ONLY for product detail, texture and colour accuracy - do NOT switch to their viewpoint. `;
        }
        const specializedPrompt = `${PRODUCT_LOCK_RULE} ${viewpointLock}${sceneText}`;

        // One Gemini call for this slot: text prompt + reference images
        const generateOnce = async (promptText: string) => {
          const inputPayload: any[] = [{ type: "text", text: promptText }];
          for (const img of referenceImages) {
            inputPayload.push({
              type: "image",
              mime_type: "image/jpeg",
              data: img.toString("base64"),
            });
          }

          // Generate via Google GenAI Interactions API (gemini-3.1-flash-image)
          const geminiStart = Date.now();
          const interaction: any = await (ai as any).interactions.create({
            model: "gemini-3.1-flash-image",
            input: inputPayload,
            response_format: {
              type: "image",
              mime_type: "image/jpeg",
              aspect_ratio: "1:1",
            },
          });
          const latencySeconds = (Date.now() - geminiStart) / 1000;

          const imageBase64 = interaction?.output_image?.data;
          const interactionId =
            interaction?.id ||
            `int_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          trackAIGeneration({
            provider: "gemini",
            model: "gemini-3.1-flash-image",
            input: promptText,
            output: imageBase64 ? `[Image generated: ${variation}]` : "[No image returned]",
            latencySeconds,
            traceId: interactionId,
          });

          return {
            buffer: imageBase64 ? Buffer.from(imageBase64, "base64") : null,
            interactionId,
          };
        };

        const first = await generateOnce(specializedPrompt);
        if (!first.buffer) continue;

        const firstCheck = await checkProductFidelity({
          originalImages: referenceImages,
          generatedImage: first.buffer,
        });
        if (firstCheck.pass) {
          results.push({
            buffer: first.buffer,
            interactionId: first.interactionId,
            variationType: variation,
            promptUsed: specializedPrompt,
          });
          continue;
        }

        // Rejected: regenerate the SAME slot once, telling the model what went wrong
        console.warn(
          `Fidelity check rejected ${variation} image (photo ${sourceIndex + 1}): ${firstCheck.issues.join("; ")}`
        );
        const retryPrompt = `${specializedPrompt} PREVIOUS ATTEMPT WAS REJECTED because: ${firstCheck.issues.join("; ")}. Do NOT include any of these.`;
        const retry = await generateOnce(retryPrompt);

        if (!retry.buffer) {
          results.push({
            buffer: first.buffer,
            interactionId: first.interactionId,
            variationType: variation,
            promptUsed: specializedPrompt,
            fidelityIssues: firstCheck.issues,
          });
          continue;
        }

        const retryCheck = await checkProductFidelity({
          originalImages: referenceImages,
          generatedImage: retry.buffer,
        });
        if (!retryCheck.pass) {
          // Keep the Gemini retry anyway (it got the explicit warning) and record
          // the complaint, instead of degrading to a pasted raw photo.
          console.warn(
            `Fidelity check rejected ${variation} retry (photo ${sourceIndex + 1}), keeping it: ${retryCheck.issues.join("; ")}`
          );
        }
        results.push({
          buffer: retry.buffer,
          interactionId: retry.interactionId,
          variationType: variation,
          promptUsed: retryPrompt,
          ...(retryCheck.pass ? {} : { fidelityIssues: retryCheck.issues }),
        });
      }

      if (results.length > 0) {
        return results;
      }
    } catch (err) {
      trackAIGeneration({
        provider: "gemini",
        model: "gemini-3.1-flash-image",
        input: prompt,
        output: "",
        latencySeconds: 0,
        isError: true,
        errorMessage: String(err),
      });
      console.warn("Gemini generation failed, falling back to Sharp studio composite:", err);
    }
  }

  // Fallback for development/offline/testing: studio composite of the original product
  const results: GeneratedImageOutput[] = [];
  for (let i = 0; i < count; i++) {
    const { sourceIndex, variation } = shotPlan[i]!;
    results.push(
      await buildSharpStudioComposite({ baseImg: originalImages[sourceIndex], variation, prompt })
    );
  }

  return results;
}

export async function reEditStudioImage(params: {
  originalImages: Buffer[];
  previousImage: Buffer;
  interactionId: string;
  newPrompt: string;
}): Promise<GeneratedImageOutput> {
  const { originalImages, previousImage, interactionId, newPrompt } = params;
  const ai = getGeminiClient();

  if (ai) {
    try {
      // Use multi-turn editing with previous_interaction_id for seamless conversational editing
      const interaction: any = await (ai as any).interactions.create({
        model: "gemini-3.1-flash-image",
        input: `${PRODUCT_LOCK_RULE} Apply the user's requested change to the scene. Only change the product itself if the user explicitly asks to change the product. User request: ${newPrompt}`,
        previous_interaction_id: interactionId,
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: "1:1",
        },
      });

      const imageBase64 = interaction?.output_image?.data;
      const newInteractionId =
        interaction?.id ||
        `int_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      if (imageBase64) {
        return {
          buffer: Buffer.from(imageBase64, "base64"),
          interactionId: newInteractionId,
          variationType: "custom",
          promptUsed: newPrompt,
        };
      }
    } catch (err) {
      console.warn("Gemini re-edit failed, using fallback:", err);
    }
  }

  // Fallback: apply new edit aesthetic
  const editedBuffer = await sharp(previousImage || originalImages[0])
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .webp({ quality: 90 })
    .toBuffer();

  return {
    buffer: editedBuffer,
    interactionId: `int_reedit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    variationType: "custom",
    promptUsed: newPrompt,
  };
}
