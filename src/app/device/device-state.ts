// Pure state/logic for the /device enrolment screen (issue #99) - a browser
// tab becomes a POS/KDS/kiosk/CDS terminal by redeeming a one-time code
// against the public, unauthenticated restiq-backend `POST /device/v1/enroll`
// (restiq-backend PR #91, read directly - src/device/enroll/*,
// src/ops/devices/devices.service.ts). Kept free of React so code-formatting
// and fingerprint/device storage are unit-testable without a DOM, mirroring
// pin-login-state.ts's pure/UI split and kds-station-storage.ts's try/catch
// convention.

// Mirrors restiq-backend's devices.service.ts CODE_ALPHABET exactly (no
// I/O/0/1 - unambiguous on a code read aloud or handwritten).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DISALLOWED_CHARS = new RegExp(`[^${CODE_ALPHABET}]`, "g");
const COMPLETE_CODE = new RegExp(`^[${CODE_ALPHABET}]{3}-[${CODE_ALPHABET}]{3}$`);

/** Uppercases, drops any character outside the code alphabet, and inserts the XXX-XXX dash as the user types. */
export function formatCodeInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(DISALLOWED_CHARS, "").slice(0, 6);
  return cleaned.length > 3 ? `${cleaned.slice(0, 3)}-${cleaned.slice(3)}` : cleaned;
}

export function isCodeComplete(code: string): boolean {
  return COMPLETE_CODE.test(code);
}

// Matches restiq-backend's DeviceView (src/ops/devices/devices.service.ts) -
// the exact shape POST /device/v1/enroll returns under `device`.
export interface DeviceView {
  id: string;
  tenantId: string;
  outletId: string | null;
  label: string;
  type: string;
  role: string;
  status: string;
  enrolledAt: string;
  revokedAt: string | null;
  /** Names the enrol response carries (walkthrough fix), so screens never show raw ids. Absent on devices enrolled before it. */
  tenantName?: string | null;
  outletName?: string | null;
}

const FINGERPRINT_KEY = "device:hardwareKeyFingerprint";
const DEVICE_KEY = "device:enrolled";

// Device identity is kept twice (restiq-web#343, CU-9):
//  - this TAB's own copy in sessionStorage, read first, so two tabs on one
//    machine can still be two devices (issue #104 - a POS tab beside a KDS tab);
//  - a lasting copy in localStorage, so a till stays a till after the tab is
//    closed, the browser restarts or the tablet reboots. A fresh tab with no
//    copy of its own picks this up - the last device enrolled in this browser.
// (The simulator gives each frame its own *.localhost origin since #339, so
// frames never share either store.) Un-enrolling clears both.
function stores(): Storage[] {
  const found: Storage[] = [];
  for (const get of [() => window.sessionStorage, () => window.localStorage]) {
    try {
      found.push(get());
    } catch {
      // Storage unavailable (private mode, disabled) - skip it.
    }
  }
  return found;
}

function readKey(key: string): string | null {
  for (const store of stores()) {
    try {
      const value = store.getItem(key);
      if (value) return value;
    } catch {
      // getItem can throw even when the store exists (security policy) - try the next one.
    }
  }
  return null;
}

function writeKey(key: string, value: string): void {
  for (const store of stores()) {
    try {
      store.setItem(key, value);
    } catch {
      // Best-effort - quota or policy; the other store may still hold it.
    }
  }
}

/**
 * This browser's hardware identity in the prototype - honest naming, not a
 * real device key. Generated once with crypto.randomUUID() and kept (see
 * above), so re-enrolling the same till (e.g. after a revoke) reuses it.
 */
export function getOrCreateFingerprint(): string {
  const existing = readKey(FINGERPRINT_KEY);
  if (existing) return existing;
  const generated = `web-${crypto.randomUUID()}`;
  writeKey(FINGERPRINT_KEY, generated);
  return generated;
}

export function readStoredDevice(): DeviceView | null {
  const raw = readKey(DEVICE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeviceView;
  } catch {
    return null;
  }
}

export function writeStoredDevice(device: DeviceView): void {
  // Best-effort - the tab still shows the enrolled state this session even if
  // the write fails, it just won't survive a reload.
  writeKey(DEVICE_KEY, JSON.stringify(device));
}

/** Clears this device's stored identity (tab and lasting copy). Server-side revocation stays an ops/admin job - see device-screen.tsx's un-enrol microcopy. */
export function clearStoredDevice(): void {
  for (const store of stores()) {
    try {
      store.removeItem(DEVICE_KEY);
    } catch {
      // Nothing to clear if storage never worked.
    }
  }
}

/** The kiosk attract screen for an enrolled kiosk device (issue #214). */
export function kioskAttractPath(outletId: string, deviceId: string): string {
  return `/qr/kiosk/${encodeURIComponent(outletId)}?device=${encodeURIComponent(deviceId)}`;
}

/** True when this browser tab is enrolled as a kiosk - the guest screens switch to kiosk mode (issue #214). */
export function isKioskTab(): boolean {
  return readStoredDevice()?.type === "kiosk";
}

export type ContinueTarget = { kind: "redirect"; path: string } | { kind: "unsupported" };

/**
 * Where "Continue" sends this device - pos/kds/printer/terminal have a web
 * surface today (kiosk/cds do not exist yet). The POS-realm screens (the
 * simulated printer #172 and card terminal #188 included) go through the PIN
 * pad with `?device=&tenant=` so it binds to this device's tenant (#150) -
 * the same links admin/(shell)/devices/devices-table.tsx builds (not imported
 * across route trees, AD-4).
 */
export function continueTargetFor(device: Pick<DeviceView, "id" | "tenantId" | "type" | "outletId" | "tenantName">): ContinueTarget {
  // The PIN pad also learns this device's outlet (no outlet chooser) and the restaurant's name.
  const params = new URLSearchParams({ device: device.id, tenant: device.tenantId });
  if (device.outletId) params.set("outlet", device.outletId);
  if (device.tenantName) params.set("name", device.tenantName);
  const login = `/pos/login?${params.toString()}`;
  if (device.type === "pos") return { kind: "redirect", path: login };
  // The kiosk (issue #214) is a guest-realm screen: no staff PIN, the enrolled device is the identity.
  if (device.type === "kiosk" && device.outletId) return { kind: "redirect", path: kioskAttractPath(device.outletId, device.id) };
  // A KDS signs in through the same PIN pad, bound to its restaurant - plain /kds had no tenant to sign in against.
  if (device.type === "kds") return { kind: "redirect", path: `${login}&next=${encodeURIComponent("/kds")}` };
  if (device.type === "printer") return { kind: "redirect", path: `${login}&next=${encodeURIComponent("/pos/printer")}` };
  if (device.type === "terminal") return { kind: "redirect", path: `${login}&next=${encodeURIComponent("/pos/terminal")}` };
  return { kind: "unsupported" };
}

const TYPE_LABELS: Record<string, string> = {
  pos: "POS terminal",
  kds: "Kitchen display",
  kiosk: "Kiosk",
  cds: "Customer display",
  printer: "Receipt printer",
  terminal: "Card terminal",
};

export function humanizeType(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

// Warmer owner-facing copy over the backend's raw active/revoked - same
// convention admin/(shell)/devices/devices-table.tsx uses (not imported
// across route trees, AD-4 - reimplemented here).
export function humanizeStatus(status: string): string {
  return status === "active" ? "Enrolled" : status === "revoked" ? "Revoked" : status;
}
