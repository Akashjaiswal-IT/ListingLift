import type { Metadata } from "next";
import { HomePage } from "~/components/landing/HomePage";
import { SoftwareApplicationStructuredData } from "~/components/seo/StructuredData";

export const metadata: Metadata = {
  title: "AI Product Photos & Listings for Indian Sellers",
  description:
    "Create studio-quality product photos, marketplace listings, and social selling content for Meesho, Amazon, Flipkart, WhatsApp, and Shopify.",
  alternates: { canonical: "/" },
};

export default function Page() {
  return (
    <>
      <SoftwareApplicationStructuredData />
      <HomePage />
    </>
  );
}
