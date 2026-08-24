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
  title: "RESTIQ Platform Console",
  description: "Internal operator surface - onboard tenants, operate the fleet, watch sync health",
  robots: { index: false, follow: false },
};

// Console Dark wraps everything under /ops; tenant surfaces never inherit it.
export default function OpsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${hankenGrotesk.variable} ${inter.variable} ${publicSans.variable} ops-theme flex min-h-screen flex-1 flex-col bg-background text-foreground antialiased`}
    >
      {children}
    </div>
  );
}
