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
  title: "RESTIQ POS",
  description: "Cashier and waiter POS - PIN login, shift clock, table map, order taking, and settlement",
  robots: { index: false, follow: false },
};

// POS's own theme wraps everything under /pos (SPEC's AD-13, a fourth
// disjoint realm alongside /ops and /admin) - mirrors admin/layout.tsx. PIN
// login and the post-login shift-bar shell (story 1/#38) live under
// src/app/pos/login and src/app/pos/(shell); table-map and every screen
// after it live in their own route folders since this realm has no shared
// sidebar chrome (EXPERIENCE.md: tablet-width, top-bar-per-screen, not a desk
// console sidebar).
export default function PosLayout({
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
