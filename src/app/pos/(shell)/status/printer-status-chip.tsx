// DESIGN.md's PrinterStatusChip - one of the two components explicitly
// rendered against mocked data in this prototype (no real printer). The
// "(demo)" label is in the DOM, not just a tooltip, per EXPERIENCE.md's
// honesty pattern and this story's own requirement that the placeholder be
// visible, not merely hinted at.
import { Printer, PrinterX } from "lucide-react";
import type { PrinterStatus } from "../../api";

const LABEL: Record<PrinterStatus, string> = { connected: "Connected", disconnected: "Disconnected" };
const CLASS: Record<PrinterStatus, string> = {
  connected: "bg-accent text-status-available",
  disconnected: "bg-accent text-status-alert",
};

export function PrinterStatusChip({ status }: Readonly<{ status: PrinterStatus }>) {
  const Icon = status === "connected" ? Printer : PrinterX;
  return (
    <span
      data-testid="pos-printer-status-chip"
      title="Mocked - no real printer connected in this prototype (demo)"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${CLASS[status]}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {LABEL[status]}
      <span className="text-muted-foreground">(demo)</span>
    </span>
  );
}
