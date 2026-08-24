// KPI StatCard (DESIGN.md components list) - the shared tile shell for both
// the real-count strip and the per-outlet financial tiles. Financial tiles
// render NoFinancialData instead of a value when the metric is unavailable
// (no fake zero - see dashboard-state.ts's file header).
import type { LucideIcon } from "lucide-react";

export function KpiStatCard({
  testId,
  label,
  icon: Icon,
  children,
}: Readonly<{ testId: string; label: string; icon?: LucideIcon; children: React.ReactNode }>) {
  return (
    <div data-testid={testId} className="rounded-lg border border-border/40 bg-card p-5">
      <p className="font-label flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function CountValue({ testId, value }: Readonly<{ testId: string; value: number }>) {
  return (
    <p data-testid={testId} className="text-3xl font-semibold tabular-nums">
      {value.toLocaleString()}
    </p>
  );
}

export function NoFinancialData({ testId }: Readonly<{ testId: string }>) {
  return (
    <p data-testid={testId} className="text-sm text-muted-foreground">
      No sales data yet.
      <br />
      <span className="text-xs">Connect POS to see live figures.</span>
    </p>
  );
}
