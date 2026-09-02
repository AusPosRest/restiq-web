import type { Metadata } from "next";
import { Hanken_Grotesk, Inter, Public_Sans } from "next/font/google";

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
  title: "RESTIQ Device Enrolment",
  description: "Turn this browser tab into a POS, KDS, kiosk, or customer-display terminal",
  robots: { index: false, follow: false },
};

// Device's own minimal realm (issue #99, AD-12/AD-13): a sixth disjoint
// surface theme alongside ops/pos/admin/qr/kds - mirrors qr/layout.tsx's
// shape. There is no device auth realm to guard against (src/device/enroll
// is public by construction - see the api/[...path]/route.ts comment), so
// unlike every other realm layout this one reads no cookie and needs no
// auth check at all: the enrolment code itself is the only credential. Reuses
// pos-theme rather than declaring a seventh charcoal-and-amber block - this
// screen has no status vocabulary of its own to justify one.
export default function DeviceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${hankenGrotesk.variable} ${inter.variable} ${publicSans.variable} pos-theme flex min-h-screen flex-1 flex-col bg-background text-foreground antialiased`}
    >
      {children}
    </div>
  );
}
