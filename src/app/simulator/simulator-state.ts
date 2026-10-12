// Pure state/logic for /simulator (issue #294, rebuilt for restiq-web#346).
// Each simulated device opens in its own browser window (window.open), on
// its own sim-<id>.localhost origin. A top-level window on its own origin
// keeps its own storage and its own SameSite=lax session cookies, so a POS
// till, KDS and owner console really are separate devices with separate
// logins. (The old iframe canvas could not sign in: browsers drop lax
// cookies set inside a cross-site frame - PE-26 / CU-25.)
// Kept free of React so it is unit-testable without a DOM.

export interface DevicePreset {
  key: string;
  label: string;
  path: string;
  width: number;
  height: number;
}

// Label -> path, window size. Each device preset is a fresh device (issue
// #339), so it opens /device to enter the enrolment code for that device
// type; /device then routes to the till, KDS, kiosk, printer or terminal
// screen itself.
export const PRESETS: readonly DevicePreset[] = [
  { key: "owner-console", label: "Owner console", path: "/admin/login", width: 1280, height: 800 },
  { key: "pos-till", label: "POS till", path: "/device", width: 1024, height: 768 },
  { key: "kds", label: "KDS", path: "/device", width: 1280, height: 720 },
  { key: "kiosk", label: "Kiosk", path: "/device", width: 768, height: 1024 },
  { key: "receipt-printer", label: "Receipt printer", path: "/device", width: 360, height: 640 },
  { key: "card-terminal", label: "Card terminal", path: "/device", width: 360, height: 640 },
  {
    key: "guest-qr",
    label: "Guest QR",
    // /qr/t/{outletId}/{tableId}; the outlet needs qr_ordering enabled.
    // Point this at a real table with NEXT_PUBLIC_SIMULATOR_GUEST_QR_PATH.
    path:
      process.env.NEXT_PUBLIC_SIMULATOR_GUEST_QR_PATH ||
      "/qr/t/01a042f2-8e56-733d-ad2e-739163950988/22222222-2222-7222-8222-222222220001",
    width: 390,
    height: 844,
  },
  { key: "mail-inbox", label: "Mail inbox", path: "/ops/inbox", width: 1024, height: 768 },
  { key: "platform-console", label: "Platform console", path: "/ops/login", width: 1280, height: 800 },
];

export const CUSTOM_DEVICE_SIZE = { width: 480, height: 640 };

export interface SimDevice {
  id: string;
  label: string;
  path: string;
  width: number;
  height: number;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `dev${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function createDevice(preset: Pick<DevicePreset, "label" | "path" | "width" | "height">): SimDevice {
  return { id: generateId(), label: preset.label, path: preset.path, width: preset.width, height: preset.height };
}

/** "POS till", "POS till 2", ... - repeats are numbered so the list tells them apart. */
export function nextLabel(devices: readonly SimDevice[], base: string): string {
  const taken = new Set(devices.map((device) => device.label));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/** Same-origin path only, so the custom box can't open an arbitrary site. */
export function validateCustomPath(input: string): { ok: true; path: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter a path." };
  const normalized = trimmed.replace(/\\/g, "/");
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return { ok: false, error: 'Must be a same-origin path starting with "/" (not a full URL).' };
  }
  return { ok: true, path: trimmed };
}

/** True for hostnames the browser resolves to loopback (localhost, 127.0.0.1, *.localhost). */
export function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

/**
 * Each *.localhost host is its own origin, so every device window gets its
 * own storage and cookies - its own device and login - while browsers still
 * resolve *.localhost to loopback, with no DNS or hosts-file setup. Hosted
 * deployments can't mint subdomains on demand, so there the windows stay
 * same-origin (path unchanged) and share one login.
 */
export function deviceUrl(path: string, deviceId: string, location: { protocol: string; hostname: string; port: string }): string {
  if (!isLocalHostname(location.hostname)) return path;
  const sanitized = deviceId.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, "");
  const label = sanitized ? `sim-${sanitized}` : "sim-device";
  const port = location.port ? `:${location.port}` : "";
  return `${location.protocol}//${label}.localhost${port}${path}`;
}

/** The window name: re-opening a device reuses its window instead of stacking a new one. */
export function windowName(deviceId: string): string {
  return `restiq-sim-${deviceId.replace(/[^a-z0-9-]/gi, "")}`;
}

/** window.open features for a device of this size. */
export function windowFeatures(device: Pick<SimDevice, "width" | "height">): string {
  return `popup,width=${Math.round(device.width)},height=${Math.round(device.height)}`;
}

const STORAGE_KEY = "restiq:simulator:v2";

function isDevice(value: unknown): value is SimDevice {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.id === "string" &&
    typeof d.label === "string" &&
    typeof d.path === "string" &&
    typeof d.width === "number" &&
    typeof d.height === "number"
  );
}

export function loadDevices(): SimDevice[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isDevice) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDevices(devices: readonly SimDevice[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch {
    // Best-effort - the list still works for this session, it just won't persist.
  }
}
