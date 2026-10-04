"use client";

import Link from "next/link";
import {
  Sparkles,
  PlusCircle,
  Coins,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Layers,
  ShoppingBag,
  ExternalLink,
  Gift,
  Users,
  Copy,
  MessageCircle,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { trpc } from "~/trpc/client";
import { useCreditStore } from "~/stores/useCreditStore";
import { useEffect, useState } from "react";
import { useLanguage } from "~/providers/LanguageContext";
import { toast } from "sonner";

export default function DashboardPage() {
  const { language } = useLanguage();
  const isHi = language === "hi";
  const { balance, setBalance, isInitialized } = useCreditStore();
  const utils = trpc.useUtils();

  const balanceQuery = trpc.credits.getBalance.useQuery();
  const listingsQuery = trpc.listing.list.useQuery({ page: 1, limit: 6 });
  const referralQuery = trpc.user.getReferralStats.useQuery();

  const [inputCode, setInputCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const applyReferralMutation = trpc.user.applyReferralCode.useMutation({
    onSuccess: (data) => {
      toast.success(
        isHi
          ? `रेफ़रल कोड लागू हुआ! आपको 5 मुफ़्त क्रेडिट्स मिले (${data.referrerName} द्वारा आमंत्रित)`
          : `Referral applied! 5 bonus credits awarded (Invited by ${data.referrerName})`
      );
      setInputCode("");
      utils.user.getReferralStats.invalidate();
      utils.credits.getBalance.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || (isHi ? "रेफ़रल कोड अमान्य है" : "Invalid referral code"));
    },
  });

  const referralData = referralQuery.data;
  const myCode = referralData?.referralCode || "";

  const handleCopyCode = () => {
    if (!myCode) return;
    navigator.clipboard.writeText(myCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast.success(isHi ? "रेफ़रल कोड कॉपी हुआ!" : "Referral code copied to clipboard!");
  };

  const handleShareWhatsApp = () => {
    if (!myCode) return;
    const msg = isHi
      ? `नमस्ते! मैं अपने प्रॉडक्ट्स की 8K AI स्टूडियो फ़ोटो और कैटलॉग बनाने के लिए Peshkar AI का उपयोग कर रहा हूँ। मेरे रेफ़रल कोड ${myCode} का उपयोग करें और 5 मुफ़्त बोनस क्रेडिट्स पाएं: https://peshkar.ai`
      : `Hey! I'm using Peshkar AI to turn phone photos into 8K studio e-commerce listings in seconds. Use my code ${myCode} on signup to get 5 free bonus credits: https://peshkar.ai`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  useEffect(() => {
    if (balanceQuery.data?.balance !== undefined) {
      setBalance(balanceQuery.data.balance);
    }
  }, [balanceQuery.data, setBalance]);

  const listings = listingsQuery.data?.items || [];
  const totalCount = listingsQuery.data?.total || 0;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* Top Welcome & Quick Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-foreground">
            {isHi ? "सेलर डैशबोर्ड" : "Seller Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isHi
              ? "अपने AI स्टूडियो कैटलॉग प्रबंधित करें, क्रेडिट उपयोग जांचें और लिस्टिंग डाउनलोड करें।"
              : "Manage your AI studio catalogs, check credit usage, and export listings."}
          </p>
        </div>

        <Link href="/app/generate">
          <Button
            size="lg"
            className="h-11 px-6 font-bold bg-[#E05822] hover:bg-[#c94917] text-white shadow-md rounded-xl gap-2 transition-all active:scale-[0.98]"
          >
            <PlusCircle className="h-5 w-5" />
            {isHi ? "नया स्टूडियो कैटलॉग बनाएं" : "New Studio Listing"}
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="border-border/60 bg-card hover:border-[#E05822]/40 transition-all shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  {isHi ? "उपलब्ध क्रेडिट्स" : "Available Credits"}
                </span>
                {balance >= 10 && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/30 text-emerald-600 bg-emerald-500/10 font-bold">
                    {isHi ? "₹249 मूल्य" : "₹249 Value"}
                  </Badge>
                )}
              </div>
              <div className="text-3xl font-black text-[#E05822]">
                {isInitialized ? balance : (balanceQuery.isLoading ? "..." : balance)}
              </div>
              <span className="text-xs text-muted-foreground block">
                ≈ {Math.floor(balance / 2)} {isHi ? "स्टूडियो जेनरेशन्स" : "Studio Generations"}
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-[#E05822]/10 border border-[#E05822]/20 flex items-center justify-center text-[#E05822]">
              <Coins className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card hover:border-amber-500/40 transition-all shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                {isHi ? "कुल बनाए गए कैटलॉग" : "Total Catalogs Created"}
              </span>
              <div className="text-3xl font-black">{totalCount}</div>
              <span className="text-xs text-muted-foreground block">
                {isHi ? "मीशो, व्हाट्सएप और सोशल मीडिया" : "Across Marketplaces & Social Catalogs"}
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Layers className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card hover:border-emerald-500/40 transition-all shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                {isHi ? "सफलता दर" : "Listing Success Rate"}
              </span>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">99.4%</div>
              <span className="text-xs text-muted-foreground block">
                {isHi ? "ऑटोमेटेड क्रेडिट रिफंड सुरक्षा" : "Automated credit refund protection"}
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Launch Banner - Warm Espresso / Terracotta */}
      <div className="rounded-2xl border border-[#E05822]/20 bg-[#161311] text-[#FAF7F2] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-[#E05822] flex items-center justify-center text-white shrink-0 shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {isHi ? "नए स्टॉक के लिए स्टूडियो फ़ोटो चाहिए?" : "Need Studio Photos for your new inventory?"}
            </h3>
            <p className="text-xs text-[#FAF7F2]/70 mt-0.5 max-w-xl">
              {isHi
                ? "फ़ोन से सामान्य फ़ोटो अपलोड करें। AI बनाएगा 8K स्टूडियो फ़ोटो, अमेज़ॅन/फ्लिपकार्ट प्योर व्हाइट बैकग्राउंड और व्हाट्सएप कार्ड्स।"
                : "Upload raw product photos from your phone. AI generates 8K studio variations, marketplace titles, and branded social cards."}
            </p>
          </div>
        </div>
        <Link href="/app/generate">
          <Button size="sm" className="bg-[#E05822] hover:bg-[#c94917] text-white font-bold rounded-xl px-5 shadow-sm whitespace-nowrap">
            {isHi ? "कैटलॉग बनाएं (2 क्रेडिट्स)" : "Start Generation (2 Credits)"}
          </Button>
        </Link>
      </div>

      {/* "Give 5, Get 5" Merchant Referral Program */}
      <Card className="rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-amber-500/5 p-6 shadow-sm overflow-hidden relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold text-xs gap-1.5 py-0.5">
                <Gift className="h-3.5 w-3.5" />
                {isHi ? "सेलर इनवाइट प्रोग्राम" : "Give 5, Get 5 Referral Program"}
              </Badge>
              <span className="text-xs text-muted-foreground font-semibold">
                {isHi ? "5 क्रेडिट्स दें, 5 क्रेडिट्स पाएं" : "Each Friend = 5 Free Credits"}
              </span>
            </div>
            <h3 className="text-xl font-serif font-black tracking-tight text-foreground">
              {isHi
                ? "साथी सेलर्स को आमंत्रित करें — दोनों को मिलेंगे 5-5 मुफ़्त क्रेडिट्स!"
                : "Invite Fellow Sellers — Both Get 5 Free Studio Credits!"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isHi
                ? "जब आपका कोई दोस्त आपके कोड का उपयोग करके Peshkar AI पर जुड़ता है, तो उन्हें तुरंत 5 बोनस क्रेडिट्स मिलते हैं और आपको भी 5 मुफ़्त क्रेडिट्स मिलते हैं।"
                : "Share your code with sellers on WhatsApp or Meesho/Amazon groups. When they register or redeem, they get 5 free credits instantly and you earn 5 credits too."}
            </p>

            <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="h-3.5 w-3.5 text-foreground" />
                <strong className="text-foreground">{referralData?.referralCount ?? 0}</strong> {isHi ? "सेलर्स जुड़े" : "Sellers Invited"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                <strong className="text-foreground">{referralData?.referralCreditsEarned ?? 0}</strong> {isHi ? "क्रेडिट्स कमाए" : "Credits Earned"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[320px]">
            {/* My Referral Code Pill */}
            <div className="p-3 rounded-xl border border-border/80 bg-muted/30 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                  {isHi ? "आपका रेफ़रल कोड" : "Your Referral Code"}
                </span>
                <span className="font-mono text-base font-black tracking-wider text-foreground">
                  {myCode || "..."}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCode}
                  className="h-8 text-xs gap-1 font-bold"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCode ? (isHi ? "कॉपी हुआ" : "Copied") : (isHi ? "कॉपी" : "Copy")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleShareWhatsApp}
                  className="h-8 text-xs gap-1 font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {isHi ? "व्हाट्सएप" : "Share"}
                </Button>
              </div>
            </div>

            {/* Redeem code input (if not already referred) */}
            {!referralData?.referredBy && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!inputCode.trim()) return;
                  applyReferralMutation.mutate({ code: inputCode.trim() });
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder={isHi ? "दोस्त का कोड दर्ज करें (उदा. PESH-XXXX)" : "Have a code? Enter (e.g. PESH-XXXX)"}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="flex-1 h-9 px-3 text-xs uppercase font-mono rounded-lg border border-border/80 bg-background text-foreground placeholder:normal-case placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-[#E05822]"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!inputCode.trim() || applyReferralMutation.isPending}
                  className="h-9 px-3.5 text-xs font-bold bg-[#E05822] hover:bg-[#c94917] text-white"
                >
                  {applyReferralMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : (isHi ? "रिडीम करें" : "Claim 5 Cr")}
                </Button>
              </form>
            )}
          </div>
        </div>
      </Card>

      {/* Recent Listings Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground">
            {isHi ? "हाल ही में बनाए गए कैटलॉग" : "Recent Catalogs"}
          </h2>
          <Link href="/app/history" className="text-xs font-bold text-[#E05822] hover:underline">
            {isHi ? `सभी देखें (${totalCount}) →` : `View All Catalogs (${totalCount}) →`}
          </Link>
        </div>

        {listingsQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border/80 space-y-4 bg-card">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isHi ? "अभी कोई कैटलॉग नहीं बना है" : "No catalogs created yet"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                {isHi
                  ? "अपनी पहली प्रोडक्ट फ़ोटो अपलोड करें और सेकंडों में स्टूडियो फ़ोटो, लिस्टिंग कॉपी और कार्ड्स प्राप्त करें।"
                  : "Upload your first product photo to see studio outputs, marketplace listing copy, and social cards in seconds."}
              </p>
            </div>
            <Link href="/app/generate">
              <Button size="sm" className="font-bold bg-[#E05822] hover:bg-[#c94917] text-white rounded-xl shadow-sm">
                {isHi ? "पहला कैटलॉग बनाएं" : "Create First Listing"}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((item: any) => {
              const previewImg =
                item.generatedImages?.find((img: any) => img.isLatest !== false)?.url ||
                item.originalImages?.[0]?.url;

              return (
                <Card
                  key={item._id}
                  className="overflow-hidden border-border/60 hover:border-[#E05822]/40 transition-all hover:shadow-md flex flex-col justify-between group bg-card"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                      {previewImg ? (
                        <img
                          src={previewImg}
                          alt={item.userTitle || "Product"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ShoppingBag className="h-8 w-8 opacity-40" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <Badge
                          variant={
                            item.status === "completed"
                              ? "default"
                              : item.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                          className="capitalize text-[10px] font-bold"
                        >
                          {isHi
                            ? item.status === "completed"
                              ? "पूर्ण"
                              : item.status === "failed"
                              ? "असफल"
                              : "प्रक्रिया जारी"
                            : item.status}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm line-clamp-1 text-foreground">
                        {item.userTitle || (isHi ? "उत्पाद" : "Untitled Product")}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.price ? `₹${item.price}` : isHi ? "कीमत सेट नहीं" : "No price set"} •{" "}
                        {item.type === "listing_product"
                          ? isHi ? "क्विक स्टूडियो" : "Quick Product"
                          : isHi ? "लिस्टिंग किट" : "Listing Kit"}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      <Link href={`/app/listing/${item._id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 font-bold text-[#E05822] hover:text-[#c94917] hover:bg-[#E05822]/10">
                          {isHi ? "किट देखें" : "View Deliverables"} <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
