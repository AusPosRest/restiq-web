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
  title: "RESTIQ Admin",
  description: "Owner console - set up and run your restaurant on RESTIQ",
  robots: { index: false, follow: false },
};

// Tenant Admin's own theme wraps everything under /admin (AD-10); the ops
// console and tenant surfaces never inherit it. T1/T2 (invite, checklist)
// render directly under here; the post-go-live shell nests its own layout
// under the (shell) route group.
export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${hankenGrotesk.variable} ${inter.variable} ${publicSans.variable} admin-theme flex min-h-screen flex-1 flex-col bg-background text-foreground antialiased`}
    >
      {children}
    </div>
  );
}
