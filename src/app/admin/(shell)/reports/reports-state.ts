// Pure Reports Catalogue logic (CAP-9), kept free of React - mirrors
// dashboard-state.ts/staff-state.ts's split between logic and UI.
//
// Reconciled against the real restiq-backend working tree (feature/42-
// reports-catalogue, uncommitted at the time this was read - src/admin/
// reports/reports.controller.ts / reports.dtos.ts / reports.service.ts, read
// directly, not a summarized contract, same discipline as CAP-4/CAP-5/CAP-10).
// Notably: GET /admin/v1/reports returns a bare ReportDefinition[], not a
// `{ reports: [...] }` envelope; each entry uses `key` (not `id`) and has no
// separate `description` field - `message` doubles as the card's body copy
// for both real and pending entries (e.g. "Current categories, items, and
// prices from your live menu" vs "Available once POS Core Loop is live"),
// and category is a lowercase code (sales/financial/menu/operations/
// inventory/labour), not a display label. The export-destinations list is
// NOT static - it's a real (if trivial) GET /admin/v1/reports/export-
// destinations returning {key, name, status: 'not_connected'}. Exports are
// per-report GETs (.../reports/:key/export?format=csv) that return a raw
// text/csv body with a Content-Disposition filename, not a JSON envelope -
// see api.ts's exportReport for how that's read through the proxy route
// (admin/api/[...path]/route.ts was extended to pass non-JSON responses
// through rather than forcing them into upstream.json()).

export type ReportCategory = "sales" | "financial" | "menu" | "operations" | "inventory" | "labour";

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  sales: "Sales Performance",
  financial: "Financial & Compliance",
  menu: "Menu Engineering",
  operations: "Operations",
  inventory: "Inventory",
  labour: "Labour",
};

export const REPORT_CATEGORY_ORDER: readonly ReportCategory[] = ["sales", "financial", "menu", "operations", "inventory", "labour"];

export function categoryLabel(category: ReportCategory): string {
  return CATEGORY_LABELS[category];
}

export interface ReportDefinition {
  key: string;
  name: string;
  category: ReportCategory;
  /** false is an honest empty state (POS Core Loop not built yet) - never a fake/empty report body. */
  hasData: boolean;
  message: string;
  exportFormats: string[];
}

/** Groups reports by category, preserving REPORT_CATEGORY_ORDER and dropping categories with no reports. */
export function groupReportsByCategory(reports: readonly ReportDefinition[]): Array<{ category: ReportCategory; reports: ReportDefinition[] }> {
  return REPORT_CATEGORY_ORDER.map((category) => ({
    category,
    reports: reports.filter((report) => report.category === category),
  })).filter((group) => group.reports.length > 0);
}

export function categorySlug(category: ReportCategory): string {
  return category;
}

export type ExportDestinationStatus = "not_connected";

export interface ExportDestinationView {
  key: string;
  name: string;
  status: ExportDestinationStatus;
}

export interface ReportExport {
  filename: string;
  blob: Blob;
}

const CONTENT_DISPOSITION_FILENAME = /filename="?([^";]+)"?/i;

export function filenameFromContentDisposition(header: string | null): string | null {
  const match = header ? CONTENT_DISPOSITION_FILENAME.exec(header) : null;
  return match ? match[1]! : null;
}

/** Triggers a browser save of an already-fetched export blob - no anchor/URL wiring duplicated at each call site. */
export function downloadReportExport({ filename, blob }: ReportExport): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
