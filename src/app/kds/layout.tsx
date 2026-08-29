import type { Metadata } from "next";
import { Hanken_Grotesk, Inter, Public_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { parsePosStaffDisplay, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { KdsOutletProvider } from "./kds-outlet-context";
import { SignedOutNotice } from "./signed-out-notice";

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RESTIQ Kitchen Display",
  description: "Kitchen display station queue, expo, bumped-tickets, and all-day production summary",
  robots: { index: false, follow: false },
};

// KDS's own theme wraps everything under /kds (issue #66, kitchen-display
// CAP-2 - a sixth disjoint surface theme alongside ops/pos/admin/qr, though
// it rides the pos auth realm, not a new one - see src/proxy.ts). Mirrors
// pos/layout.tsx's shape exactly (bare theme wrapper; the header/chrome
// lives one level down in (shell)/layout.tsx, since the station picker at
// /kds itself renders full-screen with no header - EXPERIENCE.md's entry
// flow: "PIN login -> station picker -> K1", the picker is its own step).
//
// Reads the pos_staff cookie server-side (same stand-in src/lib/pos-session.ts
// documents for POS - no `/pos/v1/auth/me` read-back endpoint exists) to
// resolve which outlet this display belongs to, handed down via
// KdsOutletProvider so no client component re-parses it. The proxy already
// guarantees a valid pos_session reached this far, but the display cookie is
// non-essential (httpOnly, best-effort) - if it's ever missing, show a plain
// sign-out affordance rather than crash the whole surface.
export default async function KdsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const display = parsePosStaffDisplay(cookieStore.get(POS_STAFF_COOKIE)?.value);

  return (
    <div
      className={`${hankenGrotesk.variable} ${inter.variable} ${publicSans.variable} kds-theme flex min-h-screen flex-1 flex-col bg-background text-foreground antialiased`}
    >
      {display ? <KdsOutletProvider outlet={display.outlet}>{children}</KdsOutletProvider> : <SignedOutNotice />}
    </div>
  );
}
