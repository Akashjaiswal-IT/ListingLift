import type { Metadata } from "next";
import { MobileTabBar } from "~/components/layout/MobileTabBar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Signed-in app shell: on phones, a bottom tab bar replaces the marketing footer
// (the padding keeps the last bit of each page clear of the bar).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-24 md:pb-0">{children}</div>
      <MobileTabBar />
    </>
  );
}
