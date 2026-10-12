import { notFound } from "next/navigation";
import { demoPagesEnabled } from "@/lib/demo-pages";

// PE-30: 404 in production unless DEMO_PAGES=on. Read per request, not baked in at build time.
export const dynamic = "force-dynamic";

export default function SimulatorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!demoPagesEnabled()) notFound();
  return children;
}
