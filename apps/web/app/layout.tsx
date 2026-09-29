import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { GlobalProviders } from "~/providers/global";
import { Navbar } from "~/components/layout/Navbar";
import { Footer } from "~/components/layout/Footer";
import { ClerkProvider } from "@clerk/nextjs";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ListingLift — AI Studio Photos & Listings for E-Commerce & Marketplace Sellers",
  description:
    "Transform ordinary phone photos into studio-grade e-commerce catalogs, compliant marketplace listings (Amazon, Flipkart, Meesho, Shopify), and viral social cards in seconds.",
  keywords: [
    "ecommerce listing generator",
    "ai product photography",
    "marketplace product listings",
    "whatsapp catalog card generator",
    "online seller tools",
    "instagram product post maker",
    "e-commerce copywriting ai",
    "meesho amazon flipkart catalog maker",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <Script
            src="https://checkout.razorpay.com/v1/checkout.js"
            strategy="lazyOnload"
          />
        </head>
        <body
          className={`${sans.variable} ${serif.variable} min-h-screen bg-background text-foreground antialiased flex flex-col font-sans`}
        >
          <GlobalProviders>
            <Navbar />
            <div className="flex-1">{children}</div>
            <Footer />
          </GlobalProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
