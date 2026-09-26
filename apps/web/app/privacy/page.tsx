export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 sm:px-6 space-y-6">
      <h1 className="text-3xl font-black">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground">Last updated: September 2026</p>
      <div className="prose dark:prose-invert text-sm space-y-4 text-muted-foreground leading-relaxed">
        <p>
          ListingLift values the privacy of your catalog assets and account details. This Privacy Policy details how we collect, process, and protect your information.
        </p>
        <h3 className="text-base font-bold text-foreground">1. Information We Collect</h3>
        <p>
          We collect your authentication details via Clerk (email, name), payment records through Razorpay, and product photographs uploaded for catalog generation.
        </p>
        <h3 className="text-base font-bold text-foreground">2. Image Processing & Storage</h3>
        <p>
          Uploaded product images are processed securely using Cloudflare R2 and state-of-the-art vision models. We do not sell your catalog imagery to third parties.
        </p>
      </div>
    </div>
  );
}
