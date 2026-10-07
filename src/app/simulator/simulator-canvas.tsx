"use client";

// The /simulator canvas UI (issue #294). World coordinates with a
// {x,y,scale} camera applied via CSS transform on one world div - pan/drag
// math mirrors floor-plan-canvas.tsx's pointer-capture convention, just at
// the canvas level instead of per-shape.
import { useEffect, useRef, useState } from "react";
import {
  addFrame,
  clearFrames,
  createDefaultLayout,
  CUSTOM_FRAME_SIZE,
  fitAll,
  loadLayout,
  moveFrame,
  panCamera,
  PRESETS,
  removeFrame,
  resizeFrame,
  saveLayout,
  setCamera,
  validateCustomPath,
  zoomAt,
  type Frame,
  type FramePreset,
  type SimulatorLayout,
} from "./simulator-state";

function viewportSizeOf(el: HTMLDivElement | null): { width: number; height: number } {
  const rect = el?.getBoundingClientRect();
  return rect ? { width: rect.width, height: rect.height } : { width: window.innerWidth, height: window.innerHeight };
}

export function SimulatorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<SimulatorLayout>(createDefaultLayout());
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [reloadTokens, setReloadTokens] = useState<Record<string, number>>({});

  // Deferred load, not the initial useState, so server-render and first
  // client hydration agree on the same empty shell (device-screen.tsx's
  // convention) - and gated by `loaded` so the save effect below never
  // overwrites a real stored layout with the default before it's read.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLayout(loadLayout());
      setLoaded(true);
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveLayout(layout);
  }, [layout, loaded]);

  function addPreset(preset: Pick<FramePreset, "label" | "path" | "width" | "height">) {
    const viewport = viewportSizeOf(containerRef.current);
    setLayout((current) => addFrame(current, preset, viewport));
    setMenuOpen(false);
  }

  function handleCustomUrlSubmit() {
    const result = validateCustomPath(customUrl);
    if (!result.ok) {
      setCustomError(result.error);
      return;
    }
    addPreset({ label: "Custom", path: result.path, ...CUSTOM_FRAME_SIZE });
    setCustomUrl("");
    setCustomError(null);
  }

  function handleFit() {
    const viewport = viewportSizeOf(containerRef.current);
    setLayout((current) => setCamera(current, fitAll(current.frames, viewport)));
  }

  function handleClear() {
    setLayout((current) => clearFrames(current));
  }

  function handleZoomBy(factor: number) {
    const viewport = viewportSizeOf(containerRef.current);
    setLayout((current) => setCamera(current, zoomAt(current.camera, viewport.width / 2, viewport.height / 2, current.camera.scale * factor)));
  }

  function handleZoomReset() {
    const viewport = viewportSizeOf(containerRef.current);
    setLayout((current) => setCamera(current, zoomAt(current.camera, viewport.width / 2, viewport.height / 2, 1)));
  }

  // --- background pan (drag empty canvas, plain wheel/trackpad scroll) ---
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; origin: { x: number; y: number } } | null>(null);

  function handleBackgroundPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { x: layout.camera.x, y: layout.camera.y } };
    setInteracting(true);
  }

  function handleBackgroundPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const x = pan.origin.x + (event.clientX - pan.startX);
    const y = pan.origin.y + (event.clientY - pan.startY);
    setLayout((current) => setCamera(current, { ...current.camera, x, y }));
  }

  function handleBackgroundPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
    setInteracting(false);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey) {
      const screenX = (rect ? event.clientX - rect.left : event.clientX);
      const screenY = (rect ? event.clientY - rect.top : event.clientY);
      const factor = Math.exp(-event.deltaY * 0.01);
      setLayout((current) => setCamera(current, zoomAt(current.camera, screenX, screenY, current.camera.scale * factor)));
      return;
    }
    setLayout((current) => setCamera(current, panCamera(current.camera, -event.deltaX, -event.deltaY)));
  }

  // --- per-frame drag (title bar) and resize (bottom-right handle) ---
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; origin: { x: number; y: number } } | null>(null);
  const resizeRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; origin: { width: number; height: number } } | null>(null);

  function handleFrameDragStart(event: React.PointerEvent<HTMLDivElement>, frame: Frame) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: frame.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { x: frame.x, y: frame.y } };
    setInteracting(true);
  }

  function handleFrameDragMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const scale = layout.camera.scale;
    const x = drag.origin.x + (event.clientX - drag.startX) / scale;
    const y = drag.origin.y + (event.clientY - drag.startY) / scale;
    setLayout((current) => moveFrame(current, drag.id, x, y));
  }

  function handleFrameDragEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    setInteracting(false);
  }

  function handleResizeStart(event: React.PointerEvent<HTMLDivElement>, frame: Frame) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      id: frame.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { width: frame.width, height: frame.height },
    };
    setInteracting(true);
  }

  function handleResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const scale = layout.camera.scale;
    const width = resize.origin.width + (event.clientX - resize.startX) / scale;
    const height = resize.origin.height + (event.clientY - resize.startY) / scale;
    setLayout((current) => resizeFrame(current, resize.id, width, height));
  }

  function handleResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
    setInteracting(false);
  }

  function handleRemove(id: string) {
    setLayout((current) => removeFrame(current, id));
  }

  function handleReload(id: string) {
    setReloadTokens((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  }

  const zoomPercent = Math.round(layout.camera.scale * 100);

  return (
    <div className="ops-theme flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2" data-testid="simulator-toolbar">
        <div className="relative">
          <button
            type="button"
            data-testid="simulator-add-menu"
            aria-label="Add device"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Add device
          </button>
          {menuOpen ? (
            <div
              data-testid="simulator-add-panel"
              className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-popover p-2 shadow-lg"
            >
              <ul className="flex flex-col gap-0.5">
                {PRESETS.map((preset) => (
                  <li key={preset.key}>
                    <button
                      type="button"
                      data-testid={`simulator-add-${preset.key}`}
                      aria-label={`Add ${preset.label}`}
                      onClick={() => addPreset(preset)}
                      className="w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {preset.label}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {preset.width}×{preset.height}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 border-t border-border pt-2">
                <label htmlFor="simulator-custom-url" className="block text-xs font-medium text-muted-foreground">
                  Custom URL (same-origin path)
                </label>
                <div className="mt-1 flex gap-1">
                  <input
                    id="simulator-custom-url"
                    data-testid="simulator-custom-url"
                    type="text"
                    placeholder="/pos/login"
                    value={customUrl}
                    onChange={(event) => {
                      setCustomUrl(event.target.value);
                      setCustomError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleCustomUrlSubmit();
                    }}
                    className="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    data-testid="simulator-custom-url-add"
                    aria-label="Add custom URL device"
                    onClick={handleCustomUrlSubmit}
                    className="rounded bg-secondary px-2 py-1 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Add
                  </button>
                </div>
                {customError ? (
                  <p role="alert" data-testid="simulator-custom-url-error" className="mt-1 text-xs text-error-soft">
                    {customError}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="simulator-zoom-out"
            aria-label="Zoom out"
            onClick={() => handleZoomBy(0.8)}
            className="size-8 rounded-md border border-border text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            −
          </button>
          <button
            type="button"
            data-testid="simulator-zoom-reset"
            aria-label="Reset zoom to 100%"
            onClick={handleZoomReset}
            className="min-w-14 rounded-md border border-border px-2 py-1 text-sm text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {zoomPercent}%
          </button>
          <button
            type="button"
            data-testid="simulator-zoom-in"
            aria-label="Zoom in"
            onClick={() => handleZoomBy(1.25)}
            className="size-8 rounded-md border border-border text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            +
          </button>
        </div>

        <button
          type="button"
          data-testid="simulator-fit"
          aria-label="Fit all devices"
          onClick={handleFit}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Fit all
        </button>
        <button
          type="button"
          data-testid="simulator-clear"
          aria-label="Clear all devices"
          onClick={handleClear}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Clear all
        </button>

        <p className="ml-auto text-xs text-muted-foreground">
          Drag background to pan · Ctrl/⌘+scroll or pinch to zoom · scroll to pan
        </p>
      </header>

      <div
        ref={containerRef}
        data-testid="simulator-canvas"
        className="relative flex-1 touch-none overflow-hidden bg-background"
        style={{
          backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: `${24 * layout.camera.scale}px ${24 * layout.camera.scale}px`,
          backgroundPosition: `${layout.camera.x}px ${layout.camera.y}px`,
        }}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handleBackgroundPointerMove}
        onPointerUp={handleBackgroundPointerUp}
        onWheel={handleWheel}
      >
        {layout.frames.length === 0 ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Add a device to begin
          </p>
        ) : null}

        <div
          className="absolute left-0 top-0"
          style={{ transform: `translate(${layout.camera.x}px, ${layout.camera.y}px) scale(${layout.camera.scale})`, transformOrigin: "0 0" }}
        >
          {layout.frames.map((frame) => (
            <div
              key={frame.id}
              data-testid={`simulator-frame-${frame.id}`}
              className="absolute overflow-hidden rounded-lg border border-border bg-card shadow-lg"
              style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
            >
              <div
                data-testid={`simulator-frame-titlebar-${frame.id}`}
                onPointerDown={(event) => handleFrameDragStart(event, frame)}
                onPointerMove={handleFrameDragMove}
                onPointerUp={handleFrameDragEnd}
                className="flex cursor-grab items-center gap-2 border-b border-border bg-muted px-2 py-1 text-xs text-foreground active:cursor-grabbing"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{frame.label}</span>
                <span className="shrink-0 text-muted-foreground">
                  {Math.round(frame.width)}×{Math.round(frame.height)}
                </span>
                <button
                  type="button"
                  data-testid={`simulator-frame-reload-${frame.id}`}
                  aria-label={`Reload ${frame.label}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => handleReload(frame.id)}
                  className="shrink-0 rounded px-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ⟳
                </button>
                <button
                  type="button"
                  data-testid={`simulator-frame-remove-${frame.id}`}
                  aria-label={`Remove ${frame.label}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => handleRemove(frame.id)}
                  className="shrink-0 rounded px-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ✕
                </button>
              </div>

              <iframe
                key={`${frame.id}:${reloadTokens[frame.id] ?? 0}`}
                src={frame.path}
                title={frame.label}
                className={interacting ? "pointer-events-none" : undefined}
                style={{ width: "100%", height: `calc(100% - 28px)`, border: "none" }}
              />

              <div
                data-testid={`simulator-frame-resize-${frame.id}`}
                aria-hidden="true"
                onPointerDown={(event) => handleResizeStart(event, frame)}
                onPointerMove={handleResizeMove}
                onPointerUp={handleResizeEnd}
                className="absolute bottom-0 right-0 size-4 cursor-nwse-resize"
                style={{ background: "linear-gradient(135deg, transparent 50%, var(--border) 50%)" }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
