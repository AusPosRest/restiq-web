// P13's attendance panel: real CAP-1 clock-in events for today, name +
// clock-in time (SPEC CAP-11 success: "no fabricated staff or times").
// Mirrors cash-movement-log.tsx's shape - a plain read-only list, empty state
// included, no fake rows when no one has clocked in yet.
//
// RECONCILED (2026-09-02, restiq-web#98): the real `attendance.service.ts`
// (read directly) only ever lists staff *currently* clocked in - there is no
// clock-out entry to show, so there's nothing left to render but the
// clock-in time.
import type { AttendanceEntry } from "../../api";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AttendanceList({ staff }: Readonly<{ staff: AttendanceEntry[] }>) {
  if (staff.length === 0) {
    return (
      <p data-testid="attendance-empty" className="rounded-lg border border-dashed border-border/60 bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
        No one has clocked in at this outlet today.
      </p>
    );
  }

  return (
    <ul data-testid="attendance-list" className="flex flex-col divide-y divide-border/40 rounded-lg border border-border/40 bg-card">
      {staff.map((entry) => (
        <li key={entry.staffId} data-testid={`attendance-row-${entry.staffId}`} className="flex items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm font-medium">{entry.name}</p>
          <div className="shrink-0 text-right">
            <p className="tabular-nums text-sm">{formatTime(entry.clockedInAt)}</p>
            <p className="text-xs text-muted-foreground">Clocked in</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
