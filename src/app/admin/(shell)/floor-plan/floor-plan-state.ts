// Pure Floor Plan & Stations logic (CAP-5), kept free of React so the drag
// math and validation are unit-testable without a DOM drag simulation -
// mirrors menu-state.ts's split between logic and UI.
//
// Types mirror restiq-backend's actual admin/v1/outlets/:outletId/floor-plan
// DTOs (src/admin/floor-plan/floor-plan.dtos.ts on feature/34-floor-plan,
// read directly from its working tree - not a summarized contract, same
// discipline as CAP-4/CAP-10). Three backend facts shape this file and
// api.ts together:
//  - Overlap policy (the SPEC's stated open question) is REJECT with 409
//    (code `table_overlap`), not auto-adjust - floor-plan.service.ts's own
//    comment: a silently-relocated table is a worse surprise mid-edit than
//    an immediate "that spot is taken." So a table move either lands exactly
//    where dropped or doesn't move at all - there is no server-adjusted
//    position case to reconcile.
//  - A table's position is an absolute (x, y, width, height) rect in grid
//    units the editor owns - the backend does no unit conversion, so the
//    same rect math this file uses for the client-side overlap preview
//    (immediate visual feedback while dragging) is exactly what the server
//    checks (bounding-box intersection, strict inequality - shared edges
//    don't collide).
//  - A station's "no printer" state is just primaryPrinterId = null; the
//    "explicit acknowledgement" the SPEC requires is a one-time request flag
//    (noPrinterAcknowledged), not a persisted column - the backend's own
//    comment: "never silently save an unset printer."

export type TableShape = "circle" | "square" | "rectangle";

export interface FloorView {
  id: string;
  name: string;
  sortOrder: number;
}

export interface DiningTableView {
  id: string;
  floorId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: TableShape;
  seatCapacity: number;
}

export interface FloorPlanView {
  floors: FloorView[];
  tables: DiningTableView[];
  stations: StationView[];
  printers: PrinterView[];
}

export type PrinterRenderMode = "text" | "bitmap";

export interface PrinterView {
  id: string;
  name: string;
  renderMode: PrinterRenderMode;
}

export interface StationView {
  id: string;
  name: string;
  ageingThresholdMinutes: number;
  primaryPrinterId: string | null;
  fallbackPrinterId: string | null;
}

// --- Drag-to-position math. The canvas only ever calls this with plain
// numbers (pointer + table start coordinates), so it needs no DOM/event
// fixtures to test - a real pointerdown/pointermove sequence would only be
// exercising jsdom's event plumbing, not this logic.

export const GRID_SNAP_PX = 8;

export function snapToGrid(value: number, grid: number = GRID_SNAP_PX): number {
  return Math.round(value / grid) * grid;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface DragOrigin {
  pointerX: number;
  pointerY: number;
  tableX: number;
  tableY: number;
}

export interface CanvasBounds {
  width: number;
  height: number;
}

/** Translates the drag origin by the pointer's movement, snaps to the grid, and clamps inside the canvas - the same rect a mouse, a touch, or a keyboard nudge all funnel through. */
export function computeDragPosition(
  origin: DragOrigin,
  pointerX: number,
  pointerY: number,
  tableSize: { width: number; height: number },
  canvas: CanvasBounds,
): { x: number; y: number } {
  const rawX = origin.tableX + (pointerX - origin.pointerX);
  const rawY = origin.tableY + (pointerY - origin.pointerY);
  const maxX = Math.max(0, canvas.width - tableSize.width);
  const maxY = Math.max(0, canvas.height - tableSize.height);
  return { x: clamp(snapToGrid(rawX), 0, maxX), y: clamp(snapToGrid(rawY), 0, maxY) };
}

// --- Overlap preview. A client-side rect check purely for immediate visual
// feedback while dragging (EXPERIENCE.md: "snapping prevents accidental
// overlap") - the backend remains the source of truth for whether a save
// actually succeeds, since only it can serialize concurrent edits.

export interface TableRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectsOverlap(a: TableRect, b: TableRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** The id of the first other table that a candidate rect overlaps, or null if it's clear. */
export function findOverlap(candidate: TableRect, others: readonly TableRect[]): string | null {
  return others.find((other) => other.id !== candidate.id && rectsOverlap(candidate, other))?.id ?? null;
}

// --- Add-table defaults. SHAPE_SIZES gives the add-table form a
// fixed footprint per shape so it only has to ask "what shape", not raw
// width/height. computeNextTablePosition scans the same grid the canvas
// snaps to for the first spot clear of every existing table on the floor,
// reusing rectsOverlap rather than a second overlap check - if the floor is
// fully packed it falls back to (0, 0) and lets the server's own overlap
// check (floor-plan.service.ts's boundsOverlap) reject it like any other
// spot, since only the server can serialize concurrent edits.

export const SHAPE_SIZES: Record<TableShape, { width: number; height: number }> = {
  square: { width: 40, height: 40 },
  circle: { width: 40, height: 40 },
  rectangle: { width: 64, height: 40 },
};

export function computeNextTablePosition(
  existing: readonly TableRect[],
  size: { width: number; height: number },
  canvas: CanvasBounds,
): { x: number; y: number } {
  for (let y = 0; y + size.height <= canvas.height; y += GRID_SNAP_PX) {
    for (let x = 0; x + size.width <= canvas.width; x += GRID_SNAP_PX) {
      const candidate: TableRect = { id: "", x, y, width: size.width, height: size.height };
      if (!existing.some((other) => rectsOverlap(candidate, other))) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

// --- Station printer-requirement validation. Mirrors the backend's own
// rule (see file header): a station must carry a primary printer, or the
// caller must explicitly acknowledge it has none - the UI enforces this
// before the request goes out so the checkbox reads as a real gate, not
// decoration the server ignores anyway.

export interface StationPrinterInput {
  primaryPrinterId: string | null;
  noPrinterAcknowledged: boolean;
}

export interface StationPrinterErrors {
  printer?: string;
}

export function validateStationPrinter(input: StationPrinterInput): StationPrinterErrors {
  if (!input.primaryPrinterId && !input.noPrinterAcknowledged) {
    return { printer: "Choose a printer for this station, or confirm it has none." };
  }
  return {};
}

export function stationPrinterIsValid(input: StationPrinterInput): boolean {
  return Object.keys(validateStationPrinter(input)).length === 0;
}

export function validateAgeingThresholdMinutes(value: number): string | undefined {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) return "Enter a whole number of minutes, at least 1.";
  return undefined;
}

// --- List-view fallback (EXPERIENCE.md accessibility floor: "Floor-plan
// canvas provides a list-view alternative for non-pointer interaction"). Same
// data as the canvas, grouped by floor for a plain table.

export interface FloorGroup {
  floor: FloorView;
  tables: DiningTableView[];
}

export function groupTablesByFloor(floors: readonly FloorView[], tables: readonly DiningTableView[]): FloorGroup[] {
  return floors.map((floor) => ({ floor, tables: tables.filter((table) => table.floorId === floor.id) }));
}
