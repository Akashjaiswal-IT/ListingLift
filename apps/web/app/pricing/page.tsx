import type { Metadata } from "next";
import { PricingPage } from "~/components/pricing/PricingPage";
import { SoftwareApplicationStructuredData } from "~/components/seo/StructuredData";

export const metadata: Metadata = {
  title: "Peshkar AI Pricing | Product Photo & Listing Credits",
  description:
    "Buy flexible Peshkar AI credits for product photos, marketplace listings, and social selling content. No recurring subscription.",
  alternates: { canonical: "/pricing" },
};

export default function Page() {
  return (
    <>
      <SoftwareApplicationStructuredData />
      <PricingPage />
    </>
  );
}
