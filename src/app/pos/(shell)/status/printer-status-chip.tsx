// DESIGN.md's PrinterStatusChip - one of the two components explicitly
// rendered against mocked data in this prototype (no real printer). The
// "(demo)" label is in the DOM, not just a tooltip, per EXPERIENCE.md's
// honesty pattern and this story's own requirement that the placeholder be
// visible, not merely hinted at.
//
// RECONCILED (2026-09-02, restiq-web#98): the real `attendance.dtos.ts`'s
// `MockedPrinterStatus` (read directly) is a true literal type - "connected"
// is the only value the backend can ever send (SPEC.md: "no real ESC/POS
// printer ... integration") - so the old "disconnected" branch was dead code
// this client itself could never actually receive; dropped along with the
// now-unused `PrinterX` icon import.
import { Printer } from "lucide-react";
import type { PrinterStatus } from "../../api";

const LABEL: Record<PrinterStatus, string> = { connected: "Connected" };

export function PrinterStatusChip({ status }: Readonly<{ status: PrinterStatus }>) {
  return (
    <span
      data-testid="pos-printer-status-chip"
      title="Mocked - no real printer connected in this prototype (demo)"
      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-status-available"
    >
      <Printer className="size-3.5" aria-hidden="true" />
      {LABEL[status]}
      <span className="text-muted-foreground">(demo)</span>
    </span>
  );
}
