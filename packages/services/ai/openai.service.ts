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

export function generateFallbackListingText(params: GenerateTextParams): IAiGeneratedText {
  const title = params.userTitle?.trim() || "Trending Product";
  const desc = params.userDescription?.trim() || "High quality premium material, durable design, perfect for daily and festive wear.";
  const cleanPhone = params.whatsappNumber?.replace(/[^0-9]/g, "") || "";
  const offerPrice = params.discountPrice ? `₹${params.discountPrice}` : params.price ? `₹${params.price}` : "Best Wholesale Price";
  const mrp = params.discountPrice && params.price ? `~₹${params.price}~` : "";
  const sizesStr = params.sizes?.length ? params.sizes.join(", ") : "Free Size / Standard";

  return {
    seoTitle: `${title} - Premium Quality & Best Price Online`,
    seoDescription: `Buy authentic ${title} online at ${offerPrice}. Premium material, verified quality, fast dispatch, and Cash on Delivery. Order now!`,
    keyFeatures: [
      `Premium Grade Craftsmanship: Designed with durable, high-grade materials for long-lasting use`,
      `Optimal Fit & Everyday Comfort: Tailored design suitable for ${sizesStr}`,
      `Fade-Resistant Finish: Retains rich texture and vibrant colors through repeated washes`,
      `Fast Dispatch & Easy Returns: Dispatched within 24-48 hours with 100% replacement guarantee`,
    ],
    keywords: [
      title.toLowerCase(),
      "trending online",
      "best seller marketplace",
      "premium quality",
      "cash on delivery",
      "wholesale fashion deals",
      "fast dispatch",
      "latest collection",
    ],
    meeshoListing: {
      title: `${title} - Trending Collection`,
      description: `Product Name: ${title}\n\nFabric/Material: Premium High-Grade\nSizes Available: ${sizesStr}\nColor/Pattern: As per product image\nDetails: ${desc}\n\nDispatch Timeline: 1-2 Business Days\nPayment: Cash on Delivery (COD) / Prepaid Available\nReturns: Easy 7-Day Hassle-Free Return Policy\nCountry of Origin: India`,
      category: "Fashion & Lifestyle",
      subcategory: "Apparel & Accessories",
    },
    whatsappCaption: `✨ *EXCLUSIVE NEW ARRIVAL* ✨\n\n🛍️ *${title}*\n${mrp ? `💥 *Offer Price:* ${offerPrice} ${mrp}` : `💵 *Price:* ${offerPrice}`}\n📏 *Sizes Available:* ${sizesStr}\n\n✅ Premium Verified Quality\n🚚 Free Delivery & COD Available\n📦 Easy 7-Day Exchange Guarantee\n\n👇 *Click to order directly on WhatsApp:* \nhttps://wa.me/${cleanPhone}?text=Hi,%20I%20want%20to%20order%20${encodeURIComponent(title)}`,
    instagramCaption: `Upgrade your collection with our bestselling ${title}! ✨ Crafted for elegance, made for comfort. Tap the link in bio to grab yours before stock runs out! 🛍️ Available in ${sizesStr}. Direct message or WhatsApp us for instant booking.`,
    instagramHashtags: [
      "#shopnow",
      "#trendingnow",
      "#onlineseller",
      "#ecommerce",
      "#indianfashion",
      "#styleinspo",
      "#fashionblogger",
      "#onlineshoppingindia",
      "#d2cindia",
      "#bestseller",
    ],
  };
}

function buildPrompts(params: GenerateTextParams) {
  const systemPrompt = `You are Peshkar AI's elite e-commerce SEO copywriter and growth marketer specializing in multi-channel e-commerce (Amazon, Flipkart, Meesho, Shopify, D2C, Instagram & WhatsApp catalogs).
Your task is to write exceptionally high-converting, SEO-optimized product titles, descriptions, marketplace catalog specifications, WhatsApp broadcast copy, and Instagram posts.
Ensure titles have maximum search volume potential, descriptions include high commercial intent keywords, bullet points are persuasive, and social captions include clear call-to-actions and emojis.
CRITICAL: Respond ONLY with valid, raw JSON matching the requested structure. Do not wrap in markdown quotes or extra text.`;

  const userContent = `
Product Details:
- Title: ${params.userTitle || "Product"}
- Description / Material: ${params.userDescription || "High quality material"}
- Custom Instructions / Prompt: ${params.userPrompt || "N/A"}
- Original MRP: ${params.price ? `₹${params.price}` : "N/A"}
- Discount / Selling Price: ${params.discountPrice ? `₹${params.discountPrice}` : "N/A"}
- Sizes Available: ${params.sizes?.length ? params.sizes.join(", ") : "Free Size / Standard"}
- Colors/Variants: ${params.variants?.length ? params.variants.join(", ") : "Standard"}
- CTA: ${params.ctaText || "Order Now via WhatsApp"}
- Store Name: ${params.storeName || "Our Store"}
- WhatsApp Number: ${params.whatsappNumber || "Contact for order"}
- Instagram Handle: ${params.instagramHandle || "@shop"}

Generate the JSON with the following exact keys:
{
  "seoTitle": "String - 50-80 chars high-converting, keyword-rich product title for e-commerce search algorithms",
  "seoDescription": "String - 150-160 chars SEO meta description with hook, keywords, and COD / trust appeal",
  "keyFeatures": [
    "String - Feature 1 highlighting material quality and durability",
    "String - Feature 2 highlighting fit, sizing, and comfort",
    "String - Feature 3 highlighting style, finish, and aesthetic",
    "String - Feature 4 highlighting care instructions, dispatch, or guarantee"
  ],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
  "meeshoListing": {
    "title": "String - Multi-channel marketplace optimized title following seller best practices (Type + Fabric + Pattern + Color)",
    "description": "String - Detailed marketplace catalog description with fabric, specifications, sizing, and return policy",
    "category": "String - Primary Category (e.g. Women Ethnic Wear, Fashion Accessories, etc.)",
    "subcategory": "String - Specific Subcategory"
  },
  "whatsappCaption": "String - Highly formatted WhatsApp message with emojis, bold highlights (*text*), prices, sizes, and direct order link",
  "instagramCaption": "String - Engaging Instagram caption with hook, benefits, and CTA",
  "instagramHashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"]
}
`;

  return { systemPrompt, userContent };
}

/**
 * Direct non-streaming generation for BullMQ worker and tRPC self-healing.
 * Always returns complete, valid IAiGeneratedText.
 */
export async function generateListingText(params: GenerateTextParams): Promise<IAiGeneratedText> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("YOUR_OPENAI_API_KEY") || apiKey === "sk-mock-key") {
    return generateFallbackListingText(params);
  }

  const { systemPrompt, userContent } = buildPrompts(params);

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    if (!raw) {
      return generateFallbackListingText(params);
    }

    const parsed = JSON.parse(raw);

    // Sanitize and ensure no empty values
    const fallback = generateFallbackListingText(params);
    return {
      seoTitle: parsed.seoTitle?.trim() || fallback.seoTitle,
      seoDescription: parsed.seoDescription?.trim() || fallback.seoDescription,
      keyFeatures: Array.isArray(parsed.keyFeatures) && parsed.keyFeatures.length > 0 ? parsed.keyFeatures : fallback.keyFeatures,
      keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0 ? parsed.keywords : fallback.keywords,
      meeshoListing: {
        title: parsed.meeshoListing?.title?.trim() || fallback.meeshoListing.title,
        description: parsed.meeshoListing?.description?.trim() || fallback.meeshoListing.description,
        category: parsed.meeshoListing?.category?.trim() || fallback.meeshoListing.category,
        subcategory: parsed.meeshoListing?.subcategory?.trim() || fallback.meeshoListing.subcategory,
      },
      whatsappCaption: parsed.whatsappCaption?.trim() || fallback.whatsappCaption,
      instagramCaption: parsed.instagramCaption?.trim() || fallback.instagramCaption,
      instagramHashtags: Array.isArray(parsed.instagramHashtags) && parsed.instagramHashtags.length > 0 ? parsed.instagramHashtags : fallback.instagramHashtags,
    };
  } catch (error) {
    console.warn("[OpenAI Service] generateListingText encountered an error, using fallback SEO text:", error);
    return generateFallbackListingText(params);
  }
}

/**
 * Streaming version for real-time text streaming.
 */
export async function generateListingTextStream(
  params: GenerateTextParams,
  onChunk?: (chunk: { field: string; content: string }) => void
): Promise<IAiGeneratedText> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("YOUR_OPENAI_API_KEY") || apiKey === "sk-mock-key") {
    const fallback = generateFallbackListingText(params);
    if (onChunk) {
      onChunk({ field: "fallback", content: JSON.stringify(fallback) });
    }
    return fallback;
  }

  const { systemPrompt, userContent } = buildPrompts(params);

  try {
    const openai = getOpenAIClient();
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

    const parsed = JSON.parse(fullText);
    const fallback = generateFallbackListingText(params);
    return {
      seoTitle: parsed.seoTitle?.trim() || fallback.seoTitle,
      seoDescription: parsed.seoDescription?.trim() || fallback.seoDescription,
      keyFeatures: Array.isArray(parsed.keyFeatures) && parsed.keyFeatures.length > 0 ? parsed.keyFeatures : fallback.keyFeatures,
      keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0 ? parsed.keywords : fallback.keywords,
      meeshoListing: {
        title: parsed.meeshoListing?.title?.trim() || fallback.meeshoListing.title,
        description: parsed.meeshoListing?.description?.trim() || fallback.meeshoListing.description,
        category: parsed.meeshoListing?.category?.trim() || fallback.meeshoListing.category,
        subcategory: parsed.meeshoListing?.subcategory?.trim() || fallback.meeshoListing.subcategory,
      },
      whatsappCaption: parsed.whatsappCaption?.trim() || fallback.whatsappCaption,
      instagramCaption: parsed.instagramCaption?.trim() || fallback.instagramCaption,
      instagramHashtags: Array.isArray(parsed.instagramHashtags) && parsed.instagramHashtags.length > 0 ? parsed.instagramHashtags : fallback.instagramHashtags,
    };
  } catch (error) {
    console.warn("[OpenAI Service] Streaming failed, using fallback:", error);
    const fallback = generateFallbackListingText(params);
    if (onChunk) {
      onChunk({ field: "fallback", content: JSON.stringify(fallback) });
    }
    return fallback;
  }
}
