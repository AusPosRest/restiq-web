"use client";

// T5 Floor Plan canvas (CAP-5, EXPERIENCE.md: "canvas with draggable table
// shapes; snapping prevents accidental overlap"). Absolutely-positioned divs
// rather than SVG - the shapes are simple rects/circles with a text label,
// no path drawing needed, so plain positioned elements are the minimum that
// works (ponytail).
//
// Infinite per floor (issue #237): a native scroll viewport over a surface
// that always reaches EDGE_ROOM past the farthest table, so dragging a table
// outward grows the surface and there is always more room. It only grows
// right/down - the backend rejects negative x/y (@Min(0)). Zoom is a CSS
// scale on the table layer; pointer maths runs in canvas units (toCanvas)
// so a drag stays under the cursor at any zoom, even while the view scrolls.
// Pan is the browser's own scroll (wheel, trackpad, touch) plus mouse-drag
// on empty space. Zoom and scroll position are remembered per floor.
//
// Floor selection itself (the tabs) lives one level up in floor-plan.tsx's
// FloorTabsBar (issue #109) so rename/delete controls sit next to the same
// tabs the list view also needs to see - this component only ever renders
// the selected floor's tables.
import { Maximize2, QrCode, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { canvasExtent, computeDragPosition, findOverlap, GRID_SNAP_PX, type DiningTableView, type DragOrigin } from "./floor-plan-state";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 1.25;
const EDGE_ROOM = 480;
const EDGE_SCROLL_PX = 32;

const ZOOM_BUTTON_CLASS =
  "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

export interface FloorPlanCanvasProps {
  tables: readonly DiningTableView[];
  selectedFloorId: string;
  onTableMoved: (tableId: string, next: { x: number; y: number }, previous: { x: number; y: number }) => void;
  onQrRequested: (tableId: string) => void;
}

interface Point {
  x: number;
  y: number;
}

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [0, -GRID_SNAP_PX],
  ArrowDown: [0, GRID_SNAP_PX],
  ArrowLeft: [-GRID_SNAP_PX, 0],
  ArrowRight: [GRID_SNAP_PX, 0],
};

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function FloorPlanCanvas({ tables, selectedFloorId, onTableMoved, onQrRequested }: Readonly<FloorPlanCanvasProps>) {
  const floorTables = tables.filter((table) => table.floorId === selectedFloorId);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ tableId: string; origin: DragOrigin } | null>(null);
  const panRef = useRef<{ clientX: number; clientY: number; left: number; top: number } | null>(null);
  const scrollByFloor = useRef<Record<string, { left: number; top: number }>>({});
  const zoomAnchor = useRef<{ canvasX: number; canvasY: number; offsetX: number; offsetY: number } | null>(null);
  const [zoomByFloor, setZoomByFloor] = useState<Record<string, number>>({});
  const [livePositions, setLivePositions] = useState<Record<string, Point>>({});
  const zoom = zoomByFloor[selectedFloorId] ?? 1;

  // Switching floors restores where that floor was last scrolled to.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const saved = scrollByFloor.current[selectedFloorId];
    viewport.scrollLeft = saved?.left ?? 0;
    viewport.scrollTop = saved?.top ?? 0;
  }, [selectedFloorId]);

  // After a zoom, scroll so the canvas point that was under the cursor (or
  // the view's centre, for the buttons) is still under it.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const anchor = zoomAnchor.current;
    zoomAnchor.current = null;
    if (!viewport || !anchor) return;
    viewport.scrollLeft = anchor.canvasX * zoom - anchor.offsetX;
    viewport.scrollTop = anchor.canvasY * zoom - anchor.offsetY;
  }, [zoom]);

  // Ctrl/⌘ + wheel zooms (trackpad pinch arrives as ctrl + wheel too); a
  // plain wheel is left to scroll natively. Attached by hand because React's
  // onWheel is passive and can't stop the browser zooming the whole page.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomTo(zoom * Math.exp(-event.deltaY / 400), event);
    }
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  });

  function toCanvas(clientX: number, clientY: number): Point {
    const viewport = viewportRef.current;
    if (!viewport) return { x: clientX / zoom, y: clientY / zoom };
    const rect = viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewport.clientLeft + viewport.scrollLeft) / zoom,
      y: (clientY - rect.top - viewport.clientTop + viewport.scrollTop) / zoom,
    };
  }

  function setZoom(next: number) {
    setZoomByFloor((current) => ({ ...current, [selectedFloorId]: next }));
  }

  function zoomTo(next: number, cursor?: { clientX: number; clientY: number }) {
    const viewport = viewportRef.current;
    const clamped = clampZoom(next);
    if (!viewport || clamped === zoom) return;
    const rect = viewport.getBoundingClientRect();
    const offsetX = cursor ? cursor.clientX - rect.left - viewport.clientLeft : viewport.clientWidth / 2;
    const offsetY = cursor ? cursor.clientY - rect.top - viewport.clientTop : viewport.clientHeight / 2;
    zoomAnchor.current = { canvasX: (viewport.scrollLeft + offsetX) / zoom, canvasY: (viewport.scrollTop + offsetY) / zoom, offsetX, offsetY };
    setZoom(clamped);
  }

  // Fit measures from the origin: nothing on the canvas ever sits above or left of (0, 0).
  function fitToTables() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = canvasExtent(floorTables, GRID_SNAP_PX * 3);
    setZoom(floorTables.length === 0 ? 1 : clampZoom(Math.min(viewport.clientWidth / bounds.width, viewport.clientHeight / bounds.height)));
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  }

  // Dragging a table against the viewport's edge scrolls it along, so a
  // table can be carried past what's on screen.
  // ponytail: scrolls only while the pointer moves; add a rAF loop if holding still at the edge should keep going.
  function scrollNearEdge(clientX: number, clientY: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (clientX > rect.right - EDGE_SCROLL_PX) viewport.scrollLeft += EDGE_SCROLL_PX / 2;
    else if (clientX < rect.left + EDGE_SCROLL_PX) viewport.scrollLeft -= EDGE_SCROLL_PX / 2;
    if (clientY > rect.bottom - EDGE_SCROLL_PX) viewport.scrollTop += EDGE_SCROLL_PX / 2;
    else if (clientY < rect.top + EDGE_SCROLL_PX) viewport.scrollTop -= EDGE_SCROLL_PX / 2;
  }

  function positionOf(table: DiningTableView): Point {
    return livePositions[table.id] ?? { x: table.x, y: table.y };
  }

  function commit(table: DiningTableView, next: Point) {
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
    event.stopPropagation(); // a table drag, not a pan of the surface behind it
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = positionOf(table);
    const pointer = toCanvas(event.clientX, event.clientY);
    dragRef.current = { tableId: table.id, origin: { pointerX: pointer.x, pointerY: pointer.y, tableX: current.x, tableY: current.y } };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>, table: DiningTableView) {
    const drag = dragRef.current;
    if (!drag || drag.tableId !== table.id) return;
    scrollNearEdge(event.clientX, event.clientY);
    const pointer = toCanvas(event.clientX, event.clientY);
    setLivePositions((current) => ({ ...current, [table.id]: computeDragPosition(drag.origin, pointer.x, pointer.y) }));
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
    commit(table, { x: Math.max(0, current.x + delta[0]), y: Math.max(0, current.y + delta[1]) });
  }

  // Mouse only: touch and pen already pan by scrolling the viewport natively.
  function handleSurfacePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport || event.pointerType !== "mouse" || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { clientX: event.clientX, clientY: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
  }

  function handleSurfacePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const viewport = viewportRef.current;
    if (!pan || !viewport) return;
    viewport.scrollLeft = pan.left - (event.clientX - pan.clientX);
    viewport.scrollTop = pan.top - (event.clientY - pan.clientY);
  }

  const extent = canvasExtent(
    floorTables.map((table) => ({ ...table, ...positionOf(table) })),
    EDGE_ROOM,
  );
  const dotSpacing = GRID_SNAP_PX * 3 * zoom;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Drag empty space or scroll to move around. Ctrl/⌘ + scroll to zoom.</p>
        <div role="group" aria-label="Canvas zoom" data-testid="floor-plan-zoom-controls" className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
          <button type="button" aria-label="Zoom out" data-testid="floor-plan-zoom-out" disabled={zoom <= MIN_ZOOM} onClick={() => zoomTo(zoom / ZOOM_STEP)} className={ZOOM_BUTTON_CLASS}>
            <ZoomOut className="size-3.5" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Reset zoom to 100%" data-testid="floor-plan-zoom-reset" onClick={() => zoomTo(1)} className={`${ZOOM_BUTTON_CLASS} w-12 tabular-nums`}>
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" aria-label="Zoom in" data-testid="floor-plan-zoom-in" disabled={zoom >= MAX_ZOOM} onClick={() => zoomTo(zoom * ZOOM_STEP)} className={ZOOM_BUTTON_CLASS}>
            <ZoomIn className="size-3.5" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Fit all tables in view" data-testid="floor-plan-zoom-fit" onClick={fitToTables} className={ZOOM_BUTTON_CLASS}>
            <Maximize2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        data-testid="floor-plan-canvas"
        onScroll={(event) => {
          scrollByFloor.current[selectedFloorId] = { left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
        }}
        className="h-[70vh] min-h-[420px] overflow-auto overscroll-contain rounded-lg border border-border bg-card"
      >
        <div
          data-testid="floor-plan-canvas-surface"
          onPointerDown={handleSurfacePointerDown}
          onPointerMove={handleSurfacePointerMove}
          onPointerUp={() => (panRef.current = null)}
          className="relative cursor-grab active:cursor-grabbing"
          style={{
            width: extent.width * zoom,
            height: extent.height * zoom,
            minWidth: "100%",
            minHeight: "100%",
            backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
            backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
          }}
        >
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${zoom})` }}>
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
                  // touch-none: a finger on a table drags the table rather than scrolling the canvas.
                  className={`absolute flex cursor-grab touch-none select-none items-center justify-center border text-xs font-semibold text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing ${
                    table.shape === "circle" ? "rounded-full" : "rounded-md"
                  } ${overlapping ? "border-status-error bg-status-error/20" : "border-primary/60 bg-primary/15"}`}
                  style={{ left: position.x, top: position.y, width: table.width, height: table.height }}
                >
                  <span className="flex flex-col items-center leading-tight">
                    {table.label}
                    <span data-testid={`table-seats-${table.id}`} className="text-[10px] font-normal text-muted-foreground">
                      {table.seatCapacity} seats
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Show QR for ${table.label}`}
                    data-testid={`table-shape-qr-${table.id}`}
                    // stopPropagation on pointer-down, not just click: the tile's
                    // own onPointerDown starts a drag on the same event, and it
                    // fires before click ever would.
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onQrRequested(table.id);
                    }}
                    className="absolute right-0 top-0 z-10 cursor-pointer rounded-bl-md rounded-tr-md bg-card/90 p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <QrCode className="size-3" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
