// Rendered for any unmatched route (and when code calls notFound()). A branded
// 404 beats the default bare Next.js page.
import Link from "next/link";
import { Button } from "~/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-serif text-5xl font-black text-primary">404</p>
      <h2 className="text-xl font-bold text-foreground">Page not found</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Button asChild>
        <Link href="/app/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  );
}
