import Link from "next/link";
import {
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Share2,
  Copy,
  Download,
  Image as ImageIcon,
  MessageCircle,
  Instagram,
  ShoppingBag,
  Coins,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 via-background to-background pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-500/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs sm:text-sm font-semibold text-indigo-400 backdrop-blur-sm animate-fade-in shadow-sm">
            <Sparkles className="h-4 w-4 text-amber-400 animate-spin-slow" />
            <span>Built for E-Commerce Sellers, D2C Brands & Social Commerce</span>
            <span className="text-amber-400 font-bold ml-1">✦ 10 Free Credits</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight max-w-5xl mx-auto leading-[1.1]">
            Turn One Phone Photo Into{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-amber-500 bg-clip-text text-transparent">
              Studio Catalogs & Viral Listings
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Stop losing sales to low-quality camera photos. Upload your product once to instantly get 8K studio photography, compliant marketplace listings (Amazon, Flipkart, Meesho, Shopify), and branded social cards with 10+ sleek templates.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href="/app/generate">
              <Button
                size="lg"
                className="h-13 px-8 text-base font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-amber-500 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/25 rounded-xl gap-2 transition-all hover:scale-105"
              >
                <Zap className="h-5 w-5 text-amber-300" />
                Start Generating Now (10 Free Credits)
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="h-13 px-7 text-base font-semibold border-border/80 hover:bg-muted/50 rounded-xl"
              >
                View Credit Pricing (From ₹99)
              </Button>
            </Link>
          </div>

          {/* Social Proof Badges */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Zero Graphic Design Skills Needed</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>100% Marketplace Policy Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Instant WhatsApp & IG Downloads</span>
            </div>
          </div>

          {/* Visual Showcase: Before & After Transformation Demo */}
          <div className="pt-10 max-w-5xl mx-auto">
            <div className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-6 backdrop-blur-xl shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Before: Raw Phone Shot */}
                <div className="relative group rounded-xl overflow-hidden border border-border/40 bg-muted/40 p-4 flex flex-col items-center">
                  <div className="absolute top-3 left-3 z-10">
                    <Badge variant="destructive" className="font-bold uppercase tracking-wider text-[11px]">
                      Before: Phone Snapshot
                    </Badge>
                  </div>
                  <div className="w-full aspect-square rounded-lg bg-zinc-900 flex flex-col items-center justify-center p-6 text-center border border-zinc-800">
                    <div className="h-20 w-20 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
                      <ImageIcon className="h-10 w-10 opacity-60" />
                    </div>
                    <span className="text-zinc-400 font-medium text-sm">Poor bedsheet background</span>
                    <span className="text-zinc-600 text-xs mt-1">Harsh shadows • Distorted colors • Low buyer trust</span>
                  </div>
                </div>

                {/* After: Studio Photography + Deliverables */}
                <div className="relative group rounded-xl overflow-hidden border border-indigo-500/40 bg-gradient-to-br from-indigo-950/30 to-violet-950/20 p-4 flex flex-col items-center">
                  <div className="absolute top-3 left-3 z-10">
                    <Badge className="bg-indigo-600 text-white font-bold uppercase tracking-wider text-[11px] gap-1 shadow-sm">
                      <Sparkles className="h-3 w-3 text-amber-300" /> After: ListingLift Studio
                    </Badge>
                  </div>
                  <div className="w-full aspect-square rounded-lg bg-gradient-to-b from-indigo-900/40 to-slate-900/60 flex flex-col items-center justify-center p-6 text-center border border-indigo-500/20">
                    <div className="h-20 w-20 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
                      <Sparkles className="h-10 w-10 text-indigo-400" />
                    </div>
                    <span className="text-indigo-200 font-bold text-base">8K Studio Lighting & Neutral Pedestal</span>
                    <span className="text-indigo-300/80 text-xs mt-1">+ SEO Title, Marketplace Catalog Copy & 10+ Social Templates</span>
                  </div>
                </div>
              </div>

              {/* 4 Deliverables Row */}
              <div className="mt-6 pt-6 border-t border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                <div className="p-3 rounded-lg bg-background/50 border border-border/40">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <ShoppingBag className="h-3.5 w-3.5 text-indigo-400" /> Marketplace Catalog
                  </span>
                  <span className="text-sm font-semibold block mt-1">SEO Title & Bullets</span>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border/40">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp
                  </span>
                  <span className="text-sm font-semibold block mt-1">Ready Order Broadcast</span>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border/40">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Instagram className="h-3.5 w-3.5 text-pink-400" /> Instagram
                  </span>
                  <span className="text-sm font-semibold block mt-1">1:1 Post & 9:16 Story</span>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border/40">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Download className="h-3.5 w-3.5 text-amber-400" /> Downloads
                  </span>
                  <span className="text-sm font-semibold block mt-1">Instant 1-Click ZIP</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works (The 4-Step Lifecycle) */}
      <section className="py-20 border-t border-border/40 bg-muted/10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-500">
              Effortless Workflow
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              From Camera Roll to Catalog in 4 Simple Steps
            </h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              Engineered for busy resellers who list dozens of sarees, kurtis, jewelry, and lifestyle products every day.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Snap & Upload",
                desc: "Upload 1 photo for Quick Generate (2 credits) or 3-5 photos for a Full Kit (5-7 credits).",
                icon: ImageIcon,
              },
              {
                step: "02",
                title: "Enter Simple Info",
                desc: "Type title, price, discount, and any custom prompt. We handle the copywriting & SEO.",
                icon: Copy,
              },
              {
                step: "03",
                title: "AI Studio Magic",
                desc: "OpenAI Vision enhances the prompt, Gemini generates studio variations, Sharp crafts marketing cards.",
                icon: Sparkles,
              },
              {
                step: "04",
                title: "Publish & Sell",
                desc: "One-click copy to Amazon, Flipkart, Meesho or Shopify, broadcast directly to WhatsApp customers, or download the full ZIP bundle.",
                icon: Share2,
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className="relative p-6 rounded-2xl border border-border/50 bg-card hover:border-indigo-500/50 transition-all hover:shadow-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-indigo-500/30">{s.step}</span>
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h4 className="text-lg font-bold">{s.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Credit Pricing Preview */}
      <section className="py-20 border-t border-border/40">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-500">
              Transparent Credit Pricing
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Pay As You Sell. Start with Just ₹99.
            </h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              No locked monthly subscriptions. Credits never expire. Quick Generate costs only 2 credits (~₹20).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Trial Pack */}
            <Card className="border-border/60 hover:border-indigo-500/40 transition-all">
              <CardContent className="p-6 space-y-6">
                <div>
                  <Badge variant="secondary" className="mb-2">First Purchase</Badge>
                  <h4 className="text-2xl font-bold">Trial Pack</h4>
                  <p className="text-xs text-muted-foreground mt-1">Perfect for trying out your first 5 listings</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">₹99</span>
                  <span className="text-xs text-muted-foreground">/ 10 credits (₹9.90/ea)</span>
                </div>
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 5 Quick Studio Generations
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Full Marketplace Catalog Copy
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> WhatsApp & Instagram Cards
                  </li>
                </ul>
                <Link href="/pricing" className="block w-full">
                  <Button variant="outline" className="w-full font-semibold">Buy Trial Pack</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Standard Pack (Most Popular) */}
            <Card className="border-indigo-500/80 relative shadow-xl shadow-indigo-500/10 bg-indigo-950/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-indigo-600 text-white font-bold uppercase text-[10px] px-3">
                  Most Popular • 17% Off
                </Badge>
              </div>
              <CardContent className="p-6 space-y-6 pt-7">
                <div>
                  <h4 className="text-2xl font-bold">Standard Pack</h4>
                  <p className="text-xs text-muted-foreground mt-1">Best for active weekly resellers</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-indigo-400">₹599</span>
                  <span className="text-xs text-muted-foreground">/ 60 credits (₹9.98/ea)</span>
                </div>
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 30 Quick Studio Generations
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Or 10-12 Full Multi-Photo Kits
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Priority Worker Processing
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Instant ZIP bundle downloads
                  </li>
                </ul>
                <Link href="/pricing" className="block w-full">
                  <Button className="w-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white">
                    Get Standard Pack
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Pack */}
            <Card className="border-border/60 hover:border-indigo-500/40 transition-all">
              <CardContent className="p-6 space-y-6">
                <div>
                  <Badge variant="outline" className="mb-2 text-amber-500 border-amber-500/40">25% Savings</Badge>
                  <h4 className="text-2xl font-bold">Pro Pack</h4>
                  <p className="text-xs text-muted-foreground mt-1">For high-volume wholesalers & power sellers</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">₹899</span>
                  <span className="text-xs text-muted-foreground">/ 100 credits (₹8.99/ea)</span>
                </div>
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 50 Quick Studio Generations
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Lowest Cost Per Credit (₹8.99)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Re-edits at just 1 credit each
                  </li>
                </ul>
                <Link href="/pricing" className="block w-full">
                  <Button variant="outline" className="w-full font-semibold">Buy Pro Pack</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-10">
            <Link href="/pricing" className="text-sm font-semibold text-indigo-400 hover:underline">
              Need larger business packs? View 200, 500, and 1200 credit options →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 border-t border-border/40 bg-gradient-to-tr from-indigo-900/40 via-violet-950/40 to-slate-950">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 text-center space-y-6">
          <h3 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Ready to Multiply Your Online Sales?
          </h3>
          <p className="text-slate-300 text-base max-w-xl mx-auto">
            Join thousands of smart sellers and D2C brands who list products faster and close orders directly across all marketplaces with ListingLift.
          </p>
          <div className="pt-2">
            <Link href="/app/generate">
              <Button
                size="lg"
                className="h-14 px-8 text-base font-bold bg-white text-indigo-950 hover:bg-slate-100 shadow-xl rounded-xl gap-2 transition-transform hover:scale-105"
              >
                <Zap className="h-5 w-5 text-indigo-600 fill-indigo-600" />
                Claim Your 10 Free Trial Credits
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
