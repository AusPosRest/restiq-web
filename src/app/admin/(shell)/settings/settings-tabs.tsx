"use client";

// Branding / Capabilities tab strip (T10 render). Same active-link idiom as
// the shell's own SidebarNav (Link + usePathname), not a new tab primitive -
// this is two destinations, not a generic tabs component the app needs
// elsewhere yet.
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/settings/branding", label: "Branding", testId: "settings-tab-branding" },
  { href: "/admin/settings/capabilities", label: "Capabilities", testId: "settings-tab-capabilities" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="flex gap-6 border-b border-border/40">
      {TABS.map(({ href, label, testId }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            data-testid={testId}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
