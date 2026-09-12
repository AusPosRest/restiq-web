// Pure Devices & Printers logic (CAP-6), kept free of React so the countdown
// math and printer-assignment lookup are unit-testable without a DOM or
// simulated timers - mirrors floor-plan-state.ts's split between logic and UI.
//
// AdminDeviceView verified directly against restiq-backend's actual working
// tree (feature/36-tenant-devices: src/admin/devices/*, src/ops/devices/
// devices.service.ts's toDeviceView - not a summarized contract, same
// discipline as CAP-4/CAP-5/CAP-10). appVersion/lastContactAt come from the
// heartbeat snapshot (list items carry them since restiq-backend#136); they
// stay optional so an older backend still renders "-"/"Never".
import type { PrinterView, StationView } from "../floor-plan/floor-plan-state";

export interface AdminDeviceView {
  id: string;
  tenantId: string;
  label: string;
  type: string;
  role: string;
  status: string;
  appVersion?: string | null;
  lastContactAt?: string | null;
  enrolledAt: string;
  revokedAt: string | null;
  // Device topology (issue #210): the POS a printer/terminal is linked to.
  pairedPosId?: string | null;
}

// --- Device topology (issue #210). Web tabs heartbeat every 30 s
// (pos/device-heartbeat.tsx); three missed beats reads as offline.
export const ONLINE_WINDOW_MS = 90_000;
export type ConnectionState = "online" | "offline" | "never";

/** Online / offline / never from the last heartbeat. Pure - takes `now` explicitly. */
export function connectionState(lastContactAt: string | null | undefined, now: number): ConnectionState {
  if (!lastContactAt) return "never";
  return now - Date.parse(lastContactAt) < ONLINE_WINDOW_MS ? "online" : "offline";
}

export interface EnrolmentCodeResult {
  code: string;
  deviceType: DeviceType;
  expiresAt: string;
}

export const DEVICE_TYPE_OPTIONS = ["pos", "kds", "kiosk", "cds", "printer", "terminal"] as const;
export type DeviceType = (typeof DEVICE_TYPE_OPTIONS)[number];

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  pos: "POS (Point of Sale)",
  kds: "KDS (Kitchen Display)",
  kiosk: "Kiosk",
  cds: "Customer Display (CDS)",
  printer: "Receipt printer (simulated)",
  terminal: "Card terminal (simulated)",
};

// --- Enrolment code countdown. Mirrors Platform Console's code-chip.tsx
// exactly (same math) rather than importing it - the admin/ and ops/ route
// trees never import from each other (AD-4's boundary rule), and this
// component isn't factored into a shared location on the ops side either.

/** Whole seconds remaining until `expiresAt`, floored at 0. Pure - unit-tested. */
export function secondsRemaining(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Coarse relative time for a device's last-contact timestamp. Pure - takes `now` explicitly so it needs no mocked clock to test. */
export function formatLastSeen(iso: string | null | undefined, now: number): string {
  if (!iso) return "Never";
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// --- Printer assignment. This data model's "status" for a printer is
// assignment, not connectivity - Printer carries no telemetry field, so a
// fallback printer can only be edited through the one station that names
// this printer as its primary. Zero or multiple such stations means there's
// no single fallback slot to point the edit at.
export function stationForPrinter(printer: Pick<PrinterView, "id">, stations: readonly StationView[]): StationView | null {
  const matches = stations.filter((station) => station.primaryPrinterId === printer.id);
  return matches.length === 1 ? matches[0] : null;
}
