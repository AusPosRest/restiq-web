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
}

const FINGERPRINT_KEY = "device:hardwareKeyFingerprint";
const DEVICE_KEY = "device:enrolled";

/**
 * This browser's hardware identity in the prototype - honest naming, not a
 * real device key. Generated once with crypto.randomUUID() and persisted, so
 * re-enrolling the same browser (e.g. after a revoke) reuses the same value.
 */
export function getOrCreateFingerprint(): string {
  try {
    const existing = window.localStorage.getItem(FINGERPRINT_KEY);
    if (existing) return existing;
    const generated = `web-${crypto.randomUUID()}`;
    window.localStorage.setItem(FINGERPRINT_KEY, generated);
    return generated;
  } catch {
    // Storage unavailable (private browsing, disabled) - enrolment still
    // works, it just won't be stable across a reload.
    return `web-${crypto.randomUUID()}`;
  }
}

export function readStoredDevice(): DeviceView | null {
  try {
    const raw = window.localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeviceView;
  } catch {
    return null;
  }
}

export function writeStoredDevice(device: DeviceView): void {
  try {
    window.localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
  } catch {
    // Best-effort - the tab still shows the enrolled state this session, it
    // just won't survive a reload.
  }
}

/** Clears only this browser's stored identity. Server-side revocation stays an ops/admin job - see device-screen.tsx's un-enrol microcopy. */
export function clearStoredDevice(): void {
  try {
    window.localStorage.removeItem(DEVICE_KEY);
  } catch {
    // Nothing to clean up if storage never worked in the first place.
  }
}

export type ContinueTarget = { kind: "redirect"; path: string } | { kind: "unsupported" };

/** Where "Continue" sends this device type - only pos/kds have a web surface today (kiosk/cds do not exist yet). */
export function continueTargetFor(type: string): ContinueTarget {
  if (type === "pos") return { kind: "redirect", path: "/pos/login" };
  if (type === "kds") return { kind: "redirect", path: "/kds" };
  return { kind: "unsupported" };
}

const TYPE_LABELS: Record<string, string> = {
  pos: "POS terminal",
  kds: "Kitchen display",
  kiosk: "Kiosk",
  cds: "Customer display",
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
