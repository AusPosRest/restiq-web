// EXPERIENCE.md State Patterns / Stale data: "Dashboard figures show a
// 'as of [time]' badge whenever the underlying sync is behind - never
// presented as live when it isn't" (SPEC CAP-8 success criterion). The badge
// always shows the snapshot time; it only changes color/copy when stale.
import { Clock } from "lucide-react";
import { formatAsOf } from "./dashboard-state";

export function FreshnessBadge({ asOf, stale }: Readonly<{ asOf: string; stale: boolean }>) {
  return (
    <span
      data-testid="dashboard-freshness-badge"
      data-stale={stale}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        stale ? "bg-status-pending/15 text-status-pending" : "bg-accent text-muted-foreground"
      }`}
    >
      <Clock className="size-3.5" aria-hidden="true" />
      {stale ? `Sync is behind - as of ${formatAsOf(asOf)}` : `As of ${formatAsOf(asOf)}`}
    </span>
  );
}
