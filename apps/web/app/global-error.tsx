"use client";

// The LAST-resort error boundary. `app/error.tsx` can only catch errors in the
// tree BELOW the root layout — it cannot catch an error thrown by the root
// layout itself (Navbar, providers, fonts). `global-error.tsx` replaces the whole
// document when that happens, so it must render its own <html> and <body>.

import { useEffect } from "react";
import { captureError } from "~/lib/analytics";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { digest: error.digest, boundary: "global" });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          background: "#FAF7F2",
          color: "#191614",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Something went wrong</h2>
        <p style={{ maxWidth: "28rem", color: "#78716C", fontSize: "0.875rem" }}>
          The app ran into a problem loading this page. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#E05822",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.6rem 1.25rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
