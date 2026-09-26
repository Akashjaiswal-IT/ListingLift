"use client";

import Link from "next/link";
import { Coins, ArrowUpRight, ArrowDownLeft, Sparkles, Clock, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { trpc } from "~/trpc/client";
import { useCreditStore } from "~/stores/useCreditStore";
import { useEffect } from "react";

export default function CreditsPage() {
  const { balance, setBalance } = useCreditStore();

  const balanceQuery = trpc.user.getCreditBalance.useQuery();
  const historyQuery = trpc.user.getCreditHistory.useQuery({ limit: 50 });

  useEffect(() => {
    if (balanceQuery.data?.balance !== undefined) {
      setBalance(balanceQuery.data.balance);
    }
  }, [balanceQuery.data, setBalance]);

  const history = historyQuery.data || [];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Coins className="h-6 w-6 text-amber-500" />
            Credits & Usage
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Track your credit purchases, generation debits, and automatic refund receipts.
          </p>
        </div>

        <Link href="/pricing">
          <Button className="font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Sparkles className="h-4 w-4 text-amber-300" /> Buy More Credits
          </Button>
        </Link>
      </div>

      {/* Credit Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="border-border/60 bg-gradient-to-br from-amber-950/20 to-card">
          <CardContent className="p-6">
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Current Balance
            </span>
            <div className="text-4xl font-black text-amber-400 mt-2">{balance}</div>
            <span className="text-xs text-muted-foreground mt-1 block">
              Available immediately
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card">
          <CardContent className="p-6">
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Lifetime Credits Earned
            </span>
            <div className="text-3xl font-black mt-2">
              {balanceQuery.data?.lifetimeEarned || balance}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              Includes Trial & Purchased packs
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card">
          <CardContent className="p-6">
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Lifetime Credits Spent
            </span>
            <div className="text-3xl font-black mt-2">
              {balanceQuery.data?.lifetimeSpent || 0}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              On Studio Photos & Deliverables
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Credit Ledger History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Transaction History</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => historyQuery.refetch()}
            className="text-xs text-muted-foreground gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>

        {historyQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border/80">
            <p className="text-xs text-muted-foreground">No credit transactions recorded yet.</p>
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
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
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
                        <Badge variant="outline" className="text-[9px] uppercase font-bold">
                          {tx.type}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground mt-0.5 block flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(tx.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-black text-base block ${
                        isPositive ? "text-emerald-400" : "text-foreground"
                      }`}
                    >
                      {isPositive ? `+${tx.amount}` : tx.amount}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Balance: {tx.balanceAfter}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
