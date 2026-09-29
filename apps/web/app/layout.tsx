import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { GlobalProviders } from "~/providers/global";
import { Navbar } from "~/components/layout/Navbar";
import { Footer } from "~/components/layout/Footer";
import { ClerkProvider } from "@clerk/nextjs";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
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
      <html lang="en" className="dark">
        <head>
          <Script
            src="https://checkout.razorpay.com/v1/checkout.js"
            strategy="lazyOnload"
          />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased flex flex-col font-sans`}
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
