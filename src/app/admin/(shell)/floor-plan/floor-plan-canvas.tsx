"use client";

// T5 Floor Plan canvas (CAP-5, EXPERIENCE.md: "canvas with draggable table
// shapes; snapping prevents accidental overlap"). Absolutely-positioned divs
// rather than SVG - the shapes are simple rects/circles with a text label,
// no path drawing needed, so plain positioned elements are the minimum that
// works (ponytail). Pointer drag AND arrow-key nudging both funnel through
// the same computeDragPosition math (floor-plan-state.ts) so keyboard users
// get identical snapping/clamping behaviour, not a second implementation.
//
// Floor selection itself (the tabs) lives one level up in floor-plan.tsx's
// FloorTabsBar (issue #109) so rename/delete controls sit next to the same
// tabs the list view also needs to see - this component only ever renders
// the selected floor's tables.
import { useRef, useState } from "react";
import { computeDragPosition, findOverlap, GRID_SNAP_PX, type DiningTableView } from "./floor-plan-state";

export const CANVAS_WIDTH = 640;
export const CANVAS_HEIGHT = 420;

export interface FloorPlanCanvasProps {
  tables: readonly DiningTableView[];
  selectedFloorId: string;
  onTableMoved: (tableId: string, next: { x: number; y: number }, previous: { x: number; y: number }) => void;
}

interface DragOrigin {
  pointerX: number;
  pointerY: number;
  tableX: number;
  tableY: number;
}

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [0, -GRID_SNAP_PX],
  ArrowDown: [0, GRID_SNAP_PX],
  ArrowLeft: [-GRID_SNAP_PX, 0],
  ArrowRight: [GRID_SNAP_PX, 0],
};

export function FloorPlanCanvas({ tables, selectedFloorId, onTableMoved }: Readonly<FloorPlanCanvasProps>) {
  const floorTables = tables.filter((table) => table.floorId === selectedFloorId);
  const dragRef = useRef<{ tableId: string; origin: DragOrigin } | null>(null);
  const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number }>>({});

  function positionOf(table: DiningTableView): { x: number; y: number } {
    return livePositions[table.id] ?? { x: table.x, y: table.y };
  }

  function commit(table: DiningTableView, next: { x: number; y: number }) {
    setLivePositions((current) => {
      if (!(table.id in current)) return current;
      const rest = { ...current };
      delete rest[table.id];
      return rest;
    });
    if (next.x === table.x && next.y === table.y) return;
    onTableMoved(table.id, next, { x: table.x, y: table.y });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>, table: DiningTableView) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = positionOf(table);
    dragRef.current = { tableId: table.id, origin: { pointerX: event.clientX, pointerY: event.clientY, tableX: current.x, tableY: current.y } };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>, table: DiningTableView) {
    const drag = dragRef.current;
    if (!drag || drag.tableId !== table.id) return;
    const next = computeDragPosition(
      drag.origin,
      event.clientX,
      event.clientY,
      { width: table.width, height: table.height },
      { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    );
    setLivePositions((current) => ({ ...current, [table.id]: next }));
  }

  function handlePointerUp(table: DiningTableView) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.tableId !== table.id) return;
    commit(table, livePositions[table.id] ?? positionOf(table));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>, table: DiningTableView) {
    const delta = ARROW_DELTAS[event.key];
    if (!delta) return;
    event.preventDefault();
    const current = positionOf(table);
    const next = {
      x: Math.min(Math.max(current.x + delta[0], 0), CANVAS_WIDTH - table.width),
      y: Math.min(Math.max(current.y + delta[1], 0), CANVAS_HEIGHT - table.height),
    };
    commit(table, next);
  }

  return (
    <div
      data-testid="floor-plan-canvas"
      className="relative overflow-hidden rounded-lg border border-border bg-card"
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
    >
      {floorTables.map((table) => {
        const position = positionOf(table);
        const dragging = livePositions[table.id] !== undefined;
        const overlapping =
          dragging &&
          findOverlap(
            { id: table.id, x: position.x, y: position.y, width: table.width, height: table.height },
            floorTables.map((other) => ({ id: other.id, x: positionOf(other).x, y: positionOf(other).y, width: other.width, height: other.height })),
          ) !== null;
        return (
          <div
            key={table.id}
            tabIndex={0}
            role="button"
            aria-label={`${table.label}, seats ${table.seatCapacity}. Drag or use arrow keys to move.`}
            data-testid={`table-shape-${table.id}`}
            data-x={position.x}
            data-y={position.y}
            onPointerDown={(event) => handlePointerDown(event, table)}
            onPointerMove={(event) => handlePointerMove(event, table)}
            onPointerUp={() => handlePointerUp(table)}
            onKeyDown={(event) => handleKeyDown(event, table)}
            className={`absolute flex cursor-grab select-none items-center justify-center border text-xs font-semibold text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing ${
              table.shape === "circle" ? "rounded-full" : "rounded-md"
            } ${overlapping ? "border-status-error bg-status-error/20" : "border-primary/60 bg-primary/15"}`}
            style={{ left: position.x, top: position.y, width: table.width, height: table.height }}
          >
            {table.label}
          </div>
        );
      })}
    </div>
  );
}
