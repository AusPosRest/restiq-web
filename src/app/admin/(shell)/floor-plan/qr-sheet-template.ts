// QR sheet template (issue #175): per-outlet customisation of the printed/
// downloaded QR sheet's heading, instruction copy, which per-card fields
// show, and card size. Persisted the same way as
// src/app/kds/kds-station-storage.ts - plain localStorage keyed per outlet,
// try/catch throughout so a private-browsing/storage-disabled context just
// falls back to the outlet's defaults instead of crashing the floor plan.
export type QrSheetCardSize = "small" | "medium" | "large";

export interface QrSheetTemplate {
  heading: string;
  instruction: string;
  showTableLabel: boolean;
  showFloorName: boolean;
  showUrl: boolean;
  cardSize: QrSheetCardSize;
}

export const DEFAULT_QR_INSTRUCTION = "Scan to view the menu and order";

export const QR_SHEET_CARD_SIZES: readonly QrSheetCardSize[] = ["small", "medium", "large"];

/** Printed/HTML card QR size in mm, keyed by cardSize - "medium" matches the fixed 48mm the sheet used before templates existed. */
export const QR_CARD_SIZE_MM: Record<QrSheetCardSize, number> = { small: 36, medium: 48, large: 64 };

/** On-screen (print-preview) card QR size in px, keyed by cardSize - "medium" matches QR_SIZE_PX, the fixed size the sheet used before templates existed. */
export const QR_CARD_SIZE_PX: Record<QrSheetCardSize, number> = { small: 140, medium: 200, large: 260 };

export function defaultQrSheetTemplate(outletName: string): QrSheetTemplate {
  return {
    heading: outletName,
    instruction: DEFAULT_QR_INSTRUCTION,
    showTableLabel: true,
    showFloorName: true,
    showUrl: true,
    cardSize: "medium",
  };
}

const KEY_PREFIX = "qr-sheet-template:";

export function loadQrSheetTemplate(outletId: string, outletName: string): QrSheetTemplate {
  const fallback = defaultQrSheetTemplate(outletName);
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + outletId);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<QrSheetTemplate>) };
  } catch {
    return fallback;
  }
}

export function saveQrSheetTemplate(outletId: string, template: QrSheetTemplate): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + outletId, JSON.stringify(template));
  } catch {
    // Best-effort - the sheet still uses the chosen template for this session, just won't persist.
  }
}
