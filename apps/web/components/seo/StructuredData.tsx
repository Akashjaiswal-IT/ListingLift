const siteUrl = "https://www.peshkarai.in";
const socialPreviewImage = `${siteUrl}/images/peshkar-social-preview.png`;

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function SiteStructuredData() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${siteUrl}/#organization`,
            name: "Peshkar AI",
            url: siteUrl,
            logo: `${siteUrl}/icon.svg`,
            email: "support@peshkarai.in",
          },
          {
            "@type": "WebSite",
            "@id": `${siteUrl}/#website`,
            name: "Peshkar AI",
            url: siteUrl,
            publisher: { "@id": `${siteUrl}/#organization` },
          },
        ],
      }}
    />
  );
}

export function SoftwareApplicationStructuredData() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Peshkar AI",
        url: siteUrl,
        image: socialPreviewImage,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "AI product photography, marketplace listing copy, and social selling content for Indian e-commerce sellers.",
        publisher: { "@id": `${siteUrl}/#organization` },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "INR",
          lowPrice: "499",
          highPrice: "5499",
          offerCount: 4,
          offers: [
            { "@type": "Offer", price: "499", priceCurrency: "INR", name: "15 credits" },
            { "@type": "Offer", price: "1199", priceCurrency: "INR", name: "40 credits" },
            { "@type": "Offer", price: "2499", priceCurrency: "INR", name: "100 credits" },
            { "@type": "Offer", price: "5499", priceCurrency: "INR", name: "250 credits" },
          ],
        },
      }}
    />
  );
}
