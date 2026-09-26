import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)", "/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const isProd = process.env.NODE_ENV === "production";
  const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (isProd) {
    // In production, NEVER silently bypass protected routes if key is missing or placeholder
    if (!pubKey || pubKey.includes("YOUR_CLERK_PUBLISHABLE_KEY")) {
      console.error("[SECURITY CRITICAL] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is unconfigured in production.");
      if (isProtectedRoute(req)) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
      return;
    }

    if (pubKey.startsWith("pk_test_")) {
      console.warn(
        "[SECURITY WARNING] Clerk TEST key detected in PRODUCTION. Update to pk_live_... for complete environment separation."
      );
    }
  } else {
    // Development graceful fallback
    if (!pubKey || pubKey.includes("YOUR_CLERK_PUBLISHABLE_KEY")) {
      return;
    }

    if (pubKey.startsWith("pk_live_")) {
      console.warn(
        "[SECURITY WARNING] Clerk LIVE PRODUCTION key detected in DEVELOPMENT! Switch to pk_test_... to prevent modifying live users."
      );
    }
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
