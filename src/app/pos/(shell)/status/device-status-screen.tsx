"use client";

// P13 Device Status & Attendance (SPEC CAP-11). Read-only: a real attendance
// list (today's CAP-1 clock events) plus a device status panel that is
// always mocked and always visibly marked as such (DESIGN.md's
// PrinterStatusChip/OfflineIndicatorPill, "(demo)" in the DOM, not just a
// tooltip). Five-state pattern per EXPERIENCE.md, same as shift-screen.tsx:
// skeleton while loading, inline retry on failure, content once landed.
import { usePosLoad } from "../../use-pos-load";
import type { AttendanceView } from "../../api";
import { LoadErrorPanel, Skeleton } from "./data-states";
import { AttendanceList } from "./attendance-list";
import { PrinterStatusChip } from "./printer-status-chip";
import { OfflineIndicatorPill } from "./offline-indicator-pill";

export function DeviceStatusScreen({ outletId }: Readonly<{ outletId: string }>) {
  const { loading, failed, data, retry } = usePosLoad<AttendanceView>(`outlets/${outletId}/attendance/today`);

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-6">
        <h1 className="font-headline text-lg font-semibold">Device &amp; staff status</h1>
      </header>

      {loading && (
        <div data-testid="device-status-loading" className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      )}

      {!loading && failed && <LoadErrorPanel testId="device-status-load-error" message="The device and attendance status couldn't be loaded." onRetry={retry} />}

      {!loading && !failed && data && (
        <div data-testid="device-status-content" className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 font-headline text-base font-semibold">Device status</h2>
            <div data-testid="pos-device-status-demo-notice" className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-card px-5 py-4">
              <PrinterStatusChip status={data.device.printer} />
              <OfflineIndicatorPill status={data.device.connectivity} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-headline text-base font-semibold">Attendance today</h2>
            <AttendanceList staff={data.staff} />
          </section>
        </div>
      )}
    </div>
  );
}
