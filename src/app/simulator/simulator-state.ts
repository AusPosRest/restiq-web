// Pure state/logic for the /simulator infinite canvas (issue #294): a tester
// drops many real RESTIQ screens (each its own iframe / browsing context, so
// sessionStorage-scoped device identity - see device/device-state.ts - stays
// independent per frame) onto one pannable, zoomable canvas. Kept free of
// React, same pure/UI split as floor-plan-state.ts, so the camera and layout
// math is unit-testable without a DOM.

export interface FramePreset {
  key: string;
  label: string;
  path: string;
  width: number;
  height: number;
}

// Label -> path, default frame size (SPEC: issue #294). Guest QR/owner/
// platform entries reuse the exact routes the landing page (page.tsx)
// already links to, not reimplemented.
export const PRESETS: readonly FramePreset[] = [
  { key: "device-enrol", label: "Device enrol", path: "/device", width: 390, height: 844 },
  { key: "pos-till", label: "POS till", path: "/pos/login", width: 1024, height: 768 },
  { key: "kds", label: "KDS", path: "/kds", width: 1280, height: 720 },
  { key: "kiosk", label: "Kiosk", path: "/pos/login", width: 768, height: 1024 },
  { key: "receipt-printer", label: "Receipt printer", path: "/pos/login?next=%2Fpos%2Fprinter", width: 360, height: 640 },
  { key: "card-terminal", label: "Card terminal", path: "/pos/login?next=%2Fpos%2Fterminal", width: 360, height: 640 },
  {
    key: "guest-qr",
    label: "Guest QR",
    path: "/qr/t/01a042f2-8e56-733d-ad2e-739163950988/22222222-2222-7222-8222-222222220001",
    width: 390,
    height: 844,
  },
  { key: "owner-console", label: "Owner console", path: "/admin/login", width: 1280, height: 800 },
  { key: "platform-console", label: "Platform console", path: "/ops/login", width: 1280, height: 800 },
  // #318: emails the mail simulator kept (needs restiq-backend MAIL_PROVIDER=simulator).
  { key: "mail-inbox", label: "Mail inbox", path: "/simulator/inbox", width: 480, height: 800 },
];

export const CUSTOM_FRAME_SIZE = { width: 480, height: 640 };

export interface Frame {
  id: string;
  label: string;
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface SimulatorLayout {
  frames: Frame[];
  camera: Camera;
}

export const MIN_FRAME_WIDTH = 240;
export const MIN_FRAME_HEIGHT = 320;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 2;

export function createDefaultLayout(): SimulatorLayout {
  return { frames: [], camera: { x: 0, y: 0, scale: 1 } };
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Fallback for environments without crypto.randomUUID (very old browsers).
  return `frame-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** New frames land at the centre of the current view, offset a little per existing frame so repeats don't stack exactly. */
export function addFrame(
  layout: SimulatorLayout,
  preset: Pick<FramePreset, "label" | "path" | "width" | "height">,
  viewport: { width: number; height: number },
): SimulatorLayout {
  const { camera, frames } = layout;
  // Empty canvas: centre in view. Otherwise sit to the right of the rightmost frame, top-aligned with the first.
  const GAP = 40;
  const last = frames.reduce((a, f) => (f.x + f.width > a.x + a.width ? f : a), frames[0]);
  const x = last ? last.x + last.width + GAP : (viewport.width / 2 - camera.x) / camera.scale - preset.width / 2;
  const y = last ? frames[0].y : (viewport.height / 2 - camera.y) / camera.scale - preset.height / 2;
  const frame: Frame = {
    id: generateId(),
    label: preset.label,
    path: preset.path,
    width: preset.width,
    height: preset.height,
    x,
    y,
  };
  return { ...layout, frames: [...frames, frame] };
}

export function removeFrame(layout: SimulatorLayout, id: string): SimulatorLayout {
  return { ...layout, frames: layout.frames.filter((frame) => frame.id !== id) };
}

export function moveFrame(layout: SimulatorLayout, id: string, x: number, y: number): SimulatorLayout {
  return { ...layout, frames: layout.frames.map((frame) => (frame.id === id ? { ...frame, x, y } : frame)) };
}

export function resizeFrame(layout: SimulatorLayout, id: string, width: number, height: number): SimulatorLayout {
  const clampedWidth = Math.max(MIN_FRAME_WIDTH, width);
  const clampedHeight = Math.max(MIN_FRAME_HEIGHT, height);
  return {
    ...layout,
    frames: layout.frames.map((frame) => (frame.id === id ? { ...frame, width: clampedWidth, height: clampedHeight } : frame)),
  };
}

export function clearFrames(layout: SimulatorLayout): SimulatorLayout {
  return { ...layout, frames: [] };
}

export function setCamera(layout: SimulatorLayout, camera: Camera): SimulatorLayout {
  return { ...layout, camera };
}

/** Zooms to nextScale (clamped) while keeping the world point under (screenX, screenY) fixed on screen. */
export function zoomAt(camera: Camera, screenX: number, screenY: number, nextScale: number): Camera {
  const scale = clampScale(nextScale);
  const worldX = (screenX - camera.x) / camera.scale;
  const worldY = (screenY - camera.y) / camera.scale;
  return { x: screenX - worldX * scale, y: screenY - worldY * scale, scale };
}

export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

/** Camera that fits every frame's bounding box into the viewport with padding. Empty layout -> the default camera. */
export function fitAll(frames: readonly Frame[], viewport: { width: number; height: number }, padding = 48): Camera {
  if (frames.length === 0) return { x: 0, y: 0, scale: 1 };
  const minX = Math.min(...frames.map((frame) => frame.x));
  const minY = Math.min(...frames.map((frame) => frame.y));
  const maxX = Math.max(...frames.map((frame) => frame.x + frame.width));
  const maxY = Math.max(...frames.map((frame) => frame.y + frame.height));
  const boundsWidth = maxX - minX;
  const boundsHeight = maxY - minY;
  const scale = clampScale(Math.min((viewport.width - padding * 2) / boundsWidth, (viewport.height - padding * 2) / boundsHeight));
  const centerX = minX + boundsWidth / 2;
  const centerY = minY + boundsHeight / 2;
  return { x: viewport.width / 2 - centerX * scale, y: viewport.height / 2 - centerY * scale, scale };
}

/** Same-origin path only, so the custom-URL box can't be used to embed a cross-origin page in the canvas. */
export function validateCustomPath(input: string): { ok: true; path: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter a path." };
  const normalized = trimmed.replace(/\\/g, "/");
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return { ok: false, error: 'Must be a same-origin path starting with "/" (not a full URL).' };
  }
  return { ok: true, path: trimmed };
}

const STORAGE_KEY = "restiq:simulator:v1";

function isFrame(value: unknown): value is Frame {
  if (typeof value !== "object" || value === null) return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.id === "string" &&
    typeof f.label === "string" &&
    typeof f.path === "string" &&
    typeof f.x === "number" &&
    typeof f.y === "number" &&
    typeof f.width === "number" &&
    typeof f.height === "number"
  );
}

function isCamera(value: unknown): value is Camera {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return typeof c.x === "number" && typeof c.y === "number" && typeof c.scale === "number";
}

function isLayout(value: unknown): value is SimulatorLayout {
  if (typeof value !== "object" || value === null) return false;
  const l = value as Record<string, unknown>;
  return Array.isArray(l.frames) && l.frames.every(isFrame) && isCamera(l.camera);
}

export function loadLayout(): SimulatorLayout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultLayout();
    const parsed = JSON.parse(raw);
    return isLayout(parsed) ? parsed : createDefaultLayout();
  } catch {
    return createDefaultLayout();
  }
}

export function saveLayout(layout: SimulatorLayout): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Best-effort - the canvas still works for this session, just won't persist.
  }
}
