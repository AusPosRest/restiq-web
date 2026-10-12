"use client";

// P13 Device Status & Attendance (SPEC CAP-11). Read-only: a real attendance
// list (today's CAP-1 clock events) plus this browser's real connectivity
// (restiq-web#343, PE-19: no mocked "(demo)" chips in a production till -
// printers and terminals report in on the owner's Devices page). Five-state
// pattern per EXPERIENCE.md: skeleton while loading, inline retry on failure,
// content once landed. Route: `outlets/:outletId/attendance` (see
// `../../api.ts`'s `AttendanceView` header).
import { usePosLoad } from "../../use-pos-load";
import type { AttendanceView } from "../../api";
import { LoadErrorPanel, Skeleton } from "./data-states";
import { AttendanceList } from "./attendance-list";
import { OfflineIndicatorPill } from "./offline-indicator-pill";

export function DeviceStatusScreen({ outletId }: Readonly<{ outletId: string }>) {
  const { loading, failed, data, retry } = usePosLoad<AttendanceView>(`outlets/${outletId}/attendance`);

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
            {/* PE-19: only real signals - this browser's connectivity. Printers and terminals report in on the owner's Devices page. */}
            <div data-testid="pos-device-status-panel" className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-card px-5 py-4">
              <OfflineIndicatorPill />
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
