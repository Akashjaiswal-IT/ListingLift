import sharp from "sharp";

export interface SellerInfo {
  storeName?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
  logoBuffer?: Buffer;
}

export interface CardRenderParams {
  productImage?: Buffer;
  productImageBuffer?: Buffer;
  productTitle?: string;
  title?: string;
  price?: number;
  discountPrice?: number;
  ctaText?: string;
  sellerInfo?: SellerInfo;
  storeName?: string;
  whatsappNumber?: string;
  instagramHandle?: string;
}

export interface RenderedCards {
  whatsappCard: Buffer;
  instagramPost: Buffer;
  instagramStory: Buffer;
}

export async function renderSocialCards(params: CardRenderParams): Promise<RenderedCards> {
  const imgBuffer = params.productImage || params.productImageBuffer;
  if (!imgBuffer) {
    throw new Error("Product image buffer is required for card rendering");
  }

  const rawTitle = params.productTitle || params.title || "Exclusive Product";
  const titleText = escapeXml(rawTitle.slice(0, 38));
  const storeText = escapeXml(
    params.sellerInfo?.storeName || params.storeName || "Official Catalog"
  );
  const cta = escapeXml(params.ctaText || "Order Now");

  const price = params.price;
  const discountPrice = params.discountPrice;

  const priceText = discountPrice
    ? `₹${discountPrice} <tspan font-size="28" fill="#9CA3AF" text-decoration="line-through">₹${price || ""}</tspan>`
    : price
    ? `₹${price}`
    : "Best Price";

  // 1. WhatsApp Card (1080x1080 Square Card with Modern Badge & Price Tag)
  const waProduct = await sharp(imgBuffer)
    .resize(920, 680, { fit: "cover", position: "center" })
    .toBuffer();

  const waSvgOverlay = Buffer.from(`
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="waGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#111827"/>
          <stop offset="100%" stop-color="#1F2937"/>
        </linearGradient>
      </defs>
      
      <!-- Bottom card container -->
      <rect x="80" y="760" width="920" height="240" rx="28" fill="#FFFFFF" filter="drop-shadow(0 20px 25px rgba(0,0,0,0.15))"/>
      
      <!-- Store Badge -->
      <rect x="120" y="795" width="220" height="36" rx="8" fill="#EEF2F6"/>
      <text x="135" y="819" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="#4F46E5">${storeText.toUpperCase()}</text>
      
      <!-- Product Title -->
      <text x="120" y="875" font-family="system-ui, sans-serif" font-size="34" font-weight="800" fill="#111827">${titleText}</text>
      
      <!-- Price -->
      <text x="120" y="945" font-family="system-ui, sans-serif" font-size="44" font-weight="900" fill="#2563EB">${priceText}</text>
      
      <!-- CTA Button -->
      <rect x="740" y="885" width="220" height="75" rx="38" fill="#10B981"/>
      <text x="850" y="932" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#FFFFFF" text-anchor="middle">💬 ${cta}</text>
    </svg>
  `);

  const whatsappCard = await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 4,
      background: { r: 243, g: 244, b: 246, alpha: 1 },
    },
  })
    .composite([
      { input: waProduct, top: 60, left: 80 },
      { input: waSvgOverlay, top: 0, left: 0 },
    ])
    .webp({ quality: 90 })
    .toBuffer();

  // 2. Instagram Post (1080x1080 Minimalist Luxury Showcase)
  const igProduct = await sharp(imgBuffer)
    .resize(960, 840, { fit: "cover" })
    .toBuffer();

  const igPostOverlay = Buffer.from(`
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="igBanner" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#1E293B" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
      
      <!-- Top Brand Tag -->
      <rect x="60" y="50" width="300" height="50" rx="25" fill="#FFFFFF" opacity="0.95"/>
      <text x="85" y="83" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="#0F172A">✦ ${storeText}</text>
      
      <!-- Bottom Ribbon -->
      <rect x="60" y="930" width="960" height="95" rx="20" fill="url(#igBanner)"/>
      <text x="100" y="990" font-family="system-ui, sans-serif" font-size="30" font-weight="700" fill="#FFFFFF">${titleText}</text>
      <text x="980" y="990" font-family="system-ui, sans-serif" font-size="32" font-weight="900" fill="#FBBF24" text-anchor="end">${priceText}</text>
    </svg>
  `);

  const instagramPost = await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 4,
      background: { r: 248, g: 250, b: 252, alpha: 1 },
    },
  })
    .composite([
      { input: igProduct, top: 60, left: 60 },
      { input: igPostOverlay, top: 0, left: 0 },
    ])
    .webp({ quality: 90 })
    .toBuffer();

  // 3. Instagram Story (1080x1920 Full Bleed 9:16 Format)
  const storyProduct = await sharp(imgBuffer)
    .resize(1080, 1350, { fit: "cover" })
    .toBuffer();

  const storyOverlay = Buffer.from(`
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="storyFade" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0F172A" stop-opacity="0"/>
          <stop offset="50%" stop-color="#0F172A" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#0F172A" stop-opacity="1"/>
        </linearGradient>
      </defs>
      
      <!-- Top Header -->
      <rect x="60" y="100" width="400" height="60" rx="30" fill="#FFFFFF" opacity="0.95"/>
      <text x="95" y="140" font-family="system-ui, sans-serif" font-size="24" font-weight="800" fill="#0F172A">✦ ${storeText}</text>
      
      <!-- Bottom Gradient Overlay -->
      <rect x="0" y="1200" width="1080" height="720" fill="url(#storyFade)"/>
      
      <!-- Title & Price -->
      <text x="80" y="1480" font-family="system-ui, sans-serif" font-size="46" font-weight="800" fill="#FFFFFF">${titleText}</text>
      <text x="80" y="1570" font-family="system-ui, sans-serif" font-size="58" font-weight="900" fill="#38BDF8">${priceText}</text>
      
      <!-- Swipe/Tap Button -->
      <rect x="80" y="1650" width="920" height="120" rx="60" fill="#3B82F6"/>
      <text x="540" y="1725" font-family="system-ui, sans-serif" font-size="34" font-weight="800" fill="#FFFFFF" text-anchor="middle">👆 DM / Tap to Order</text>
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
      { input: storyProduct, top: 150, left: 0 },
      { input: storyOverlay, top: 0, left: 0 },
    ])
    .webp({ quality: 90 })
    .toBuffer();

  return {
    whatsappCard,
    whatsapp: whatsappCard,
    instagramPost,
    instagramStory,
  } as any;
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
