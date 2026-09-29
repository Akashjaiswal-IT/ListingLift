# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Indian D2C brand founders, resellers on Meesho, Amazon, and Flipkart, and independent retail merchants. They shoot raw product photos on their smartphones and need commercial-grade visual and textual catalog assets to list on marketplaces and sell directly to customers over WhatsApp and Instagram without hiring photographers, studios, or copywriters.

## Product Purpose

ListingLift eliminates the expensive and slow commercial photography pipeline for e-commerce sellers. It turns amateur phone photos into high-converting studio photography and complete marketplace-ready listings in seconds. Success is defined as a merchant uploading a raw phone picture and immediately getting studio-grade images, compliant marketplace catalog copy, and branded social marketing cards ready to publish.

## Positioning

An automated all-in-one AI e-commerce production studio delivering a complete multi-channel marketing kit in a single pipeline — 8K photorealistic studio variations, marketplace-optimized catalog copy, high-converting SEO bullet points, ready-to-share WhatsApp broadcast copy, and 3 formatted social cards — powered by transparent pay-as-you-go credits (~₹10/credit) with automated failure refunds and zero subscription lock-in.

## Operating Context

- Fast-paced inventory onboarding where sellers need to catalog dozens of SKUs quickly.
- Dual-channel selling: formal marketplace listings (Amazon, Flipkart, Meesho, Shopify) combined with direct social commerce (WhatsApp broadcasts, Instagram posts/stories).
- Mobile-first workflows: sellers capture product photos directly on phones and frequently manage orders on mobile apps.
- Price-sensitive commerce where margins are tight and traditional photoshoot costs are prohibitive.

## Capabilities and Constraints

- **Confirmed Functionality**:
  - Quick Product generation (1 photo → 2 studio variations, full copy, 3 social cards for 2 credits).
  - Multi-photo Listing Kit generation (up to 5 photos for 5–6 credits).
  - Iterative prompt-based studio re-editing (1 credit) with live worker polling and automatic refund upon job failure.
  - Multi-platform catalog copy: marketplace titles, category & subcategory classification, specs, and formatted descriptions.
  - SEO search optimization: meta descriptions, 50–80 character titles, bullet points, and keyword tags.
  - Social commerce generation: WhatsApp broadcast copy with 1-click WhatsApp deep link, Instagram captions, and targeted hashtags.
  - Branded social cards rendered via Sharp across 10 curated design templates (`minimal-luxury`, `midnight-gold`, `clean-modern`, etc.).
  - High-compression ZIP bundle packaging for one-click bulk downloading.
  - Transparent credit balance management with full transaction ledger history.
- **Technical Architecture**: Next.js 15 App Router, React 19, Tailwind CSS, tRPC, React Query, BullMQ + Redis worker queues, MongoDB via Mongoose, Cloudflare R2 / S3 storage, Clerk auth, and Razorpay payments.

## Brand Commitments

- **Name**: ListingLift
- **Subtitle**: AI E-Commerce Studio
- **Tone & Voice**: Empowering, professional, practical, rapid, and trustworthy.
- **Aesthetic Direction**: Sleek modern studio aesthetic with dark mode support, rich indigo/violet gradients, amber credit accents, and crisp contrast.

## Evidence on Hand

- Fully operational production-grade codebase spanning web app (`apps/web`), worker processing engine (`apps/worker`), shared database models (`packages/database`), and tRPC server (`packages/trpc`).
- End-to-end test suite (`scripts/test-e2e.ts`) validating credit balance deductions, refund guarantees, sharp canvas rendering, and prompt re-edits.
- Card template design token library (`apps/web/lib/card-templates.ts`).

## Product Principles

1. **Deliverables Over Raw Output**: Merchants don't just want an image; they need the complete package to start selling immediately (studio images, listing copy, and branded social cards).
2. **Zero-Risk Merchant Protection**: Automated credit refunds guarantee that merchants never lose money or credits on failed or incomplete jobs.
3. **No Subscription Traps**: Transparent pay-as-you-go credit economics where credits never expire.
4. **Tailored to Real-World Indian Commerce**: Built around the actual day-to-day channels sellers use — WhatsApp broadcast lists, Meesho catalogs, and festive sales campaigns.

## Accessibility & Inclusion

- Responsive layout adapted for mobile and desktop screens.
- High contrast ratios for all critical text, badges, and action triggers.
- Explicit visual status indicators (spinners, progress bars, toasts, and badges) across all asynchronous AI operations so users always know job state.
