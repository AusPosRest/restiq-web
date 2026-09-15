import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BRAND_BG } from "./brand-icon";
import { InstallBanner } from "./install-banner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Restiq",
  description: "Point of sale for restaurants, burger shops and snack bars",
  // iOS home-screen app (issue #222): full screen, named RESTIQ under the icon.
  appleWebApp: { capable: true, title: "RESTIQ", statusBarStyle: "black" },
};

export const viewport: Viewport = { themeColor: BRAND_BG };

// children typed explicitly rather than with Next's generated LayoutProps: that
// type only exists after a build, and CI runs typecheck before build.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <InstallBanner />
      </body>
    </html>
  );
}
