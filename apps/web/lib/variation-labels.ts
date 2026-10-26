/** Human names for generated image variations (the server stores ids like "studio_white"). */
const VARIATION_LABELS: Record<string, { en: string; hi: string }> = {
  studio_white: { en: "Pure White Studio", hi: "प्योर व्हाइट स्टूडियो" },
  studio_premium: { en: "Premium Podium", hi: "प्रीमियम पोडियम" },
  lifestyle: { en: "Lifestyle", hi: "लाइफ़स्टाइल" },
};

export function variationLabel(variationType: string | undefined | null, isHi: boolean): string {
  if (!variationType) return isHi ? "स्टूडियो" : "Studio";
  const label = VARIATION_LABELS[variationType];
  if (label) return isHi ? label.hi : label.en;
  // Unknown id: "studio_soft_shadow" -> "Studio soft shadow"
  const words = variationType.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
