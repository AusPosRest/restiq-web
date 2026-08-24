"use client";

// The seven owner console destinations (EXPERIENCE.md IA). Only Menu has a
// story behind it so far; the rest render ComingSoon until their stories land
// - the shell frame exists now so it doesn't get rebuilt destination by
// destination (mirrors /ops's fix/10 placeholder-pages pattern).
import { BarChart3, LayoutDashboard, MonitorSmartphone, Settings, Soup, Table2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, testId: "admin-nav-dashboard" },
  { href: "/admin/menu", label: "Menu", icon: Soup, testId: "admin-nav-menu" },
  { href: "/admin/floor-plan", label: "Floor Plan", icon: Table2, testId: "admin-nav-floor-plan" },
  { href: "/admin/devices", label: "Devices", icon: MonitorSmartphone, testId: "admin-nav-devices" },
  { href: "/admin/staff", label: "Staff", icon: Users, testId: "admin-nav-staff" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, testId: "admin-nav-reports" },
  { href: "/admin/settings", label: "Settings", icon: Settings, testId: "admin-nav-settings" },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Owner console" className="flex flex-col gap-1 px-3">
      {navItems.map(({ href, label, icon: Icon, testId }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            data-testid={testId}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "bg-primary/15 font-semibold text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
