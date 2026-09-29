import sharp from "sharp";

export interface SellerInfo {
  storeName?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
  logoBuffer?: Buffer;
}

export type TemplateId =
  | "minimal-luxury"
  | "midnight-gold"
  | "clean-modern"
  | "neon-cyber"
  | "royal-emerald"
  | "pastel-bloom"
  | "sunset-glow"
  | "nordic-slate"
  | "festive-crimson"
  | "editorial-vogue";

export interface CardTemplateConfig {
  id: TemplateId;
  name: string;
  category: string;
  description: string;
  badge: string;
  bgGradStart: string;
  bgGradEnd: string;
  containerBg: string;
  containerText: string;
  priceColor: string;
  badgeBg: string;
  badgeText: string;
  ctaBg: string;
  ctaText: string;
  borderStroke: string;
  fontFamily: string;
  previewBg: string;
  isDark: boolean;
}

export const CARD_TEMPLATES: Record<TemplateId, CardTemplateConfig> = {
  "minimal-luxury": {
    id: "minimal-luxury",
    name: "Luxury Minimalist",
    category: "High-End & Designer",
    description: "Ivory tones, obsidian serif styling, and champagne gold accents",
    badge: "LUXE",
    bgGradStart: "#FBF9F5",
    bgGradEnd: "#EFE9DF",
    containerBg: "#FFFFFF",
    containerText: "#0F172A",
    priceColor: "#9A3412",
    badgeBg: "#F7F1E5",
    badgeText: "#92400E",
    ctaBg: "#0F172A",
    ctaText: "#F8FAFC",
    borderStroke: "#E5DDD0",
    fontFamily: "Georgia, serif",
    previewBg: "from-stone-100 to-amber-50",
    isDark: false,
  },
  "midnight-gold": {
    id: "midnight-gold",
    name: "Midnight Prestige",
    category: "Prestige & Premium",
    description: "Deep obsidian gradient with metallic 24K gold foil accents",
    badge: "PRESTIGE",
    bgGradStart: "#0B0F19",
    bgGradEnd: "#1A1B35",
    containerBg: "#111827",
    containerText: "#F9FAFB",
    priceColor: "#FBBF24",
    badgeBg: "#3730A3",
    badgeText: "#FCD34D",
    ctaBg: "#F59E0B",
    ctaText: "#0F172A",
    borderStroke: "#D97706",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-slate-950 via-indigo-950 to-slate-900",
    isDark: true,
  },
  "clean-modern": {
    id: "clean-modern",
    name: "Studio Clean White",
    category: "Tech & Lifestyle",
    description: "Crisp white studio layout with electric indigo focus",
    badge: "MODERN",
    bgGradStart: "#F8FAFC",
    bgGradEnd: "#E2E8F0",
    containerBg: "#FFFFFF",
    containerText: "#0F172A",
    priceColor: "#2563EB",
    badgeBg: "#EEF2FF",
    badgeText: "#4F46E5",
    ctaBg: "#4F46E5",
    ctaText: "#FFFFFF",
    borderStroke: "#CBD5E1",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-slate-100 to-indigo-50",
    isDark: false,
  },
  "neon-cyber": {
    id: "neon-cyber",
    name: "Neon Cyber Sale",
    category: "Streetwear & Flash Deals",
    description: "Electric cyan and hot magenta cyber aesthetic for high-impact drops",
    badge: "FLASH SALE",
    bgGradStart: "#09090B",
    bgGradEnd: "#18181B",
    containerBg: "#121217",
    containerText: "#FFFFFF",
    priceColor: "#06B6D4",
    badgeBg: "#BE123C",
    badgeText: "#FFE4E6",
    ctaBg: "#06B6D4",
    ctaText: "#000000",
    borderStroke: "#06B6D4",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-black via-zinc-900 to-cyan-950",
    isDark: true,
  },
  "royal-emerald": {
    id: "royal-emerald",
    name: "Royal Emerald",
    category: "Heritage & Traditional",
    description: "Deep forest emerald backdrop with opulent brass gold trim",
    badge: "HERITAGE",
    bgGradStart: "#022C22",
    bgGradEnd: "#064E3B",
    containerBg: "#064E3B",
    containerText: "#ECFDF5",
    priceColor: "#FDE047",
    badgeBg: "#047857",
    badgeText: "#FCD34D",
    ctaBg: "#F59E0B",
    ctaText: "#022C22",
    borderStroke: "#F59E0B",
    fontFamily: "Georgia, serif",
    previewBg: "from-emerald-950 via-teal-950 to-emerald-900",
    isDark: true,
  },
  "pastel-bloom": {
    id: "pastel-bloom",
    name: "Soft Pastel Chic",
    category: "Beauty & Fashion",
    description: "Delicate blush and rose gold tones with soft organic curves",
    badge: "TRENDING",
    bgGradStart: "#FFF1F2",
    bgGradEnd: "#FDF2F8",
    containerBg: "#FFFFFF",
    containerText: "#881337",
    priceColor: "#E11D48",
    badgeBg: "#FFE4E6",
    badgeText: "#9F1239",
    ctaBg: "#E11D48",
    ctaText: "#FFFFFF",
    borderStroke: "#FECDD3",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-rose-50 via-pink-50 to-rose-100",
    isDark: false,
  },
  "sunset-glow": {
    id: "sunset-glow",
    name: "Sunset Radiance",
    category: "Summer & Activewear",
    description: "Blazing amber to magenta sunset energy with high-contrast text",
    badge: "HOT DEAL",
    bgGradStart: "#2A0845",
    bgGradEnd: "#641530",
    containerBg: "#1C0A26",
    containerText: "#FFFFFF",
    priceColor: "#FB923C",
    badgeBg: "#C2410C",
    badgeText: "#FFEDD5",
    ctaBg: "#EA580C",
    ctaText: "#FFFFFF",
    borderStroke: "#EA580C",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-purple-950 via-orange-950 to-amber-950",
    isDark: true,
  },
  "nordic-slate": {
    id: "nordic-slate",
    name: "Nordic Minimalist",
    category: "Industrial & Minimal",
    description: "Muted charcoal and brushed steel with Swiss typographic precision",
    badge: "STUDIO",
    bgGradStart: "#0F172A",
    bgGradEnd: "#1E293B",
    containerBg: "#1E293B",
    containerText: "#F8FAFC",
    priceColor: "#38BDF8",
    badgeBg: "#334155",
    badgeText: "#CBD5E1",
    ctaBg: "#38BDF8",
    ctaText: "#0F172A",
    borderStroke: "#475569",
    fontFamily: "system-ui, sans-serif",
    previewBg: "from-slate-900 to-zinc-900",
    isDark: true,
  },
  "festive-crimson": {
    id: "festive-crimson",
    name: "Festive Crimson",
    category: "Festive & Wedding",
    description: "Regal ruby crimson with celebratory marigold yellow flourishes",
    badge: "CELEBRATION",
    bgGradStart: "#450A0A",
    bgGradEnd: "#7F1D1D",
    containerBg: "#5A0E17",
    containerText: "#FEF2F2",
    priceColor: "#FDE047",
    badgeBg: "#831843",
    badgeText: "#FDE047",
    ctaBg: "#EAB308",
    ctaText: "#450A0A",
    borderStroke: "#DC2626",
    fontFamily: "Georgia, serif",
    previewBg: "from-red-950 via-rose-950 to-red-900",
    isDark: true,
  },
  "editorial-vogue": {
    id: "editorial-vogue",
    name: "Editorial Vogue",
    category: "Couture & Editorial",
    description: "High-contrast monochrome couture layout with vivid scarlet accents",
    badge: "LIMITED EDIT",
    bgGradStart: "#FAFAFA",
    bgGradEnd: "#E4E4E7",
    containerBg: "#09090B",
    containerText: "#FFFFFF",
    priceColor: "#EF4444",
    badgeBg: "#DC2626",
    badgeText: "#FFFFFF",
    ctaBg: "#EF4444",
    ctaText: "#FFFFFF",
    borderStroke: "#18181B",
    fontFamily: "Georgia, serif",
    previewBg: "from-zinc-950 to-neutral-900",
    isDark: false,
  },
};

export const TEMPLATE_LIST = Object.values(CARD_TEMPLATES);

export interface CardRenderParams {
  productImage?: Buffer;
  productImageBuffer?: Buffer;
  productTitle?: string;
  title?: string;
  price?: number;
  discountPrice?: number;
  ctaText?: string;
  templateId?: string;
  sellerInfo?: SellerInfo;
  storeName?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
}

export interface RenderedCards {
  whatsappCard: Buffer;
  whatsapp: Buffer;
  instagramPost: Buffer;
  instagramStory: Buffer;
}

export async function renderSocialCards(params: CardRenderParams): Promise<RenderedCards> {
  const imgBuffer = params.productImage || params.productImageBuffer;
  if (!imgBuffer) {
    throw new Error("Product image buffer is required for card rendering");
  }

  const rawTitle = params.productTitle || params.title || "Exclusive Product";
  const titleText = escapeXml(rawTitle.slice(0, 36));
  const storeText = escapeXml(
    params.sellerInfo?.storeName || params.storeName || "Official Catalog"
  );
  const cta = escapeXml(params.ctaText || "Order Now");

  const templateKey = (params.templateId as TemplateId) || "minimal-luxury";
  const cfg = CARD_TEMPLATES[templateKey] || CARD_TEMPLATES["minimal-luxury"];

  const price = params.price;
  const discountPrice = params.discountPrice;
  const discountPct =
    price && discountPrice && price > discountPrice
      ? Math.round(((price - discountPrice) / price) * 100)
      : 0;

  const currentPriceFormatted = discountPrice
    ? `₹${discountPrice.toLocaleString("en-IN")}`
    : price
    ? `₹${price.toLocaleString("en-IN")}`
    : "Best Price";

  const originalPriceFormatted =
    discountPrice && price ? `₹${price.toLocaleString("en-IN")}` : "";

  // 1. WhatsApp Card (1080x1080 Square Card) - Matching Reference Image 3
  const waProduct = await sharp(imgBuffer)
    .rotate()
    .resize(920, 640, { fit: "cover", position: "center" })
    .toBuffer();

  const waBgSvg = Buffer.from(`
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${cfg.bgGradStart}"/>
          <stop offset="100%" stop-color="${cfg.bgGradEnd}"/>
        </linearGradient>
      </defs>
      
      <!-- Full background gradient -->
      <rect width="1080" height="1080" fill="url(#cardBgGrad)"/>

      <!-- Decorative Outer Border -->
      <rect x="40" y="35" width="1000" height="1010" rx="36" fill="none" stroke="${cfg.borderStroke}" stroke-width="2" stroke-opacity="0.6"/>
    </svg>
  `);

  const waFgSvg = Buffer.from(`
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <!-- Product frame border overlay -->
      <rect x="80" y="55" width="920" height="640" rx="24" fill="none" stroke="${cfg.borderStroke}" stroke-width="1.5" stroke-opacity="0.4"/>
      
      <!-- Top Badge over product photo -->
      <g>
        <rect x="105" y="75" width="170" height="38" rx="19" fill="${cfg.badgeBg}" opacity="0.96"/>
        <text x="190" y="100" font-family="${cfg.fontFamily}" font-size="14" font-weight="800" fill="${cfg.badgeText}" text-anchor="middle" letter-spacing="1">✦ ${discountPct > 0 ? `${discountPct}% OFF` : cfg.badge}</text>
      </g>

      <!-- Store Pill Tag on photo top right -->
      <g>
        <rect x="760" y="75" width="215" height="38" rx="19" fill="${cfg.containerBg}" opacity="0.94"/>
        <text x="867" y="100" font-family="${cfg.fontFamily}" font-size="13" font-weight="700" fill="${cfg.containerText}" text-anchor="middle">✦ ${storeText.slice(0, 16)}</text>
      </g>
      
      <!-- Bottom information card container -->
      <rect x="80" y="715" width="920" height="295" rx="28" fill="${cfg.containerBg}" filter="drop-shadow(0 20px 25px rgba(0,0,0,0.18))"/>
      
      <!-- Product Title -->
      <text x="120" y="768" font-family="${cfg.fontFamily}" font-size="32" font-weight="800" fill="${cfg.containerText}">${titleText}</text>
      
      <!-- Price Row -->
      <text x="120" y="830" font-family="${cfg.fontFamily}" font-size="44" font-weight="900" fill="${cfg.priceColor}">
        ${currentPriceFormatted}
        ${originalPriceFormatted ? `<tspan font-size="26" font-weight="600" fill="#9CA3AF" text-decoration="line-through">  ${originalPriceFormatted}</tspan>` : ""}
      </text>

      ${
        discountPct > 0
          ? `
        <rect x="360" y="796" width="115" height="34" rx="8" fill="#16A34A"/>
        <text x="417" y="819" font-family="${cfg.fontFamily}" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">${discountPct}% OFF</text>
      `
          : ""
      }
      
      <!-- Trust badges row: Free Shipping & COD -->
      <text x="120" y="876" font-family="${cfg.fontFamily}" font-size="15" font-weight="600" fill="${cfg.isDark ? "#94A3B8" : "#475569"}">
        ✓ Free Shipping   •   ✓ Cash on Delivery   •   ✓ 7-Day Easy Exchange
      </text>

      <!-- CTA Button -->
      <rect x="120" y="910" width="840" height="72" rx="20" fill="${cfg.ctaBg}"/>
      <text x="540" y="955" font-family="${cfg.fontFamily}" font-size="22" font-weight="800" fill="${cfg.ctaText}" text-anchor="middle">💬 ${cta}</text>
    </svg>
  `);

  const whatsappCard = await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 4,
      background: { r: 24, g: 24, b: 27, alpha: 1 },
    },
  })
    .composite([
      { input: waBgSvg, top: 0, left: 0 },
      { input: waProduct, top: 55, left: 80 },
      { input: waFgSvg, top: 0, left: 0 },
    ])
    .webp({ quality: 90 })
    .toBuffer();

  // 2. Instagram Post (1080x1080)
  const igProduct = await sharp(imgBuffer)
    .rotate()
    .resize(960, 780, { fit: "cover", position: "center" })
    .toBuffer();

  const igBgSvg = Buffer.from(`
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="igBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${cfg.bgGradStart}"/>
          <stop offset="100%" stop-color="${cfg.bgGradEnd}"/>
        </linearGradient>
      </defs>
      
      <rect width="1080" height="1080" fill="url(#igBg)"/>
      <rect x="35" y="35" width="1010" height="1010" rx="32" fill="none" stroke="${cfg.borderStroke}" stroke-width="2" stroke-opacity="0.4"/>
    </svg>
  `);

  const igFgSvg = Buffer.from(`
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <!-- Top Brand Tag -->
      <rect x="60" y="42" width="340" height="46" rx="23" fill="${cfg.containerBg}" opacity="0.95"/>
      <text x="85" y="72" font-family="${cfg.fontFamily}" font-size="16" font-weight="800" fill="${cfg.containerText}">✦ ${storeText}</text>
      
      <!-- Top Badge -->
      <rect x="880" y="42" width="140" height="46" rx="23" fill="${cfg.badgeBg}"/>
      <text x="950" y="72" font-family="${cfg.fontFamily}" font-size="14" font-weight="800" fill="${cfg.badgeText}" text-anchor="middle">${discountPct > 0 ? `${discountPct}% OFF` : cfg.badge}</text>

      <!-- Product frame border -->
      <rect x="60" y="98" width="960" height="780" rx="20" fill="none" stroke="${cfg.borderStroke}" stroke-width="1.5" stroke-opacity="0.35"/>

      <!-- Bottom Ribbon -->
      <rect x="60" y="900" width="960" height="130" rx="24" fill="${cfg.containerBg}" opacity="0.98" filter="drop-shadow(0 15px 20px rgba(0,0,0,0.25))"/>
      <text x="95" y="952" font-family="${cfg.fontFamily}" font-size="28" font-weight="800" fill="${cfg.containerText}">${titleText}</text>
      <text x="95" y="996" font-family="${cfg.fontFamily}" font-size="15" font-weight="600" fill="${cfg.isDark ? "#94A3B8" : "#64748B"}">Free Shipping • Cash on Delivery • 100% Quality Assured</text>
      <text x="980" y="965" font-family="${cfg.fontFamily}" font-size="36" font-weight="900" fill="${cfg.priceColor}" text-anchor="end">${currentPriceFormatted}</text>
      ${
        originalPriceFormatted
          ? `<text x="980" y="998" font-family="${cfg.fontFamily}" font-size="20" font-weight="600" fill="#9CA3AF" text-decoration="line-through" text-anchor="end">${originalPriceFormatted}</text>`
          : ""
      }
    </svg>
  `);

  const instagramPost = await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    },
  })
    .composite([
      { input: igBgSvg, top: 0, left: 0 },
      { input: igProduct, top: 98, left: 60 },
      { input: igFgSvg, top: 0, left: 0 },
    ])
    .webp({ quality: 90 })
    .toBuffer();

  // 3. Instagram Story (1080x1920 Full Bleed 9:16 Format)
  const storyProduct = await sharp(imgBuffer)
    .rotate()
    .resize(1080, 1420, { fit: "cover", position: "center" })
    .toBuffer();

  const storyBgSvg = Buffer.from(`
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="storyBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${cfg.bgGradStart}"/>
          <stop offset="100%" stop-color="${cfg.bgGradEnd}"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#storyBgGrad)"/>
    </svg>
  `);

  const storyFgSvg = Buffer.from(`
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="storyFade" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${cfg.containerBg}" stop-opacity="0"/>
          <stop offset="25%" stop-color="${cfg.containerBg}" stop-opacity="0.88"/>
          <stop offset="100%" stop-color="${cfg.containerBg}" stop-opacity="1"/>
        </linearGradient>
        <linearGradient id="topShadow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${cfg.containerBg}" stop-opacity="0.75"/>
          <stop offset="100%" stop-color="${cfg.containerBg}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      
      <!-- Top subtle shadow for status bar / brand tags -->
      <rect x="0" y="0" width="1080" height="240" fill="url(#topShadow)"/>

      <!-- Top Header -->
      <rect x="60" y="80" width="380" height="64" rx="32" fill="${cfg.containerBg}" opacity="0.95"/>
      <text x="95" y="122" font-family="${cfg.fontFamily}" font-size="22" font-weight="800" fill="${cfg.containerText}">✦ ${storeText}</text>
      
      <!-- Badge -->
      <rect x="860" y="80" width="160" height="64" rx="32" fill="${cfg.badgeBg}"/>
      <text x="940" y="122" font-family="${cfg.fontFamily}" font-size="18" font-weight="800" fill="${cfg.badgeText}" text-anchor="middle">${discountPct > 0 ? `${discountPct}% OFF` : cfg.badge}</text>
      
      <!-- Bottom Gradient Scrim Overlay over the lower part of photo -->
      <rect x="0" y="1080" width="1080" height="840" fill="url(#storyFade)"/>
      
      <!-- Title & Price Container -->
      <text x="70" y="1420" font-family="${cfg.fontFamily}" font-size="44" font-weight="800" fill="${cfg.containerText}">${titleText}</text>
      
      <text x="70" y="1510" font-family="${cfg.fontFamily}" font-size="56" font-weight="900" fill="${cfg.priceColor}">
        ${currentPriceFormatted}
        ${originalPriceFormatted ? `<tspan font-size="34" font-weight="600" fill="#9CA3AF" text-decoration="line-through">  ${originalPriceFormatted}</tspan>` : ""}
      </text>

      <text x="70" y="1565" font-family="${cfg.fontFamily}" font-size="22" font-weight="600" fill="${cfg.isDark ? "#94A3B8" : "#475569"}">
        ✓ Free All-India Delivery   •   ✓ Cash on Delivery (COD) Available
      </text>
      
      <!-- Swipe/Tap Button -->
      <rect x="70" y="1640" width="940" height="120" rx="60" fill="${cfg.ctaBg}"/>
      <text x="540" y="1715" font-family="${cfg.fontFamily}" font-size="32" font-weight="800" fill="${cfg.ctaText}" text-anchor="middle">👆 DM / Tap to Order Now</text>

      <!-- Bottom store credit -->
      <text x="540" y="1820" font-family="${cfg.fontFamily}" font-size="20" font-weight="700" fill="${cfg.badgeText}" text-anchor="middle" opacity="0.9">Direct Message to Inquire or WhatsApp Us</text>
    </svg>
  `);

  const instagramStory = await sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    },
  })
    .composite([
      { input: storyBgSvg, top: 0, left: 0 },
      { input: storyProduct, top: 120, left: 0 },
      { input: storyFgSvg, top: 0, left: 0 },
    ])
    .webp({ quality: 90 })
    .toBuffer();

  return {
    whatsappCard,
    whatsapp: whatsappCard,
    instagramPost,
    instagramStory,
  };
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}
