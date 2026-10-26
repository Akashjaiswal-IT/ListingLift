/**
 * Display names for credit packs, in both languages. The server only knows the
 * pack id (and an English `name`); every screen that shows a pack name reads it
 * from here so pricing, the landing page and the credits ledger always agree.
 */
const PACK_NAMES: Record<string, { en: string; hi: string }> = {
  trial: { en: "Studio Kickstart", hi: "स्टूडियो किकस्टार्ट" },
  starter: { en: "Growth Seller", hi: "ग्रोथ सेलर" },
  standard: { en: "Merchant Pro", hi: "मर्चेंट प्रो" },
  pro: { en: "Brand Studio", hi: "ब्रांड स्टूडियो" },
  business_s: { en: "Business Studio", hi: "बिजनेस स्टूडियो" },
  business_l: { en: "Agency Bulk", hi: "एजेंसी बल्क" },
  topup: { en: "Custom top-up", hi: "कस्टम टॉप-अप" },
};

export function packDisplayName(packId: string, isHi: boolean, fallback?: string): string {
  const names = PACK_NAMES[packId];
  if (names) return isHi ? names.hi : names.en;
  return fallback || packId;
}
