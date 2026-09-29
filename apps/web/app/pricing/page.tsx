"use client";

import { useState } from "react";
import { CheckCircle2, Zap, Sparkles, ShieldCheck, HelpCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { trpc } from "~/trpc/client";
import { useCreditStore } from "~/stores/useCreditStore";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function PricingPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const { addLocal } = useCreditStore();
  const [selectedPack, setSelectedPack] = useState<string | null>(null);

  const packsQuery = trpc.credits.getPacks.useQuery();
  const createOrderMutation = trpc.payments.createOrder.useMutation();
  const verifyPaymentMutation = trpc.payments.verifyPayment.useMutation();

  const handleBuyPack = async (packId: string) => {
    if (!isSignedIn) {
      toast.info("Please sign in or create an account to purchase credits.");
      router.push("/login");
      return;
    }

    setSelectedPack(packId);
    try {
      const order = await createOrderMutation.mutateAsync({
        packId: packId as any,
      });

      // Launch Razorpay Modal
      const options = {
        key: order.razorpayKey,
        amount: order.amountPaise,
        currency: order.currency,
        name: "ListingLift",
        description: `Purchase ${order.credits} ListingLift Credits`,
        order_id: order.razorpayOrderId,
        handler: async (response: any) => {
          try {
            const verifyRes = await verifyPaymentMutation.mutateAsync({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            if (verifyRes.success) {
              const added = (verifyRes as any).creditsAdded || order.credits;
              addLocal(added);
              toast.success(`Successfully added ${added} credits to your account!`);
              router.push("/app/dashboard");
            }
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed");
          }
        },
        theme: {
          color: "#4F46E5",
        },
      };

      if (typeof window !== "undefined" && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Fallback simulation for dev/offline testing
        toast.info("Razorpay script not loaded. Simulating successful checkout...");
        addLocal(order.credits);
        toast.success(`Added ${order.credits} credits to balance!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payment");
    } finally {
      setSelectedPack(null);
    }
  };

  const packs = packsQuery.data || [];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
        <Badge className="bg-indigo-600/10 text-indigo-400 border-indigo-500/20 font-semibold px-3 py-1">
          Simple & Transparent Credit Packs
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
          Never Pay Subscriptions. Buy What You Need.
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg">
          Credits never expire. Quick Studio generation costs only 2 credits (~₹20). Full multi-photo marketplace kits cost 5-7 credits.
        </p>
      </div>

      {/* Credit Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
        {packs.slice(0, 4).map((pack) => {
          const isSelected = selectedPack === pack.id;
          return (
            <Card
              key={pack.id}
              className={`relative flex flex-col justify-between transition-all hover:scale-[1.02] border-border/60 ${
                pack.isPopular ? "border-indigo-500 shadow-xl shadow-indigo-500/10 bg-indigo-950/15" : ""
              }`}
            >
              {pack.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge
                    className={
                      pack.isPopular
                        ? "bg-indigo-600 text-white font-bold uppercase text-[10px]"
                        : "bg-muted text-foreground border-border text-[10px]"
                    }
                  >
                    {pack.badge}
                  </Badge>
                </div>
              )}

              <CardContent className="p-6 space-y-6 pt-7">
                <div>
                  <h3 className="text-xl font-bold">{pack.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-black">₹{pack.priceRupees}</span>
                    <span className="text-xs text-muted-foreground">
                      / {pack.credits} credits
                    </span>
                  </div>
                  <span className="inline-block mt-1 text-xs text-muted-foreground font-medium">
                    ₹{pack.perCreditRupees.toFixed(2)} per credit
                  </span>
                </div>

                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>
                      {Math.floor(pack.credits / 2)} Quick Studio Generations
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Full Marketplace Catalog Copy</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>WhatsApp & Instagram Cards (10+ Templates)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Credits never expire</span>
                  </li>
                </ul>

                <Button
                  onClick={() => handleBuyPack(pack.id)}
                  disabled={isSelected}
                  className={`w-full font-bold ${
                    pack.isPopular
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {isSelected ? "Opening Checkout..." : `Buy for ₹${pack.priceRupees}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* High Volume Wholesale Packs */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-8 mb-20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold">Wholesale & Enterprise Packs</h3>
            <p className="text-sm text-muted-foreground">
              For high-volume manufacturers, wholesalers, and catalogs listing hundreds of SKUs monthly.
            </p>
          </div>
          <Badge variant="outline" className="text-amber-400 border-amber-400/40">
            Up to 37% Discount
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {packs.slice(4).map((pack) => (
            <div
              key={pack.id}
              className="p-5 rounded-xl border border-border/40 bg-background flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base">{pack.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {pack.savingsPercent}% Off
                  </Badge>
                </div>
                <div className="mt-2 text-2xl font-black">₹{pack.priceRupees}</div>
                <span className="text-xs text-muted-foreground">
                  {pack.credits} credits (₹{pack.perCreditRupees.toFixed(2)}/ea)
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBuyPack(pack.id)}
                className="w-full font-semibold"
              >
                Purchase Pack
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
          <p className="text-sm text-muted-foreground">Everything you need to know about ListingLift credits.</p>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border/40 bg-card space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-indigo-400" />
              How many credits does one generation cost?
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Quick Generate</strong> (1 photo → 2 studio outputs + complete text + 3 social cards) costs <strong>2 credits</strong> (~₹20).
              A full <strong>Listing Kit</strong> with 3 photos costs <strong>5 credits</strong>. Image re-editing with a new prompt costs only <strong>1 credit</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border/40 bg-card space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-indigo-400" />
              Do purchased credits expire?
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No! Your credits remain in your balance permanently until you use them. There are no monthly subscription traps or forfeitures.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border/40 bg-card space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-indigo-400" />
              What if a generation fails?
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Our automated system detects any failed jobs and automatically refunds the charged credits back to your balance immediately. You never pay for an incomplete generation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
