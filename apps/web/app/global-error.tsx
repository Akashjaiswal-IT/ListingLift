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
        <svg
          width="48"
          height="48"
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ marginBottom: "0.5rem" }}
          aria-hidden="true"
        >
          <rect width="96" height="96" rx="22" fill="#E05822" />
          <g fill="#fff">
            <path d="M59.49,44.92 L78.2,63.62 A34,34 0 0 1 49.57,81.96 L56.41,56.41 Z" fillOpacity="0.49" />
            <path d="M44.92,59.49 L19.37,66.34 A34,34 0 0 1 17.8,32.38 L36.51,51.08 Z" fillOpacity="0.92" />
            <path d="M36.51,51.08 L17.8,32.38 A34,34 0 0 1 46.43,14.04 L39.59,39.59 Z" fillOpacity="0.99" />
            <path d="M51.08,36.51 L76.63,29.66 A34,34 0 0 1 78.2,63.62 L59.49,44.92 Z" fillOpacity="0.56" />
            <path d="M56.41,56.41 L49.57,81.96 A34,34 0 0 1 19.37,66.34 L44.92,59.49 Z" fillOpacity="0.66" />
            <path d="M39.59,39.59 L46.43,14.04 A34,34 0 0 1 76.63,29.66 L51.08,36.51 Z" fillOpacity="0.82" />
          </g>
          <path d="M48,40.62 Q48,48 55.38,48 Q48,48 48,55.38 Q48,48 40.62,48 Q48,48 48,40.62 Z" fill="#fff" />
        </svg>
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
