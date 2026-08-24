"use client";

import { Activity, CreditCard, Inbox, LayoutDashboard, MonitorSmartphone, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The six console destinations (EXPERIENCE.md IA). Later stories add the
// pages; until then the links land on the dashboard placeholder's 404s only
// if followed - they exist so the shell frame is complete and styleable.
const navItems = [
  { href: "/ops", label: "Dashboard", icon: LayoutDashboard, testId: "ops-nav-dashboard" },
  { href: "/ops/tenants", label: "Tenants", icon: Store, testId: "ops-nav-tenants" },
  { href: "/ops/devices", label: "Devices", icon: MonitorSmartphone, testId: "ops-nav-devices" },
  { href: "/ops/subscriptions", label: "Subscriptions", icon: CreditCard, testId: "ops-nav-subscriptions" },
  { href: "/ops/sync-health", label: "Sync Health", icon: Activity, testId: "ops-nav-sync-health" },
  { href: "/ops/dlq", label: "Dead-Letter Queue", icon: Inbox, testId: "ops-nav-dlq" },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Console" className="flex flex-col gap-1 px-3">
      {navItems.map(({ href, label, icon: Icon, testId }) => {
        const active = href === "/ops" ? pathname === "/ops" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            data-testid={testId}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active
                ? "bg-primary/15 font-semibold text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
