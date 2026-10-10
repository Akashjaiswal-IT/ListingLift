// Copy and demo data for the animated landing hero. Images live in /public/hero/
// (raw.webp, studio-white.webp, studio-podium.webp) and are placeholders that can
// be swapped by replacing the files - nothing else references their content.

export const HERO_IMAGES = {
  raw: "/hero/raw.webp",
  studioWhite: "/hero/studio-white.webp",
  studioPodium: "/hero/studio-podium.webp",
} as const;

type Copy = { en: string; hi: string };

export const HERO_COPY = {
  headline: { en: "Your shortcut to a", hi: "फ़ोन फ़ोटो से" } as Copy,
  headlineAccent: { en: "ready listing", hi: "तैयार लिस्टिंग" } as Copy,
  subhead: {
    en: "Drop one phone photo. Get studio images, marketplace copy and social posts in seconds.",
    hi: "एक फ़ोन फ़ोटो डालें। सेकंडों में स्टूडियो फ़ोटो, मार्केटप्लेस कॉपी और सोशल पोस्ट पाएं।",
  } as Copy,
  ctaPrimary: { en: "Start free", hi: "मुफ़्त शुरू करें" } as Copy,
  ctaSecondary: { en: "See pricing", hi: "प्राइसिंग देखें" } as Copy,

  idleTitle: { en: "Drop a product photo", hi: "प्रोडक्ट फ़ोटो यहाँ डालें" } as Copy,
  idleHint: {
    en: "Straight from your phone — a messy background is fine.",
    hi: "सीधे फ़ोन से — बिखरा बैकग्राउंड भी चलेगा।",
  } as Copy,
  activeTitle: { en: "Teal college backpack", hi: "टील कॉलेज बैग" } as Copy,
  processing: { en: "Processing", hi: "प्रोसेस हो रहा है" } as Copy,
  ready: { en: "Kit ready", hi: "किट तैयार" } as Copy,
  readyNote: {
    en: "5 assets ready to publish — photos, social posts, listing and SEO.",
    hi: "5 एसेट्स पब्लिश के लिए तैयार — फ़ोटो, सोशल पोस्ट, लिस्टिंग और SEO।",
  } as Copy,
  cursorTag: { en: "Reseller", hi: "सेलर" } as Copy,

  differenceTitle: { en: "See the difference", hi: "फ़र्क़ देखिए" } as Copy,
  differenceSubtitle: {
    en: "The same photo, before and after Peshkar.",
    hi: "वही फ़ोटो, Peshkar से पहले और बाद में।",
  } as Copy,
};

// One checklist item per result tile, in reveal order.
export const HERO_STEPS: Copy[] = [
  { en: "Studio photo", hi: "स्टूडियो फ़ोटो" },
  { en: "Podium shot", hi: "पोडियम शॉट" },
  { en: "WhatsApp card", hi: "व्हाट्सएप कार्ड" },
  { en: "Instagram post", hi: "इंस्टाग्राम पोस्ट" },
  { en: "Listing & SEO", hi: "लिस्टिंग और SEO" },
];

// Demo product shown in every result card (same prices everywhere).
export const HERO_PRODUCT = {
  title: "Teal College Backpack",
  price: "₹999",
  mrp: "₹1,499",
  off: { en: "33% off", hi: "33% छूट" } as Copy,
  store: "yourstore",
  storeName: "Your Store",
  orderCta: { en: "Order on WhatsApp", hi: "व्हाट्सएप पर ऑर्डर करें" } as Copy,
  likes: { en: "1,204 likes", hi: "1,204 लाइक्स" } as Copy,
  igCaption: "Back to college in style 🎒 Water-resistant, padded laptop sleeve.",
  igTags: "#collegebag #backpack #meesho",
  listingTitle: "Teal College Backpack | 30L Water-Resistant Laptop Bag",
  category: "Bags & Luggage › Backpacks",
  bullets: ["Padded 15.6\" laptop sleeve", "2 side mesh bottle pockets", "Water-resistant polyester"],
  seoUrl: "yourstore.in › backpacks",
  seoTitle: "Teal College Backpack – 30L Laptop Bag | ₹999",
  seoMeta: "Water-resistant 30L college backpack with a padded laptop sleeve. Free delivery & COD across India.",
  keywords: ["college bag", "laptop backpack", "school bag", "travel backpack"],
};

export function pick(copy: Copy, isHi: boolean): string {
  return isHi ? copy.hi : copy.en;
}
