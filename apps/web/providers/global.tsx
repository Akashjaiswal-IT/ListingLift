"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import React, { useState } from "react";
import { Toaster } from "~/components/ui/sonner";

import { trpc } from "~/trpc/client";
import { createTRPCHttpBatchClientClient } from "~/trpc/create-client";

import { LanguageProvider } from "./LanguageContext";
import { ReferralLinkHandler } from "~/components/referral/ReferralLinkHandler";
import { OnboardingTour } from "~/components/onboarding/OnboardingTour";

export const GlobalProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnMount: true,
            refetchOnWindowFocus: true,
            staleTime: 5000,
          },
        },
      })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [createTRPCHttpBatchClientClient()],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <LanguageProvider>
          <trpc.Provider queryClient={queryClient} client={trpcClient}>
            {children}
            <ReferralLinkHandler />
            {/* Mounted once for the whole site so the first-run tour and the
                navbar "?" button work on every page, not just the landing page. */}
            <OnboardingTour />
            <Toaster />
          </trpc.Provider>
        </LanguageProvider>
      </NextThemesProvider>
    </QueryClientProvider>
  );
};
