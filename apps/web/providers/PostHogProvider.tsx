"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useUser } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const isPlaceholder =
  !posthogKey ||
  posthogKey.includes("placeholder") ||
  posthogKey.includes("YOUR_POSTHOG_KEY");

if (typeof window !== "undefined" && posthogKey && !isPlaceholder) {
  posthog.init(posthogKey, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && !isPlaceholder) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = `${url}?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

function ClerkAuthSync() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || isPlaceholder) return;

    if (user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
        createdAt: user.createdAt,
      });
    } else {
      posthog.reset();
    }
  }, [user, isLoaded]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (isPlaceholder) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <ClerkAuthSync />
      {children}
    </PHProvider>
  );
}
