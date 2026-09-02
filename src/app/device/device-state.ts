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

// Device identity lives in sessionStorage, NOT localStorage, so it is scoped
// to ONE browser TAB rather than shared across the whole origin (issue #104).
// That is the "one page = one device" model: open two tabs and each enrols
// independently - a POS tab and a KDS tab can run side by side on the same
// machine. sessionStorage survives reloads within the tab (fine for an
// always-open kiosk screen) and clears when the tab closes - closing the tab
// unplugs that device, re-enrol with a fresh code to bring it back.
function tabStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    // Storage unavailable (private mode, disabled) - callers fall back.
    return null;
  }
}

/**
 * This tab's hardware identity in the prototype - honest naming, not a real
 * device key. Generated once per tab with crypto.randomUUID() and persisted
 * for the tab's lifetime, so re-enrolling within the same tab (e.g. after a
 * revoke) reuses the same value.
 */
export function getOrCreateFingerprint(): string {
  const generated = `web-${crypto.randomUUID()}`;
  const store = tabStore();
  if (!store) return generated;
  try {
    const existing = store.getItem(FINGERPRINT_KEY);
    if (existing) return existing;
    store.setItem(FINGERPRINT_KEY, generated);
    return generated;
  } catch {
    // getItem/setItem can throw even when the store object exists (quota,
    // security policy) - enrolment still works, just not stable across reload.
    return generated;
  }
}

export function readStoredDevice(): DeviceView | null {
  const store = tabStore();
  if (!store) return null;
  try {
    const raw = store.getItem(DEVICE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeviceView;
  } catch {
    return null;
  }
}

export function writeStoredDevice(device: DeviceView): void {
  // Best-effort - the tab still shows the enrolled state this session even if
  // the write fails, it just won't survive a reload.
  tabStore()?.setItem(DEVICE_KEY, JSON.stringify(device));
}

/** Clears only this tab's stored identity. Server-side revocation stays an ops/admin job - see device-screen.tsx's un-enrol microcopy. */
export function clearStoredDevice(): void {
  tabStore()?.removeItem(DEVICE_KEY);
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
