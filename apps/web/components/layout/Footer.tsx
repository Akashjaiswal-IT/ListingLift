import Link from "next/link";
import { Sparkles, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/20 py-12">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold">ListingLift</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Empowering e-commerce sellers, D2C brands, and marketplace merchants to turn ordinary phone photos into high-converting studio catalogs, marketplace listings, and viral WhatsApp & Instagram cards.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/app/generate" className="hover:text-foreground transition-colors">
                  Quick Studio Generator
                </Link>
              </li>
              <li>
                <Link href="/app/generate" className="hover:text-foreground transition-colors">
                  Full Marketplace Kit
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  Credit Pricing
                </Link>
              </li>
              <li>
                <Link href="/app/credits" className="hover:text-foreground transition-colors">
                  Trial ₹99 Pack
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Legal & Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-foreground transition-colors">
                  Refund & Cancellation Policy
                </Link>
              </li>
              <li>
                <a href="mailto:support@listinglift.com" className="hover:text-foreground transition-colors">
                  support@listinglift.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} ListingLift Technologies. All rights reserved.</p>
          <p className="flex items-center gap-1 mt-2 sm:mt-0">
            Crafted with <Heart className="h-3 w-3 text-rose-500 fill-rose-500" /> for Indian Resellers & E-Commerce Entrepreneurs.
          </p>
        </div>
      </div>
    </footer>
  );
}
