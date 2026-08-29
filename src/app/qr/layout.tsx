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
  title: "Order at your table",
  description: "Scan, start or join your table, and order together - no app or account needed",
  robots: { index: false, follow: false },
};

// Guest's own theme wraps everything under /qr (SPEC's fifth realm) -
// mirrors pos/layout.tsx and admin/layout.tsx. This is a guest's own phone,
// not a staff tool: same charcoal-and-amber brand family but the one
// surface with a softer 12px radius and food photography allowed
// (ux-qr-self-order DESIGN.md).
export default function GuestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${hankenGrotesk.variable} ${inter.variable} ${publicSans.variable} qr-theme flex min-h-screen flex-1 flex-col bg-background text-foreground antialiased`}
    >
      {children}
    </div>
  );
}
