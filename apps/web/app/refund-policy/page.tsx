export default function RefundPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 sm:px-6 space-y-6">
      <h1 className="text-3xl font-black">Refund & Cancellation Policy</h1>
      <p className="text-xs text-muted-foreground">Last updated: September 2026</p>
      <div className="prose dark:prose-invert text-sm space-y-4 text-muted-foreground leading-relaxed">
        <p>
          At ListingLift, we stand firmly behind the quality of our service. Our automated refund system is built directly into our platform architecture.
        </p>
        <h3 className="text-base font-bold text-foreground">1. Automated Generation Failure Protection</h3>
        <p>
          If an image generation or text catalog pipeline fails due to an unexpected system or AI provider error, your credits are automatically and instantly refunded back to your account balance.
        </p>
        <h3 className="text-base font-bold text-foreground">2. Credit Pack Purchases</h3>
        <p>
          Credit packs purchased via Razorpay are generally non-refundable once credits have been partially or fully consumed. If you experience duplicate billing or technical issues, contact our support team at support@listinglift.com for a full review and prompt resolution.
        </p>
      </div>
    </div>
  );
}
