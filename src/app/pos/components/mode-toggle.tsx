// Counter | Tables mode toggle (issue #335), shared by the QSR counter and the
// table map headers. Each side is a link, so the switch is one tap and the
// browser history still works.
import Link from "next/link";

const MODES = [
  { mode: "counter", href: "/pos/counter", label: "Counter" },
  { mode: "tables", href: "/pos/table-map", label: "Tables" },
] as const;

export function ModeToggle({ current }: Readonly<{ current: "counter" | "tables" }>) {
  return (
    <nav aria-label="POS mode" data-testid="pos-mode-toggle" className="inline-flex rounded-lg border border-border p-0.5">
      {MODES.map(({ mode, href, label }) => {
        const active = mode === current;
        return (
          <Link
            key={mode}
            href={href}
            data-testid={`pos-mode-${mode}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
