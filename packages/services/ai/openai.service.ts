import OpenAI from "openai";
import { IAiGeneratedText } from "@repo/database";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || "sk-mock-key";
  return new OpenAI({ apiKey });
}

export interface GenerateTextParams {
  userTitle: string;
  userDescription?: string;
  userPrompt?: string;
  price?: number;
  discountPrice?: number;
  sizes?: string[];
  variants?: string[];
  ctaText?: string;
  storeName?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
  originalImageUrls?: string[];
}

export async function generateListingTextStream(
  params: GenerateTextParams,
  onChunk?: (chunk: { field: string; content: string }) => void
): Promise<IAiGeneratedText> {
  const openai = getOpenAIClient();

  const systemPrompt = `You are ListingLift's elite e-commerce listing copywriter specializing in Indian e-commerce (Meesho, WhatsApp catalogs, Instagram, Flipkart, Amazon).
Your task is to write high-converting, SEO-optimized product titles, descriptions, Meesho catalog copy, WhatsApp broadcast copy, and Instagram posts.
Write with high commercial intent, clean formatting, persuasive bullet points, and appropriate emojis for social platforms.
Respond ONLY with valid JSON matching the requested structure.`;

  const userContent = `
Product Details:
- Title: ${params.userTitle}
- Description: ${params.userDescription || "N/A"}
- Custom Instructions/Prompt: ${params.userPrompt || "N/A"}
- Original Price: ${params.price ? `₹${params.price}` : "N/A"}
- Discount/Offer Price: ${params.discountPrice ? `₹${params.discountPrice}` : "N/A"}
- Sizes Available: ${params.sizes?.length ? params.sizes.join(", ") : "Free Size / Standard"}
- Colors/Variants: ${params.variants?.length ? params.variants.join(", ") : "Standard"}
- CTA: ${params.ctaText || "Order Now"}
- Store Name: ${params.storeName || "Our Store"}
- WhatsApp Number: ${params.whatsappNumber || "Contact for order"}
- Instagram Handle: ${params.instagramHandle || "@shop"}

Generate the JSON with the following exact keys:
{
  "seoTitle": "String - 50-80 chars high-converting product title",
  "seoDescription": "String - 150-160 chars SEO meta description",
  "keyFeatures": ["String", "String", "String", "String"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6"],
  "meeshoListing": {
    "title": "String - Meesho optimized title",
    "description": "String - Detailed Meesho catalog description with fabric/specifications",
    "category": "String - Primary Category",
    "subcategory": "String - Subcategory"
  },
  "whatsappCaption": "String - WhatsApp message ready to copy & paste with emojis, prices, sizes, and CTA",
  "instagramCaption": "String - Engaging Instagram caption with hook, benefits, and CTA",
  "instagramHashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8"]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      stream: true,
    });

    let fullText = "";

    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullText += content;
        if (onChunk) {
          onChunk({ field: "stream", content });
        }
      }
    }

    const parsed = JSON.parse(fullText) as IAiGeneratedText;
    return parsed;
  } catch (error: any) {
    // If OpenAI API key is placeholder or network fails in dev/test, return fallback high quality copy
    if (
      process.env.NODE_ENV !== "production" ||
      !process.env.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY.includes("YOUR_OPENAI_API_KEY")
    ) {
      const fallback: IAiGeneratedText = {
        seoTitle: `${params.userTitle} - Premium Quality & Best Price`,
        seoDescription: `Shop authentic ${params.userTitle} at unbeatable prices. Premium fabric, verified quality, and fast shipping. Order now!`,
        keyFeatures: [
          "Premium Grade Craftsmanship & Durable Material",
          "Ultra-comfortable fit designed for everyday elegance",
          "Vibrant colors and fade-resistant finish",
          "Easy care and machine washable",
        ],
        keywords: [
          params.userTitle.toLowerCase(),
          "trending fashion",
          "best seller",
          "meesho deals",
          "online shopping",
          "wholesale rate",
        ],
        meeshoListing: {
          title: `${params.userTitle} - Trending Collection`,
          description: `Product Name: ${params.userTitle}\n\nFabric/Material: Premium High-Grade\nSizes Available: ${params.sizes?.join(", ") || "Free Size"}\nColor/Pattern: As per image\nDispatch: 1-2 Business Days\nCash on Delivery (COD) Available\nEasy 7 Days Return Policy`,
          category: "Fashion & Lifestyle",
          subcategory: "Apparel & Accessories",
        },
        whatsappCaption: `✨ *EXCLUSIVE NEW ARRIVAL* ✨\n\n🛍️ *${params.userTitle}*\n${params.discountPrice ? `💥 Offer Price: ₹${params.discountPrice} ~₹${params.price || ""}~` : `💵 Price: ₹${params.price || "Best Price"}`}\n📏 Sizes: ${params.sizes?.join(", ") || "Free Size"}\n\n🚚 Free Delivery & COD Available!\n\n👇 *Click to order on WhatsApp:* \nhttps://wa.me/${params.whatsappNumber?.replace(/[^0-9]/g, "") || ""}?text=Hi,%20I%20want%20to%20order%20${encodeURIComponent(params.userTitle)}`,
        instagramCaption: `Upgrade your style with our bestselling ${params.userTitle}! ✨ Crafted for elegance, made for comfort. Tap the link in bio to grab yours before stock runs out! 🛍️✨`,
        instagramHashtags: [
          "#shopnow",
          "#trendingnow",
          "#meeshoseller",
          "#indianfashion",
          "#styleinspo",
          "#fashionblogger",
          "#onlineshoppingindia",
        ],
      };

      if (onChunk) {
        onChunk({ field: "fallback", content: JSON.stringify(fallback) });
      }
      return fallback;
    }

    throw error;
  }
}
