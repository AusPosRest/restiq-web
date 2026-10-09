// Shared POS header (issue #335): the QSR counter and the table map render the
// same bar - title, Counter/Tables switch, then the screen's own actions on
// the right - so nothing jumps when switching modes.
import Link from "next/link";

const HREF = { counter: "/pos/counter", tables: "/pos/table-map" } as const;

// A switch, not two buttons: Counter [ o--] Tables, the knob sits on the current
// mode and one tap anywhere on it goes to the other. It is a link (navigation),
// so the label says where it goes rather than claiming role="switch".
export function ModeToggle({ current }: Readonly<{ current: "counter" | "tables" }>) {
  const other = current === "counter" ? "tables" : "counter";
  const label = (mode: "counter" | "tables", text: string) => (
    <span
      data-testid={`pos-mode-${mode}`}
      data-active={mode === current}
      className={`text-xs font-semibold uppercase tracking-wider ${mode === current ? "text-primary" : "text-muted-foreground"}`}
    >
      {text}
    </span>
  );
  return (
    <Link
      href={HREF[other]}
      data-testid="pos-mode-toggle"
      aria-label={`Switch to ${other === "tables" ? "Tables" : "Counter"} mode`}
      className="inline-flex items-center gap-2 rounded-full px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label("counter", "Counter")}
      <span aria-hidden="true" className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-primary/25 ring-1 ring-primary/50">
        <span className={`absolute size-5 rounded-full bg-primary shadow transition-transform ${current === "tables" ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
      </span>
      {label("tables", "Tables")}
    </Link>
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
