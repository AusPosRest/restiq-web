// Status rendered through the five fixed semantic colors (DESIGN.md) - badges
// always carry text, never color alone.
const STYLES: Record<string, string> = {
  active: "border-status-healthy/50 bg-status-healthy/10 text-status-healthy",
  inactive: "border-status-warning/50 bg-status-warning/10 text-status-warning",
  provisioning: "border-status-pending/50 bg-status-pending/10 text-status-pending",
  pending: "border-status-pending/50 bg-status-pending/10 text-status-pending",
  signed: "border-status-healthy/50 bg-status-healthy/10 text-status-healthy",
  expired: "border-status-critical/50 bg-status-critical/10 text-status-critical",
  suspended: "border-status-critical/50 bg-status-critical/10 text-status-critical",
  arrears: "border-status-warning/50 bg-status-warning/10 text-status-warning",
  overdue: "border-status-warning/50 bg-status-warning/10 text-status-warning",
  revoked: "border-status-critical/50 bg-status-critical/10 text-status-critical",
  healthy: "border-status-healthy/50 bg-status-healthy/10 text-status-healthy",
  lagging: "border-status-warning/50 bg-status-warning/10 text-status-warning",
  silent: "border-status-critical/50 bg-status-critical/10 text-status-critical",
  // Reader orders (restiq-web#429).
  paid: "border-status-warning/50 bg-status-warning/10 text-status-warning",
  ordered: "border-status-pending/50 bg-status-pending/10 text-status-pending",
  shipped: "border-status-pending/50 bg-status-pending/10 text-status-pending",
  delivered: "border-status-healthy/50 bg-status-healthy/10 text-status-healthy",
  payment_failed: "border-status-critical/50 bg-status-critical/10 text-status-critical",
  cancelled: "border-border bg-accent text-muted-foreground",
  unknown: "border-border bg-accent text-muted-foreground",
};

export function StatusBadge({ status, testId }: Readonly<{ status: string; testId?: string }>) {
  const style = STYLES[status] ?? STYLES.unknown;
  return (
    <span
      data-testid={testId}
      className={`font-label inline-flex items-center rounded-[6px] border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${style}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
