// Pure Owner Dashboard logic (CAP-8), kept free of React - mirrors
// staff-state.ts/menu-state.ts's split between logic and UI.
//
// Contract status: restiq-backend's dashboard API (backend issue #40, CAP-8)
// has no branch or PR open as of this writing - only Platform Console's
// unrelated src/ops/dashboard.controller.ts exists on its dev. Unlike every
// other admin/* API in api.ts (each reconciled against real backend DTOs per
// their own file headers), this is a self-authored contract pending that
// reconciliation: GET /admin/v1/dashboard returns tenant-wide real counts
// plus per-outlet financial KPIs. Sales/margin/labour/waste have no real
// data source until POS Core Loop ships (issue #40's own acceptance
// criteria: "documents clearly what's stubbed"), so each is a discriminated
// union of unavailable | available rather than a bare number that could be
// mistaken for an honest zero.

export interface DashboardCounts {
  outlets: number;
  staff: number;
  menuItems: number;
  devices: number;
}

export type FinancialMetric = { status: "unavailable" } | { status: "available"; totalMinor: number; currency: string };
export type MarginMetric = { status: "unavailable" } | { status: "available"; percent: number };
export type LabourMetric = { status: "unavailable" } | { status: "available"; costMinor: number; currency: string; percentOfSales: number };
export type WasteMetric = { status: "unavailable" } | { status: "available"; costMinor: number; currency: string };

export interface OutletKpis {
  outletId: string;
  outletName: string;
  sales: FinancialMetric;
  margin: MarginMetric;
  labour: LabourMetric;
  waste: WasteMetric;
}

export interface DashboardView {
  /** ISO timestamp the snapshot was computed - EXPERIENCE.md's "as of [time]" badge. */
  asOf: string;
  /** True when the underlying sync is behind (SPEC CAP-8 success criterion: never present stale data as current). */
  stale: boolean;
  counts: DashboardCounts;
  outlets: OutletKpis[];
}

// Formats in UTC explicitly (rather than the host's local timezone) so the
// badge is deterministic in tests and in CI regardless of runner TZ.
export function formatAsOf(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const hours24 = then.getUTCHours();
  const period = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const time = `${hours12}:${then.getUTCMinutes().toString().padStart(2, "0")}${period}`;

  const sameDay = then.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  if (sameDay) return time;

  const month = then.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${then.getUTCDate()} ${month}, ${time}`;
}

export function formatPercent(percent: number): string {
  return `${percent.toFixed(1)}%`;
}
