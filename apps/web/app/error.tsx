"use client";

// A route-segment Error Boundary. Next.js renders this automatically whenever a
// Server or Client Component below it throws during rendering. It MUST be a
// Client Component and accepts the thrown `error` plus a `reset()` that re-renders
// the segment. Without this file, a thrown error shows the generic Next.js error
// overlay (dev) or a blank screen (prod) — this gives users a way out.

import { useEffect } from "react";
import { Button } from "~/components/ui/button";
import { captureError } from "~/lib/analytics";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to PostHog so we learn about production errors without the user
    // having to tell us. `digest` is Next.js's server-error id.
    captureError(error, { digest: error.digest, boundary: "segment" });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="font-serif text-2xl font-bold text-foreground">
        Something went wrong
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        We hit an unexpected error. You can try again — if it keeps happening,
        please contact support.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/app/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
