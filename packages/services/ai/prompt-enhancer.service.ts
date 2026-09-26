import OpenAI from "openai";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || "sk-mock-key";
  return new OpenAI({ apiKey });
}

export interface PromptEnhancerParams {
  imageBuffers: Buffer[];
  userTitle?: string;
  userDescription?: string;
  userPrompt?: string;
}

export async function enhancePromptWithVision(
  params: PromptEnhancerParams
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Fallback for dev / tests if API key is placeholder
  if (!apiKey || apiKey.includes("YOUR_OPENAI_API_KEY")) {
    const customPromptPart = params.userPrompt ? `, ${params.userPrompt}` : "";
    return `Professional studio commercial product photography of ${params.userTitle || "the product"}${customPromptPart}. Crisp 8k resolution, clean minimalist podium, soft directional studio lighting, hyper-realistic textures, clean shadow falloff, commercial advertising style.`;
  }

  const openai = getOpenAIClient();

  const base64Images = params.imageBuffers.slice(0, 2).map((buf) => {
    return {
      type: "image_url" as const,
      image_url: {
        url: `data:image/jpeg;base64,${buf.toString("base64")}`,
        detail: "low" as const,
      },
    };
  });

  const promptText = `
You are an expert commercial advertising art director.
Analyze this product image and craft an ultra-detailed, photorealistic image generation prompt for Google Gemini/Imagen.
Product Title: ${params.userTitle || "Product"}
Product Description: ${params.userDescription || "N/A"}
User's Custom Style Direction: ${params.userPrompt || "High-end clean e-commerce studio background"}

Rules:
1. Preserve the EXACT product geometry, color, and distinguishing features shown in the image.
2. Place the product on an elegant, professional e-commerce studio setting (clean podium, textured marble/concrete/warm wood, soft natural sunlight or studio key light, subtle depth of field).
3. Specify lighting (soft diffuse lighting, subtle rim lighting, soft reflections).
4. Do NOT include text, watermarks, or distorted artifacts.
5. Return ONLY the final enhanced generation prompt string.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            ...base64Images,
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const enhanced = response.choices[0]?.message?.content?.trim();
    if (enhanced) {
      return enhanced;
    }
  } catch {
    // Fall back to well-crafted template
  }

  return `Award-winning commercial product photography of ${params.userTitle || "the item"}, placed on a sleek minimalist architectural pedestal, soft cinematic studio lighting, elegant diffused reflections, 8k uhd, photorealistic, pristine details, ${params.userPrompt || "neutral luxury aesthetic"}.`;
}
