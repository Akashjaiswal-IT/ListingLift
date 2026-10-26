"use client";

import Link from "next/link";
import { ArrowRight, Clock, Loader2, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { StatusBadge } from "~/components/listing/StatusBadge";
import { normalizePricing, formatINR } from "~/lib/price-display";
import { formatDate } from "~/lib/format-date";

export interface ListingCardItem {
  _id: string;
  userTitle?: string;
  status: string;
  type?: string;
  price?: number | null;
  discountPrice?: number | null;
  createdAt: string | Date;
  generatedImages?: { url?: string; isLatest?: boolean }[];
  originalImages?: { url?: string }[];
}

/**
 * A listing thumbnail card. The whole card is one link: finished listings open
 * their deliverables, in-progress ones reopen the live progress screen.
 */
export function ListingCard({ item, isHi }: { item: ListingCardItem; isHi: boolean }) {
  const previewImg =
    item.generatedImages?.find((img) => img.isLatest !== false)?.url || item.originalImages?.[0]?.url;
  const inProgress = item.status === "queued" || item.status === "processing";
  const href = inProgress ? `/app/generate?listing=${item._id}` : `/app/listing/${item._id}`;
  // price = MRP, discountPrice = selling price: show what the customer pays.
  const selling = normalizePricing(item.price, item.discountPrice).selling;
  const title = item.userTitle || (isHi ? "बिना नाम का प्रोडक्ट" : "Untitled product");

  return (
    <Card className="relative overflow-hidden border-border/60 transition-colors hover:border-primary/40 bg-card group focus-within:ring-2 focus-within:ring-ring">
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          {previewImg ? (
            <img
              src={previewImg}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ShoppingBag className="h-8 w-8 opacity-40" aria-hidden="true" />
            </div>
          )}
          <div className="absolute right-2 top-2">
            <StatusBadge status={item.status} isHi={isHi} />
          </div>
        </div>

        <div>
          <h3 className="line-clamp-1 text-sm font-bold text-foreground">
            {/* Stretched link: the whole card is clickable, one tab stop per card */}
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {title}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {selling ? formatINR(selling) : isHi ? "कीमत नहीं डाली" : "No price set"} ·{" "}
            {item.type === "listing_kit"
              ? isHi ? "फुल लिस्टिंग किट" : "Listing kit"
              : isHi ? "क्विक स्टूडियो" : "Quick studio"}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatDate(item.createdAt, isHi)}
          </span>
          <span className="flex items-center gap-1 font-bold text-primary">
            {inProgress ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                {isHi ? "प्रगति देखें" : "View progress"}
              </>
            ) : (
              <>
                {isHi ? "किट देखें" : "View kit"} <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
