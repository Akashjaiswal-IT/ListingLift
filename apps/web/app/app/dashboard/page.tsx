"use client";

import Link from "next/link";
import {
  Sparkles,
  PlusCircle,
  Coins,
  Layers,
  Gift,
  Users,
  Copy,
  MessageCircle,
  Check,
  Loader2,
  Camera,
  ShieldCheck,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { ErrorState } from "~/components/common/ErrorState";
import { ListingCard } from "~/components/listing/ListingCard";
import { trpc } from "~/trpc/client";
import { useCreditStore } from "~/stores/useCreditStore";
import { useEffect, useState } from "react";
import { useLanguage } from "~/providers/LanguageContext";
import { toast } from "sonner";
import { buildReferralLink } from "~/lib/referral-link";

export default function DashboardPage() {
  const { language } = useLanguage();
  const isHi = language === "hi";
  const { balance, setBalance, isInitialized } = useCreditStore();
  const utils = trpc.useUtils();

  const balanceQuery = trpc.credits.getBalance.useQuery();
  const listingsQuery = trpc.listing.list.useQuery(
    { page: 1, limit: 6 },
    {
      // While a listing is still being created, refresh the cards so its status
      // flips to "Ready" without a manual reload.
      refetchInterval: (query) =>
        query.state.data?.items?.some((i: any) => i.status === "queued" || i.status === "processing")
          ? 10000
          : false,
    }
  );
  const referralQuery = trpc.user.getReferralStats.useQuery();

  const [inputCode, setInputCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const applyReferralMutation = trpc.user.applyReferralCode.useMutation({
    onSuccess: (data) => {
      toast.success(
        isHi
          ? `रेफ़रल कोड लागू हुआ (${data.referrerName} द्वारा आमंत्रित)`
          : `Referral applied (Invited by ${data.referrerName})`
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
  const bonusPerReferral = referralData?.bonusPerReferral ?? 3;

  // Built on the client so the link always points at the site the seller is using.
  const [myLink, setMyLink] = useState("");
  useEffect(() => {
    setMyLink(myCode ? buildReferralLink(window.location.origin, myCode) : "");
  }, [myCode]);

  const handleCopyLink = async () => {
    if (!myLink) return;
    try {
      await navigator.clipboard.writeText(myLink);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast.success(isHi ? "इनवाइट लिंक कॉपी हुआ!" : "Invite link copied!");
    } catch {
      toast.error(isHi ? "कॉपी नहीं हो सका — लिंक को हाथ से चुनें" : "Couldn't copy — please select the link manually");
    }
  };

  const handleShareWhatsApp = () => {
    if (!myLink) return;
    const msg = isHi
      ? `नमस्ते! मैं अपने प्रॉडक्ट्स की AI स्टूडियो फ़ोटो, लिस्टिंग और व्हाट्सएप कार्ड्स बनाने के लिए Peshkar AI का उपयोग करता/करती हूँ। मेरे लिंक से जुड़ें और 3 मुफ़्त क्रेडिट्स से शुरू करें: ${myLink}`
      : `Hey! I use Peshkar AI to turn phone photos into studio product photos, listings and WhatsApp cards. Join with my link and start free with 3 credits: ${myLink}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  };

  useEffect(() => {
    if (balanceQuery.data?.balance !== undefined) {
      setBalance(balanceQuery.data.balance);
    }
  }, [balanceQuery.data, setBalance]);

  const listings = listingsQuery.data?.items || [];
  const totalCount = listingsQuery.data?.total || 0;
  const isFirstRun = !listingsQuery.isLoading && !listingsQuery.isError && totalCount === 0;
  const isLowBalance = isInitialized && balance < 2;
  // Quick Studio costs 2 credits (lib/pricing.ts)
  const quickListingsAffordable = Math.floor(balance / 2);

  // "Invited by someone? Enter their code" - shown in the referral card, and on
  // its own for brand-new sellers (who don't see the referral card yet).
  const redeemForm = !referralData?.referredBy ? (
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
        aria-label={isHi ? "रेफ़रल कोड" : "Referral code"}
        placeholder={isHi ? "किसी ने आमंत्रित किया? उनका कोड डालें (उदा. PESH-XXXX)" : "Invited by someone? Enter their code (e.g. PESH-XXXX)"}
        value={inputCode}
        onChange={(e) => setInputCode(e.target.value.toUpperCase())}
        className="flex-1 min-w-0 h-10 px-3 text-base sm:text-sm uppercase font-mono rounded-lg border border-input bg-background text-foreground placeholder:normal-case placeholder:font-sans placeholder:text-xs focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <Button
        type="submit"
        size="sm"
        disabled={!inputCode.trim() || applyReferralMutation.isPending}
        className="h-10 px-3.5 text-xs font-bold"
      >
        {applyReferralMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : (isHi ? "लागू करें" : "Apply")}
      </Button>
    </form>
  ) : null;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* Header + the one primary action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-foreground">
            {isHi ? "सेलर डैशबोर्ड" : "Seller Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isHi
              ? "आपके स्टूडियो कैटलॉग, क्रेडिट और डाउनलोड — एक जगह।"
              : "Your studio catalogs, credits and downloads in one place."}
          </p>
        </div>

        {!isFirstRun && (
          <Button asChild size="lg" className="h-11 px-6 font-bold shadow-md rounded-xl gap-2 transition-all active:scale-[0.98]">
            <Link href="/app/generate">
              <PlusCircle className="h-5 w-5" aria-hidden="true" />
              {isHi ? "नया कैटलॉग बनाएं" : "New Studio Listing"}
            </Link>
          </Button>
        )}
      </div>

      {isFirstRun ? (
        <div className="space-y-6">
          {/* First run: one clear next step instead of stats and side programs */}
          <Card className="rounded-2xl border-2 border-primary/30 bg-primary/5 shadow-sm">
            <CardContent className="p-6 sm:p-10 flex flex-col items-center text-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
                <Sparkles className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="space-y-2 max-w-xl">
                <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-foreground">
                  {isHi ? "अपनी पहली लिस्टिंग बनाइए" : "Make your first listing"}
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {balance >= 3
                    ? isHi
                      ? `आपके पास ${balance} क्रेडिट हैं — 1 पूरी स्टूडियो लिस्टिंग (2 क्रेडिट) और 1 री-एडिट (1 क्रेडिट) के लिए काफ़ी।`
                      : `You have ${balance} credits — enough for 1 full studio listing (2 credits) and 1 re-edit (1 credit).`
                    : isHi
                      ? "एक फ़ोन फ़ोटो डालें और कुछ ही मिनटों में स्टूडियो फ़ोटो, लिस्टिंग टेक्स्ट और व्हाट्सएप कार्ड पाएं।"
                      : "Add one phone photo and get studio photos, listing text and WhatsApp cards in minutes."}
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
                <Button asChild size="lg" className="h-12 w-full sm:w-auto px-8 font-bold rounded-xl shadow-md gap-2">
                  <Link href={isLowBalance ? "/pricing" : "/app/generate"}>
                    <Camera className="h-5 w-5" aria-hidden="true" />
                    {isLowBalance
                      ? isHi ? "क्रेडिट खरीदें" : "Buy credits"
                      : isHi ? "पहली फ़ोटो डालें" : "Upload your first photo"}
                  </Link>
                </Button>
                {!isLowBalance && (
                  <Link
                    href="/app/generate?sample=1"
                    className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {isHi ? "फ़ोटो नहीं है? सैंपल फ़ोटो से आज़माएँ" : "No photo handy? Try with a sample photo"}
                  </Link>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
                {isHi
                  ? "जेनरेशन असफल होने पर क्रेडिट अपने-आप वापस"
                  : "Credits come back automatically if a generation fails"}
              </p>
            </CardContent>
          </Card>

          {redeemForm && <div className="max-w-md mx-auto">{redeemForm}</div>}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            <Card className="border-border/60 bg-card shadow-sm">
              <CardContent className="p-4 sm:p-6 flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {isHi ? "उपलब्ध क्रेडिट्स" : "Available Credits"}
                  </span>
                  <div className={`text-3xl font-black ${isLowBalance ? "text-destructive" : "text-primary"}`}>
                    {isInitialized ? balance : balanceQuery.isLoading ? "…" : balance}
                  </div>
                  {isLowBalance ? (
                    <Link href="/pricing" className="text-xs font-bold text-primary underline underline-offset-2">
                      {isHi ? "क्रेडिट खरीदें →" : "Buy credits →"}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground block">
                      ≈ {quickListingsAffordable} {isHi ? "स्टूडियो लिस्टिंग" : "studio listings"}
                    </span>
                  )}
                </div>
                <div className="hidden sm:flex h-12 w-12 shrink-0 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center text-primary">
                  <Coins className="h-6 w-6" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card shadow-sm">
              <CardContent className="p-4 sm:p-6 flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {isHi ? "कुल कैटलॉग" : "Catalogs Created"}
                  </span>
                  <div className="text-3xl font-black">{listingsQuery.isLoading ? "…" : totalCount}</div>
                  <Link href="/app/history" className="text-xs font-semibold text-primary hover:underline">
                    {isHi ? "सभी देखें →" : "View all →"}
                  </Link>
                </div>
                <div className="hidden sm:flex h-12 w-12 shrink-0 rounded-xl bg-credit/10 border border-credit/20 items-center justify-center text-credit">
                  <Layers className="h-6 w-6" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Listings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground">
                {isHi ? "हाल के कैटलॉग" : "Recent Catalogs"}
              </h2>
              {totalCount > 0 && (
                <Link href="/app/history" className="text-xs font-bold text-primary hover:underline">
                  {isHi ? `सभी देखें (${totalCount}) →` : `View all (${totalCount}) →`}
                </Link>
              )}
            </div>

            {listingsQuery.isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-56 rounded-xl" />
                ))}
              </div>
            ) : listingsQuery.isError ? (
              <ErrorState onRetry={() => listingsQuery.refetch()} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {listings.map((item: any) => (
                  <ListingCard key={item._id} item={item} isHi={isHi} />
                ))}
              </div>
            )}

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
              {isHi
                ? "जेनरेशन असफल होने पर क्रेडिट अपने-आप वापस आ जाते हैं।"
                : "Credits come back automatically if a generation fails."}
            </p>
          </div>

          {/* Seller referral program (shown once the seller has made something worth sharing):
              the referrer earns credits once an invited seller makes a first purchase */}
          {!listingsQuery.isError && (
            <Card className="rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-credit/5 p-4 sm:p-6 shadow-sm overflow-hidden relative">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-credit/40 text-credit bg-credit/10 font-bold text-xs gap-1.5 py-0.5">
                      <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                      {isHi ? "सेलर इनवाइट प्रोग्राम" : "Seller Invite Program"}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {isHi
                        ? `हर खरीदने वाले सेलर पर ${bonusPerReferral} क्रेडिट्स`
                        : `${bonusPerReferral} credits per seller who buys`}
                    </span>
                  </div>
                  <h2 className="text-xl font-serif font-black tracking-tight text-foreground">
                    {isHi
                      ? `साथी सेलर्स को आमंत्रित करें — हर खरीदारी पर ${bonusPerReferral} मुफ़्त क्रेडिट्स कमाएं`
                      : `Invite fellow sellers — earn ${bonusPerReferral} free credits for each one who buys`}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {isHi
                      ? `अपना इनवाइट लिंक व्हाट्सएप या सेलर ग्रुप्स में शेयर करें। जब कोई सेलर इस लिंक से जुड़कर अपनी पहली खरीदारी करता है, तो आपको ${bonusPerReferral} मुफ़्त क्रेडिट्स मिलते हैं।`
                      : `Share your invite link on WhatsApp or in Meesho/Amazon seller groups. When a seller signs up through it and makes their first purchase, you get ${bonusPerReferral} free credits.`}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Users className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
                      <strong className="text-foreground">{referralData?.referralCount ?? 0}</strong> {isHi ? "सेलर्स जुड़े" : "Sellers Invited"}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Coins className="h-3.5 w-3.5 text-credit" aria-hidden="true" />
                      <strong className="text-foreground">{referralData?.referralCreditsEarned ?? 0}</strong> {isHi ? "क्रेडिट्स कमाए" : "Credits Earned"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:min-w-[320px]">
                  {/* My Invite Link (applies my code automatically when a seller signs up through it) */}
                  <div className="p-3 rounded-xl border border-border/80 bg-muted/30 flex flex-col min-[400px]:flex-row min-[400px]:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider block">
                        {isHi ? "आपका इनवाइट लिंक" : "Your Invite Link"}
                      </span>
                      <span className="block font-mono text-xs font-bold text-foreground truncate select-all" title={myLink}>
                        {myLink || "..."}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {isHi ? "कोड" : "Code"}: <span className="font-mono font-bold">{myCode || "..."}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyLink}
                        disabled={!myLink}
                        className="h-9 text-xs gap-1 font-bold"
                      >
                        {copiedCode ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedCode ? (isHi ? "कॉपी हुआ" : "Copied") : (isHi ? "कॉपी" : "Copy")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleShareWhatsApp}
                        disabled={!myLink}
                        className="h-9 text-xs gap-1 font-bold bg-whatsapp hover:bg-whatsapp/90 text-whatsapp-foreground"
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {isHi ? "व्हाट्सएप" : "Share"}
                      </Button>
                    </div>
                  </div>

                  {/* Redeem code input (if not already referred) */}
                  {redeemForm}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
