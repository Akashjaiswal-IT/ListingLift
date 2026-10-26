"use client";

import Link from "next/link";
import { Coins, ArrowUpRight, ArrowDownLeft, Sparkles, Clock, RefreshCw, FileText, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { trpc } from "~/trpc/client";
import { useCreditStore } from "~/stores/useCreditStore";
import { useEffect, useState } from "react";
import { useLanguage } from "~/providers/LanguageContext";
import { toast } from "sonner";
import { formatDateTime } from "~/lib/format-date";
import { packDisplayName } from "~/lib/pack-names";

// Ledger entry types as stored by the server (credit-ledger.model.ts), plus the
// legacy lowercase names older rows may still carry.
const LEDGER_TYPE_LABELS: Record<string, { en: string; hi: string }> = {
  PURCHASE: { en: "Purchase", hi: "खरीद" },
  DEBIT: { en: "Used", hi: "उपयोग" },
  REFUND: { en: "Refund", hi: "रिफंड" },
  BONUS: { en: "Bonus", hi: "बोनस" },
  TRIAL: { en: "Free trial", hi: "मुफ़्त ट्रायल" },
  credit_purchase: { en: "Purchase", hi: "खरीद" },
  deduction: { en: "Used", hi: "उपयोग" },
  refund: { en: "Refund", hi: "रिफंड" },
};

function ledgerTypeLabel(type: string, isHi: boolean): string {
  const label = LEDGER_TYPE_LABELS[type];
  return label ? (isHi ? label.hi : label.en) : type;
}

export default function CreditsPage() {
  const { language } = useLanguage();
  const isHi = language === "hi";
  const { balance, setBalance, isInitialized } = useCreditStore();

  const balanceQuery = trpc.user.getCreditBalance.useQuery();
  const historyQuery = trpc.user.getCreditHistory.useQuery({ limit: 50 });
  const paymentsQuery = trpc.payments.getHistory.useQuery({ limit: 20 });
  const invoiceMutation = trpc.payments.getInvoice.useMutation();
  const [invoicingId, setInvoicingId] = useState<string | null>(null);

  useEffect(() => {
    if (balanceQuery.data?.balance !== undefined) {
      setBalance(balanceQuery.data.balance);
    }
  }, [balanceQuery.data, setBalance]);

  const history = historyQuery.data || [];
  const payments = (paymentsQuery.data?.payments || []).filter(
    (p: any) => p.status === "captured"
  );

  // Download the receipt PDF returned as a base64 data URI (no server storage).
  const handleDownloadInvoice = async (paymentId: string) => {
    setInvoicingId(paymentId);
    try {
      const res = await invoiceMutation.mutateAsync({ paymentId });
      const a = document.createElement("a");
      a.href = res.dataUri;
      a.download = res.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      toast.error(err.message || (isHi ? "रसीद बनाने में विफल" : "Could not generate receipt"));
    } finally {
      setInvoicingId(null);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black font-serif tracking-tight flex items-center gap-2.5 text-foreground">
            <Coins className="h-7 w-7 text-primary" />
            {isHi ? "क्रेडिट्स और उपयोग विवरण" : "Credits & Usage"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {isHi
              ? "अपने क्रेडिट्स की खरीद, जेनरेशन डिडक्शन और स्वतः रिफंड की जानकारी देखें।"
              : "Track your credit purchases, generation debits, and automatic refund receipts."}
          </p>
        </div>

        <Link href="/pricing">
          <Button className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-xl shadow-md transition-all active:scale-[0.98]">
            <Sparkles className="h-4 w-4" /> {isHi ? "और क्रेडिट्स खरीदें" : "Buy More Credits"}
          </Button>
        </Link>
      </div>

      {/* Credit Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="border-border/70 bg-card rounded-2xl shadow-xs">
          <CardContent className="p-6">
            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              {isHi ? "वर्तमान बैलेंस" : "Current Balance"}
            </span>
            <div className="text-4xl font-black font-serif text-primary mt-2">
              {isInitialized ? balance : (balanceQuery.isLoading ? "..." : balance)}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              {isHi ? "तत्काल उपलब्ध" : "Available immediately"}
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card rounded-2xl shadow-xs">
          <CardContent className="p-6">
            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              {isHi ? "कुल प्राप्त क्रेडिट्स" : "Lifetime Credits Earned"}
            </span>
            <div className="text-3xl font-black font-serif text-foreground mt-2">
              {balanceQuery.data?.lifetimeEarned || balance}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              {isHi ? "ट्रायल व खरीदे गए क्रेडिट्स" : "Includes Trial & Purchased packs"}
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card rounded-2xl shadow-xs">
          <CardContent className="p-6">
            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              {isHi ? "कुल प्रयुक्त क्रेडिट्स" : "Lifetime Credits Spent"}
            </span>
            <div className="text-3xl font-black font-serif text-foreground mt-2">
              {balanceQuery.data?.lifetimeSpent || 0}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              {isHi ? "स्टूडियो फ़ोटो और लिस्टिंग किट्स पर" : "On Studio Photos & Deliverables"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Credit Ledger History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-serif tracking-tight text-foreground">
            {isHi ? "लेनदेन का इतिहास" : "Transaction History"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => historyQuery.refetch()}
            className="text-xs text-muted-foreground gap-1 hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> {isHi ? "रिफ्रेश करें" : "Refresh"}
          </Button>
        </div>

        {historyQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card">
            <p className="text-xs text-muted-foreground">
              {isHi ? "अभी तक कोई क्रेडिट लेनदेन दर्ज नहीं हुआ है।" : "No credit transactions recorded yet."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
            {history.map((tx: any, idx: number) => {
              const isPositive = tx.amount > 0;
              return (
                <div key={tx._id || idx} className="p-4 flex items-center justify-between bg-card hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isPositive
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive dark:text-rose-400"
                      }`}
                    >
                      {isPositive ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{tx.description}</span>
                        <Badge variant="outline" className="text-xs uppercase font-bold">
                          {ledgerTypeLabel(String(tx.type), isHi)}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(tx.createdAt, isHi)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-black text-base block ${
                        isPositive ? "text-success" : "text-foreground"
                      }`}
                    >
                      {isPositive ? `+${tx.amount}` : tx.amount}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {isHi ? "बैलेंस:" : "Balance:"} {tx.balanceAfter}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payments & GST Invoices */}
      {payments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-serif tracking-tight text-foreground">
            {isHi ? "भुगतान और रसीदें" : "Payments & Receipts"}
          </h2>
          <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
            {payments.map((p: any) => (
              <div
                key={p._id}
                className="p-4 flex items-center justify-between gap-3 bg-card hover:bg-muted/10 transition-colors"
              >
                <div>
                  <span className="font-semibold text-sm">
                    {p.packId === "topup"
                      ? isHi
                        ? `कस्टम टॉप-अप (${p.creditsPurchased} क्रेडिट्स)`
                        : `Custom top-up (${p.creditsPurchased} credits)`
                      : `${packDisplayName(p.packId, isHi)} · ${p.creditsPurchased} ${isHi ? "क्रेडिट्स" : "credits"}`}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(p.createdAt, isHi)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-foreground">
                    ₹{(p.amountPaise / 100).toFixed(2)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={invoicingId === p._id}
                    onClick={() => handleDownloadInvoice(p._id)}
                    className="h-8 gap-1 text-xs rounded-lg"
                  >
                    {invoicingId === p._id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    {isHi ? "रसीद" : "Receipt"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
