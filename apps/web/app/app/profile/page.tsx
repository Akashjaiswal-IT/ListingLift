"use client";

import { useState, useEffect } from "react";
import { UserCheck, Store, MessageCircle, Instagram, Image as ImageIcon, Save, Loader2, BadgeCheck } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { trpc } from "~/trpc/client";
import { toast } from "sonner";
import { useLanguage } from "~/providers/LanguageContext";

type CardLanguage = "en" | "hi";
type TrustBadgeKey = "cod" | "freeDelivery" | "easyReturns" | "madeInIndia";

const TRUST_BADGES: { key: TrustBadgeKey; en: string; hi: string }[] = [
  { key: "cod", en: "Cash on Delivery available", hi: "कैश ऑन डिलीवरी उपलब्ध" },
  { key: "freeDelivery", en: "Free delivery", hi: "फ्री डिलीवरी" },
  { key: "easyReturns", en: "Easy returns", hi: "आसान रिटर्न" },
  { key: "madeInIndia", en: "Made in India", hi: "मेड इन इंडिया" },
];

const NO_TRUST_BADGES: Record<TrustBadgeKey, boolean> = {
  cod: false,
  freeDelivery: false,
  easyReturns: false,
  madeInIndia: false,
};

export default function ProfilePage() {
  const { language } = useLanguage();
  const isHi = language === "hi";

  const profileQuery = trpc.user.getProfile.useQuery();
  const updateSellerMutation = trpc.user.updateSellerProfile.useMutation();

  const [storeName, setStoreName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoBroken, setLogoBroken] = useState(false);
  const [defaultCtaText, setDefaultCtaText] = useState(isHi ? "व्हाट्सएप पर ऑर्डर करें" : "Order Now via WhatsApp");
  const [cardLanguage, setCardLanguage] = useState<CardLanguage>("en");
  const [trustBadges, setTrustBadges] = useState<Record<TrustBadgeKey, boolean>>(NO_TRUST_BADGES);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profileQuery.data) {
      const u = profileQuery.data as any;
      setStoreName(u.storeName || "");
      setWhatsappNumber(u.whatsappNumber || "");
      setInstagramHandle(u.instagramHandle || "");
      setLogoUrl(u.logoUrl || "");
      if (u.defaultCta?.text) setDefaultCtaText(u.defaultCta.text);
      const cs = u.cardSettings;
      setCardLanguage(cs?.language === "hi" ? "hi" : "en");
      setTrustBadges({
        cod: cs?.cod === true,
        freeDelivery: cs?.freeDelivery === true,
        easyReturns: cs?.easyReturns === true,
        madeInIndia: cs?.madeInIndia === true,
      });
    }
  }, [profileQuery.data]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSellerMutation.mutateAsync({
        storeName,
        whatsappNumber,
        instagramHandle,
        logoUrl: logoUrl || undefined,
        defaultCta: {
          text: defaultCtaText,
        },
        cardSettings: {
          language: cardLanguage,
          ...trustBadges,
        },
      });
      toast.success(isHi ? "सेलर प्रोफ़ाइल अपडेट हुई! मार्केटिंग कार्ड्स अब आपकी ब्रांडिंग का उपयोग करेंगे।" : "Seller profile updated! Marketing cards will now use your branding.");
    } catch (err: any) {
      toast.error(err.message || (isHi ? "प्रोफ़ाइल अपडेट करने में विफल" : "Failed to update profile"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-8">
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl font-serif font-black tracking-tight flex items-center gap-2 text-foreground">
          <Store className="h-6 w-6 text-primary" />
          {isHi ? "सेलर ब्रांडिंग प्रोफ़ाइल" : "Seller Branding Profile"}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          {isHi
            ? "व्हाट्सएप कार्ड्स और इंस्टाग्राम पोस्ट्स को स्वचालित रूप से वैयक्तिकृत करने के लिए अपने स्टोर की पहचान कॉन्फ़िगर करें।"
            : "Configure your store identity to automatically personalize WhatsApp cards and Instagram posts."}
        </p>
      </div>

      <Card className="border-border/60 bg-card shadow-sm">
        <CardContent className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="profile-store" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5 text-primary" /> {isHi ? "स्टोर / ब्रांड का नाम" : "Store / Brand Name"}
            </label>
            <Input
              placeholder={isHi ? "उदा. रॉयल हेरिटेज साड़ीज़" : "e.g. Royal Heritage Sarees"}
              id="profile-store"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {isHi
                ? "जनरेट किए गए व्हाट्सएप कैटलॉग कार्ड्स और इंस्टाग्राम ओवरले पर प्रदर्शित होता है।"
                : "Displayed on generated WhatsApp catalog cards and Instagram overlays."}
            </span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-whatsapp" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-success" /> {isHi ? "व्हाट्सएप बिज़नेस नंबर" : "WhatsApp Business Number"}
            </label>
            <Input
              id="profile-whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. +91 98765 43210"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {isHi
                ? "कैटलॉग में सीधे क्लिक-टू-चैट ऑर्डर लिंक बनाने के लिए उपयोग किया जाता है।"
                : "Used to generate instant click-to-chat order links in copy deliverables."}
            </span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-instagram" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Instagram className="h-3.5 w-3.5 text-pink-500" /> {isHi ? "इंस्टाग्राम हैंडल" : "Instagram Handle"}
            </label>
            <Input
              id="profile-instagram"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="e.g. @royal_heritage_sarees"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-logo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-credit" /> {isHi ? "स्टोर लोगो URL (वैकल्पिक)" : "Store Logo URL (Optional)"}
            </label>
            <Input
              id="profile-logo"
              type="url"
              inputMode="url"
              placeholder="https://..."
              value={logoUrl}
              onChange={(e) => {
                setLogoUrl(e.target.value);
                setLogoBroken(false);
              }}
            />
            {/* Preview, so a wrong link is obvious before it ends up on every card */}
            {logoUrl.trim() && (
              <div className="flex items-center gap-3 pt-1">
                {logoBroken ? (
                  <span className="text-sm text-destructive">
                    {isHi ? "इस लिंक से लोगो नहीं खुला — लिंक जांचें।" : "Couldn't load a logo from this link — please check it."}
                  </span>
                ) : (
                  <>
                    <img
                      src={logoUrl.trim()}
                      alt={isHi ? "लोगो प्रीव्यू" : "Logo preview"}
                      className="h-12 w-12 rounded-lg border border-border bg-white object-contain"
                      onError={() => setLogoBroken(true)}
                    />
                    <span className="text-xs text-muted-foreground">{isHi ? "लोगो प्रीव्यू" : "Logo preview"}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-cta" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isHi ? "डिफ़ॉल्ट कॉल-टू-एक्शन (CTA) टेक्स्ट" : "Default Call-to-Action (CTA) Text"}
            </label>
            <Input
              placeholder={isHi ? "उदा. व्हाट्सएप पर ऑर्डर करें" : "e.g. Order Now via WhatsApp"}
              id="profile-cta"
              value={defaultCtaText}
              onChange={(e) => setDefaultCtaText(e.target.value)}
            />
          </div>

          <div className="pt-5 border-t border-border/40 space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-primary" /> {isHi ? "कार्ड सेटिंग्स" : "Card settings"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isHi
                  ? "इन्हें तभी चालू करें जब ये आपकी दुकान के लिए सच हों — ये आपके कार्ड पर छपेंगे।"
                  : "Only switch these on if they are true for your shop — they are printed on your cards."}
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="card-language"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                {isHi ? "कार्ड की भाषा" : "Card language"}
              </label>
              <Select value={cardLanguage} onValueChange={(val) => setCardLanguage(val === "hi" ? "hi" : "en")}>
                <SelectTrigger id="card-language" className="w-[180px] h-9 text-xs rounded-xl border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">हिंदी</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {TRUST_BADGES.map((badge) => {
                const id = `card-badge-${badge.key}`;
                return (
                  <div
                    key={badge.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                  >
                    <label htmlFor={id} className="text-sm text-foreground cursor-pointer">
                      {isHi ? badge.hi : badge.en}
                    </label>
                    <Switch
                      id={id}
                      checked={trustBadges[badge.key]}
                      onCheckedChange={(checked) =>
                        setTrustBadges((prev) => ({ ...prev, [badge.key]: checked }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 px-6 rounded-xl shadow-sm text-xs"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isHi ? "प्रोफ़ाइल सेटिंग्स सेव करें" : "Save Profile Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
