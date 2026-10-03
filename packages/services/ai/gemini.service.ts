import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { trackAIGeneration } from "./ai-observability";

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
}

export async function generateStudioImages(params: {
  originalImages: Buffer[];
  prompt: string;
  count: number;
}): Promise<GeneratedImageOutput[]> {
  const { originalImages, prompt, count } = params;
  const ai = getGeminiClient();

  const variationTypes: ("studio_white" | "studio_premium" | "lifestyle" | "custom")[] = [
    "studio_white", // Variation 1: Guaranteed pure clean white background (#FFFFFF) for Amazon/Flipkart
    "studio_premium", // Variation 2: Premium pleasing editorial studio
    "lifestyle", // Variation 3: Aspirational lifestyle
    "custom", // Variation 4: Custom style
  ];

  if (ai) {
    try {
      const results: GeneratedImageOutput[] = [];

      for (let i = 0; i < count; i++) {
        const variation = variationTypes[i % variationTypes.length]!;
        const strictFidelityRule = "CRITICAL INSTRUCTION: Preserve 100% exact visual identity and details of the subject item (DO NOT add, alter, or remove chains, straps, pockets, logos, emblems, badges, zippers, or materials). DO NOT hallucinate phantom accessories. DO optimize orientation, posture, and staging: if the product is slouched, folded, tilted, or lying casually, straighten it upright, un-crumple its form naturally, and present it in a proud, symmetrical, upright commercial studio pose.";
        let specializedPrompt = "";

        if (variation === "studio_white") {
          specializedPrompt = `${strictFidelityRule} Commercial product catalog photography of the exact product shown, set against a seamless, solid 100% pure white background (#FFFFFF). The subject product is standing upright, perfectly centered, crisp, with sharp edges and rich textures. Natural, soft subtle contact shadow anchored directly under the base of the product on the pure white floor, creating realistic depth without dirt or tint. Studio diffused softbox lighting with even balance and accurate true-to-life colors. Zero background clutter, zero gray cast, 100% Amazon, Flipkart, and Meesho marketplace standard e-commerce hero image. ${prompt}`;
        } else if (variation === "studio_premium") {
          specializedPrompt = `${strictFidelityRule} Award-winning luxury commercial studio product photography of the exact product shown. The product is standing upright and elegantly displayed on a minimalist sculpted pedestal or podium (matte stone, travertine, or architectural ceramic). Soft dramatic studio rim lighting, cinematic fill light, gentle warm ambient glow, and refined directional shadows. Subtle shallow depth of field with a beautifully blurred, warm neutral architectural studio background. 8K UHD advertising campaign aesthetic, ultra-clean and pleasing to the eyes. ${prompt}`;
        } else if (variation === "lifestyle") {
          specializedPrompt = `${strictFidelityRule} Modern aesthetic lifestyle commercial product photography of the exact product shown. The product is standing upright and artfully staged in an aspirational, sunlit contemporary home setting (clean wooden surface, soft morning sunlight through window, subtle elegant decor accents). Natural ambient shadows, authentic atmosphere, premium lifestyle catalog visual. ${prompt}`;
        } else {
          specializedPrompt = `${strictFidelityRule} Creative commercial product photography of the exact product shown, styled according to: ${prompt}. Pristine lighting, commercial advertising grade.`;
        }

        // Build input payload with text prompt and reference images
        const inputPayload: any[] = [{ type: "text", text: specializedPrompt }];
        if (originalImages && originalImages.length > 0) {
          for (const img of originalImages.slice(0, 3)) {
            inputPayload.push({
              type: "image",
              mime_type: "image/jpeg",
              data: img.toString("base64"),
            });
          }
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
          input: specializedPrompt,
          output: imageBase64 ? `[Image generated: ${variation}]` : "[No image returned]",
          latencySeconds,
          traceId: interactionId,
        });

        if (imageBase64) {
          const imgBuffer = Buffer.from(imageBase64, "base64");
          results.push({
            buffer: imgBuffer,
            interactionId,
            variationType: variation,
            promptUsed: specializedPrompt,
          });
        }
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

  // High quality Fallback Studio Composite for development/offline/testing:
  // Creates studio lighting, background gradient, and places the original product centered
  const results: GeneratedImageOutput[] = [];
  const baseImg = originalImages[0] || (await sharp({
    create: {
      width: 1000,
      height: 1000,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  }).png().toBuffer());

  for (let i = 0; i < count; i++) {
    const variation = variationTypes[i % variationTypes.length]!;
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

    results.push({
      buffer: compositeBuffer,
      interactionId,
      variationType: variation,
      promptUsed: `${prompt} (${variation})`,
    });
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
        input: `${newPrompt}. CRITICAL: Maintain 100% exact visual identity, colors, hardware, and details of original product (no phantom chains, no altered logos). Keep product standing upright, clean, and commercially presented.`,
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
