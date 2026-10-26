import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Playfair_Display, Noto_Sans_Devanagari } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { GlobalProviders } from "~/providers/global";
import { PostHogProvider } from "~/providers/PostHogProvider";
import { Navbar } from "~/components/layout/Navbar";
import { Footer } from "~/components/layout/Footer";
import { ClerkProvider } from "@clerk/nextjs";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Hindi glyphs: Plus Jakarta Sans and Playfair have no Devanagari, so the font
// stacks in globals.css fall back to this per character.
const deva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  variable: "--font-deva",
  display: "swap",
});

const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Peshkar AI — AI Studio Photos & Listings for E-Commerce & Marketplace Sellers",
    template: "%s · Peshkar AI",
  },
  description:
    "Transform ordinary phone photos into studio-grade e-commerce catalogs, compliant marketplace listings (Amazon, Flipkart, Meesho, Shopify), and viral social cards in minutes.",
  applicationName: "Peshkar AI",
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
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Peshkar AI — AI Studio Photos & Listings for Sellers",
    description:
      "Turn phone photos into studio-grade product images, marketplace listings, and social cards in minutes.",
    siteName: "Peshkar AI",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#E05822",
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
          className={`${sans.variable} ${serif.variable} ${deva.variable} min-h-screen bg-background text-foreground antialiased flex flex-col font-sans`}
        >
          <PostHogProvider>
            <GlobalProviders>
              <Navbar />
              <div className="flex-1">{children}</div>
              <Footer />
            </GlobalProviders>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
