// Shared POS header (issue #335): the QSR counter and the table map render the
// same bar - title, Counter | Tables toggle, then the screen's own actions on
// the right - so nothing jumps when switching modes. Each toggle side is a
// link, so the switch is one tap and browser history still works.
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

export function PosHeader({
  subtitle,
  mode,
  children,
}: Readonly<{ subtitle: string; mode: "counter" | "tables"; children: React.ReactNode }>) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-4 py-3 sm:px-6">
      <div className="shrink-0">
        <p className="font-headline whitespace-nowrap text-lg font-bold text-primary">RESTIQ POS</p>
        <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">{subtitle}</p>
      </div>
      <ModeToggle current={mode} />
      <div className="ml-auto flex flex-wrap items-center gap-3">{children}</div>
    </header>
  );
}
