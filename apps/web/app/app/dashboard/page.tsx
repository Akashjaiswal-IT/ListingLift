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
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { trpc } from "~/trpc/client";
import { useCreditStore } from "~/stores/useCreditStore";
import { useEffect } from "react";

export default function DashboardPage() {
  const { balance, setBalance, isInitialized } = useCreditStore();

  const balanceQuery = trpc.credits.getBalance.useQuery();
  const listingsQuery = trpc.listing.list.useQuery({ page: 1, limit: 6 });

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
          <h1 className="text-3xl font-black tracking-tight">Seller Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your AI studio catalogs, check credit usage, and export listings.
          </p>
        </div>

        <Link href="/app/generate">
          <Button
            size="lg"
            className="h-11 px-6 font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-amber-500 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md rounded-xl gap-2"
          >
            <PlusCircle className="h-5 w-5" />
            New Studio Listing
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="border-border/60 bg-gradient-to-br from-indigo-950/20 to-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Available Credits
              </span>
              <div className="text-3xl font-black text-amber-400">
                {isInitialized ? balance : (balanceQuery.isLoading ? "..." : balance)}
              </div>
              <span className="text-xs text-muted-foreground block">
                ≈ {Math.floor(balance / 2)} Quick Studio Generations
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Coins className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Total Listings Created
              </span>
              <div className="text-3xl font-black">{totalCount}</div>
              <span className="text-xs text-muted-foreground block">
                Across Marketplaces & Social Catalogs
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Listing Success Rate
              </span>
              <div className="text-3xl font-black text-emerald-400">99.4%</div>
              <span className="text-xs text-muted-foreground block">
                Automated credit refund protection
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Launch Banner */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-900/30 via-violet-900/20 to-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold">Need Studio Photos for your new inventory?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload raw product photos from your phone. AI generates 8K studio variations, marketplace titles, and branded social cards.
            </p>
          </div>
        </div>
        <Link href="/app/generate">
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
            Start Generation (2 Credits)
          </Button>
        </Link>
      </div>

      {/* Recent Listings Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Recent Catalogs</h2>
          <Link href="/app/history" className="text-xs font-semibold text-indigo-400 hover:underline">
            View All Catalogs ({totalCount}) →
          </Link>
        </div>

        {listingsQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border/80 space-y-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold">No catalogs created yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Upload your first product photo to see studio outputs, marketplace listing copy, and social cards in seconds.
              </p>
            </div>
            <Link href="/app/generate">
              <Button size="sm" className="font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">
                Create First Listing
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
                  className="overflow-hidden border-border/60 hover:border-indigo-500/40 transition-all hover:shadow-md flex flex-col justify-between"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                      {previewImg ? (
                        <img
                          src={previewImg}
                          alt={item.userTitle || "Product"}
                          className="w-full h-full object-cover"
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
                          className="capitalize text-[10px] font-semibold"
                        >
                          {item.status}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm line-clamp-1">
                        {item.userTitle || "Untitled Product"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.price ? `₹${item.price}` : "No price set"} •{" "}
                        {item.type === "listing_product" ? "Quick Product" : "Listing Kit"}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      <Link href={`/app/listing/${item._id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 font-semibold text-indigo-400">
                          View Deliverables <ArrowRight className="h-3 w-3" />
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
