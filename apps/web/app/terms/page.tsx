export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 sm:px-6 space-y-6">
      <h1 className="text-3xl font-black">Terms of Service</h1>
      <p className="text-xs text-muted-foreground">Last updated: September 2026</p>
      <div className="prose dark:prose-invert text-sm space-y-4 text-muted-foreground leading-relaxed">
        <p>
          Welcome to ListingLift. By signing up, accessing, or using our AI product photography and listing generation services, you agree to be bound by these Terms of Service.
        </p>
        <h3 className="text-base font-bold text-foreground">1. Account & Credits</h3>
        <p>
          Users purchase credits to generate studio photos, copy, and marketing cards. Credits do not expire. Credits are non-transferable between accounts.
        </p>
        <h3 className="text-base font-bold text-foreground">2. Permitted Commercial Usage</h3>
        <p>
          You retain full ownership and commercial rights to all generated photos, marketplace listings, and marketing deliverables created through your account for selling on e-commerce platforms.
        </p>
        <h3 className="text-base font-bold text-foreground">3. Acceptable Content Policy</h3>
        <p>
          You agree not to upload illegal, defamatory, obscene, or trademark-infringing content. ListingLift employs safety detection filters to prevent abuse.
        </p>
      </div>
    </div>
  );
}
