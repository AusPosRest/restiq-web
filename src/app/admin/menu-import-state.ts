// Pure Menu Import review logic (CAP-3), kept free of React so it's testable
// on its own - mirrors checklist-state.ts's split between logic and UI.
// Shapes match restiq-backend's actual DTOs (src/admin/menu-import/*.dtos.ts,
// *.controller.ts) as of this story - not the task's originally sketched
// contract, which this reconciles: confidence is per-field (not one score
// per row), price is `priceMinor` + a `currency` code (not a plain number),
// there's a `shortName` (kitchen ticket name) field, and there is no `tags`
// field anywhere in the backend's draft model.

export interface DraftFieldConfidence {
  name: number;
  shortName: number;
  category: number;
  price: number;
  overall: number;
}

export interface MenuImportItem {
  id: string;
  name: string;
  shortName: string;
  category: string;
  priceMinor: number;
  currency: string;
  confidence: DraftFieldConfidence;
}

export type MenuImportSourceType = "csv" | "xlsx" | "image" | "pdf";

export interface MenuImportDraft {
  importId: string;
  status: "draft" | "committed";
  sourceType: MenuImportSourceType;
  fileName: string;
  items: MenuImportItem[];
}

export type MenuImportEditableField = "name" | "shortName" | "category" | "priceMinor";

export type ConfidenceLevel = "high" | "medium" | "low";

const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return "high";
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

/** Extensions the backend's resolveSourceType accepts - anything else 400s. */
const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".jpg", ".jpeg", ".png", ".pdf"];

export const MENU_IMPORT_ACCEPT = ACCEPTED_EXTENSIONS.join(",");

export function isAcceptedMenuFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function priceMinorToMajorString(priceMinor: number): string {
  return (priceMinor / 100).toFixed(2);
}

/** Null on anything that isn't a valid non-negative amount - caller should ignore the edit. */
export function majorStringToPriceMinor(value: string): number | null {
  const major = Number.parseFloat(value);
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * 100);
}

export function reviewedCount(reviewed: ReadonlySet<string>, items: readonly MenuImportItem[]): number {
  return items.filter((item) => reviewed.has(item.id)).length;
}

/** Commit stays locked until every drafted item has been looked at - "at least reviewed". */
export function canCommit(reviewed: ReadonlySet<string>, items: readonly MenuImportItem[]): boolean {
  return items.length > 0 && items.every((item) => reviewed.has(item.id));
}
