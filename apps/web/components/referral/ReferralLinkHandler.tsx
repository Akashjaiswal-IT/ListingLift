"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { trpc } from "~/trpc/client";
import { useLanguage } from "~/providers/LanguageContext";
import {
  clearReferralCode,
  isPermanentReferralError,
  readReferralCode,
  referralCodeFromSearch,
  saveReferralCode,
} from "~/lib/referral-link";

/**
 * Captures ?ref=CODE from any page and, once the visitor is signed in, applies it
 * exactly once. Renders nothing. All rules are enforced by the server.
 */
export function ReferralLinkHandler() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const attempted = useRef(false);

  const apply = trpc.user.applyReferralCode.useMutation({
    onSuccess: (data) => {
      clearReferralCode();
      utils.user.getReferralStats.invalidate();
      toast.success(
        language === "hi"
          ? `आप ${data.referrerName || "एक सेलर"} के इनवाइट से जुड़े हैं`
          : `You joined through ${data.referrerName || "a fellow seller"}'s invite`
      );
    },
    onError: (err) => {
      // Silent: an existing account clicking a friend's link is normal, not an error to show.
      if (isPermanentReferralError(err.data?.code)) clearReferralCode();
    },
  });

  // Remember a code from the URL on every navigation (the latest link wins).
  useEffect(() => {
    const code = referralCodeFromSearch(window.location.search);
    if (code) saveReferralCode(code);
  }, [pathname]);

  // Apply the remembered code once per page load, after sign-in.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || attempted.current) return;
    const code = readReferralCode();
    if (!code) return;
    attempted.current = true;
    apply.mutate({ code });
    // apply.mutate is stable enough for a one-shot call; re-running on its identity would retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, pathname]);

  return null;
}
