// DESIGN.md's OfflineIndicatorPill - the connectivity counterpart to
// PrinterStatusChip, same mocked-data honesty pattern (EXPERIENCE.md: "always
// rendered with a small '(demo)' affordance ... honestly marking that this
// prototype has no real ... connectivity signal behind it").
import { Wifi, WifiOff } from "lucide-react";
import type { ConnectivityStatus } from "../../api";

const LABEL: Record<ConnectivityStatus, string> = { online: "Online", offline: "Offline" };
const CLASS: Record<ConnectivityStatus, string> = {
  online: "bg-accent text-status-available",
  offline: "bg-accent text-status-alert",
};

export function OfflineIndicatorPill({ status }: Readonly<{ status: ConnectivityStatus }>) {
  const Icon = status === "online" ? Wifi : WifiOff;
  return (
    <span
      data-testid="pos-connectivity-status-pill"
      title="Mocked - no real connectivity signal in this prototype (demo)"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${CLASS[status]}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {LABEL[status]}
      <span className="text-muted-foreground">(demo)</span>
    </span>
  );
}
