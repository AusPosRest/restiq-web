// Pure Owner Dashboard logic (CAP-8), kept free of React - mirrors
// staff-state.ts/menu-state.ts's split between logic and UI.
//
// Reconciled against the real restiq-backend#41 response (GET
// /admin/v1/dashboard). Real shape differs from this story's first-pass
// self-authored contract in several ways: the tenant-wide counts live under
// `tenant`, not `counts`, with backend field names (outletCount, not
// `outlets`); there is no `stale` field on the wire at all - the backend
// computes `asOf` fresh on every request (no caching layer exists yet), so
// the freshness badge always renders the live, non-stale state client-side;
// and all four per-outlet financial metrics (sales, margin, labourCost,
// waste) share one flat shape - `{ amountMinor, currency, hasData, message }`
// - rather than a per-metric discriminated union. Notably margin is a real
// currency AMOUNT on the backend, not a percentage (no percentOfSales field
// either), so this story's original percent-based Margin/Labour rendering
// was wrong and has been corrected to match.

export interface DashboardTenant {
  outletCount: number;
  staffCount: number;
  menuItemCount: number;
  deviceCount: number;
}

/** Sales, margin, labourCost, and waste all share this shape on the wire - hasData:false is an honest empty state, never a fake zero. */
export interface FinancialMetric {
  amountMinor: number;
  currency: string;
  hasData: boolean;
  message: string;
}

export interface OutletKpis {
  outletId: string;
  outletName: string;
  sales: FinancialMetric;
  margin: FinancialMetric;
  labourCost: FinancialMetric;
  waste: FinancialMetric;
}

export interface DashboardView {
  /** ISO timestamp the snapshot was computed - EXPERIENCE.md's "as of [time]" badge. */
  asOf: string;
  tenant: DashboardTenant;
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
