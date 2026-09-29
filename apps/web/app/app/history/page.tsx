"use client";

import { useState } from "react";
import Link from "next/link";
import {
  History,
  Layers,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Filter,
  Calendar,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { trpc } from "~/trpc/client";

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const listingsQuery = trpc.listing.list.useQuery({
    page,
    limit: 12,
    status: statusFilter === "all" ? undefined : (statusFilter as any),
    type: typeFilter === "all" ? undefined : (typeFilter as any),
  });

  const listings = listingsQuery.data?.items || [];
  const total = listingsQuery.data?.total || 0;
  const totalPages = listingsQuery.data?.totalPages || 1;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-indigo-400" />
            Catalog History
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            All your generated studio product photos and marketplace listings ({total} total).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(1); }}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="listing_product">Quick Product</SelectItem>
              <SelectItem value="listing_kit">Listing Kit</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Link href="/app/generate">
            <Button size="sm" className="h-9 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">
              + New
            </Button>
          </Link>
        </div>
      </div>

      {listingsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-56 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="p-16 text-center rounded-2xl border border-dashed border-border/80 space-y-4 max-w-md mx-auto">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-base">No listings found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your filters or create a new studio listing.
            </p>
          </div>
          <Link href="/app/generate">
            <Button size="sm" className="font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">
              Generate New Listing
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {listings.map((item: any) => {
            const previewImg =
              item.generatedImages?.find((img: any) => img.isLatest !== false)?.url ||
              item.originalImages?.[0]?.url;

            return (
              <Card
                key={item._id}
                className="overflow-hidden border-border/60 hover:border-indigo-500/40 transition-all hover:shadow-md flex flex-col justify-between"
              >
                <div className="relative aspect-square bg-muted">
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

                <CardContent className="p-4 space-y-2">
                  <h4 className="font-bold text-sm line-clamp-1">
                    {item.userTitle || "Untitled Product"}
                  </h4>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.price ? `₹${item.price}` : "No price"}</span>
                    <span>{item.type === "listing_product" ? "Quick" : "Kit"}</span>
                  </div>
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <Link href={`/app/listing/${item._id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 font-semibold text-indigo-400">
                        View <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
