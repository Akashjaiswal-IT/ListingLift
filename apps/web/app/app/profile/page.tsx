"use client";

import { useState, useEffect } from "react";
import { UserCheck, Store, MessageCircle, Instagram, Image as ImageIcon, Save, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { trpc } from "~/trpc/client";
import { toast } from "sonner";
import { useLanguage } from "~/providers/LanguageContext";

export default function ProfilePage() {
  const { language } = useLanguage();
  const isHi = language === "hi";

  const profileQuery = trpc.user.getProfile.useQuery();
  const updateSellerMutation = trpc.user.updateSellerProfile.useMutation();

  const [storeName, setStoreName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [defaultCtaText, setDefaultCtaText] = useState(isHi ? "व्हाट्सएप पर ऑर्डर करें" : "Order Now via WhatsApp");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profileQuery.data) {
      const u = profileQuery.data as any;
      setStoreName(u.storeName || "");
      setWhatsappNumber(u.whatsappNumber || "");
      setInstagramHandle(u.instagramHandle || "");
      setLogoUrl(u.logoUrl || "");
      if (u.defaultCta?.text) setDefaultCtaText(u.defaultCta.text);
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
          <Store className="h-6 w-6 text-[#E05822]" />
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
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5 text-[#E05822]" /> {isHi ? "स्टोर / ब्रांड का नाम" : "Store / Brand Name"}
            </label>
            <Input
              placeholder={isHi ? "उदा. रॉयल हेरिटेज साड़ीज़" : "e.g. Royal Heritage Sarees"}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
            <span className="text-[11px] text-muted-foreground">
              {isHi
                ? "जनरेट किए गए व्हाट्सएप कैटलॉग कार्ड्स और इंस्टाग्राम ओवरले पर प्रदर्शित होता है।"
                : "Displayed on generated WhatsApp catalog cards and Instagram overlays."}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" /> {isHi ? "व्हाट्सएप बिज़नेस नंबर" : "WhatsApp Business Number"}
            </label>
            <Input
              placeholder="e.g. +91 98765 43210"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
            <span className="text-[11px] text-muted-foreground">
              {isHi
                ? "कैटलॉग में सीधे क्लिक-टू-चैट ऑर्डर लिंक बनाने के लिए उपयोग किया जाता है।"
                : "Used to generate instant click-to-chat order links in copy deliverables."}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Instagram className="h-3.5 w-3.5 text-pink-500" /> {isHi ? "इंस्टाग्राम हैंडल" : "Instagram Handle"}
            </label>
            <Input
              placeholder="e.g. @royal_heritage_sarees"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-amber-500" /> {isHi ? "स्टोर लोगो URL (वैकल्पिक)" : "Store Logo URL (Optional)"}
            </label>
            <Input
              placeholder="https://..."
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isHi ? "डिफ़ॉल्ट कॉल-टू-एक्शन (CTA) टेक्स्ट" : "Default Call-to-Action (CTA) Text"}
            </label>
            <Input
              placeholder={isHi ? "उदा. व्हाट्सएप पर ऑर्डर करें" : "e.g. Order Now via WhatsApp"}
              value={defaultCtaText}
              onChange={(e) => setDefaultCtaText(e.target.value)}
            />
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#E05822] hover:bg-[#c94917] text-white font-bold gap-2 px-6 rounded-xl shadow-sm text-xs"
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
