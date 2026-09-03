// Pure Payments report logic (issue #137, web half of "payments history"),
// kept free of React so date-boundary math and row formatting are
// unit-testable without a DOM - mirrors reports-state.ts's split between
// logic and UI (CAP-9) and devices-state.ts's per-outlet story shape.
//
// Contract: GET /admin/v1/reports/payments (restiq-backend#104, landing in
// parallel with this story) - see api.ts#fetchPayments's header for the full
// wire shape this was built against. Money carries no per-row currency field
// (same gap CAP-4's menu prices had before a tenant-currency source
// existed) - payments.tsx follows the admin surface's existing convention
// (menu-management.tsx, dashboard's outlet-kpi-tiles.tsx) of a local INR
// constant plus menu-state.ts's formatPriceMinor, not a new formatter.

export interface PaymentTender {
  method: string;
  amountMinor: number;
  createdAt: string;
}

export interface PaymentCreditNote {
  id: string;
  amountMinor: number;
  reason: string;
  createdAt: string;
}

export interface PaymentTaxBreakdownEntry {
  label: string;
  ratePercent: number;
  amountMinor: number;
}

export type PaymentSource = "pos" | "qr";

export interface PaymentRow {
  billId: string;
  billNumber: number;
  finalizedAt: string;
  outletId: string;
  outletName: string;
  orderId: string;
  source: PaymentSource;
  tableLabel: string | null;
  tokenNumber: number | null;
  cashierName: string | null;
  subtotalMinor: number;
  discountMinor: number | null;
  discountReason: string | null;
  taxMinor: number;
  /** May be absent per the contract - a bill priced before per-line tax tracking existed. */
  taxBreakdown?: PaymentTaxBreakdownEntry[];
  totalMinor: number;
  tenders: PaymentTender[];
  creditNotes: PaymentCreditNote[];
}

export interface PaymentsTotals {
  count: number;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  tenderedMinor: number;
  refundedMinor: number;
}

export interface PaymentsResponse {
  items: PaymentRow[];
  nextCursor: string | null;
  totals: PaymentsTotals;
}

export const PAYMENTS_PAGE_SIZE = 50;

// --- Outlet-local date range. This project carries no date/timezone library
// (checked package.json) - offsets are read from Intl directly rather than
// adding a dependency for one filter's default. Restaurant outlet timezones
// change offset rarely enough (a handful of IANA zones, most with no DST)
// that recomputing the offset near the target instant instead of tracking
// transitions precisely is an acceptable simplification here.

function offsetMinutesAt(instant: Date, timeZone: string): number {
  // Floored to whole seconds first: formatToParts's "second" field rounds a
  // sub-second remainder (observed: :59.999 read back as the next minute),
  // which would otherwise throw the computed offset off by a full minute
  // right at a day's 23:59:59.999 boundary - exactly where outletDateEndIso
  // calls this. IANA zone offsets are always a whole number of minutes, so
  // rounding the result is also safe, not just a tidy-up.
  const flooredMs = Math.floor(instant.getTime() / 1000) * 1000;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(flooredMs));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - flooredMs) / 60_000);
}

/** The outlet-local calendar date ("YYYY-MM-DD") that `instant` falls on. */
export function outletLocalDate(instant: Date, timeZone: string): string {
  const offset = offsetMinutesAt(instant, timeZone);
  const local = new Date(instant.getTime() + offset * 60_000);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateParts(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split("-").map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
}

/** Converts an outlet-local calendar date's start-of-day (00:00:00.000) to a UTC ISO instant. */
export function outletDateStartIso(dateStr: string, timeZone: string): string {
  const [y, m, d] = parseDateParts(dateStr);
  const approx = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const offset = offsetMinutesAt(approx, timeZone);
  return new Date(approx.getTime() - offset * 60_000).toISOString();
}

/** Converts an outlet-local calendar date's end-of-day (23:59:59.999) to a UTC ISO instant. */
export function outletDateEndIso(dateStr: string, timeZone: string): string {
  const [y, m, d] = parseDateParts(dateStr);
  const approx = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  const offset = offsetMinutesAt(approx, timeZone);
  return new Date(approx.getTime() - offset * 60_000).toISOString();
}

export interface DateRangeQuery {
  fromDate: string;
  toDate: string;
}

/** Today, outlet-local, as both ends of the default filter range. */
export function defaultDateRange(now: Date, timeZone: string): DateRangeQuery {
  const today = outletLocalDate(now, timeZone);
  return { fromDate: today, toDate: today };
}

/** The filter's local calendar dates as the ISO instants the API's from/to expect. */
export function toIsoRange(range: DateRangeQuery, timeZone: string): { from: string; to: string } {
  return { from: outletDateStartIso(range.fromDate, timeZone), to: outletDateEndIso(range.toDate, timeZone) };
}

// --- Row display helpers.

export function tableOrTokenLabel(row: Pick<PaymentRow, "tableLabel" | "tokenNumber">): string {
  if (row.tableLabel) return row.tableLabel;
  if (row.tokenNumber != null) return `Token #${row.tokenNumber}`;
  return "—";
}

export function sourceLabel(source: PaymentSource): string {
  return source === "qr" ? "QR" : "POS";
}

export interface TaxLine {
  label: string;
  amountMinor: number;
}

/** Per-bill tax display: the real breakdown when the backend sent one, else one unlabelled line off `taxMinor` (the contract's `taxBreakdown?` "may be absent"). */
export function taxLines(row: Pick<PaymentRow, "taxBreakdown" | "taxMinor">): TaxLine[] {
  if (row.taxBreakdown && row.taxBreakdown.length > 0) {
    return row.taxBreakdown.map((line) => ({ label: `${line.label} (${line.ratePercent}%)`, amountMinor: line.amountMinor }));
  }
  return [{ label: "", amountMinor: row.taxMinor }];
}

export function refundedMinorFor(row: Pick<PaymentRow, "creditNotes">): number {
  return row.creditNotes.reduce((sum, note) => sum + note.amountMinor, 0);
}

export function formatBillTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone, hour: "2-digit", minute: "2-digit" });
}

/** Appends a "load more" page onto what's already loaded - totals describe the whole filtered range on every page (not just what's loaded so far), so the latest response's totals replace the running ones rather than being summed. */
export function appendPaymentsPage(current: PaymentsResponse, page: PaymentsResponse): PaymentsResponse {
  return { items: [...current.items, ...page.items], nextCursor: page.nextCursor, totals: page.totals };
}
