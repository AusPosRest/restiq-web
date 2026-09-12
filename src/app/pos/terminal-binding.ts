// Terminal-to-tenant binding for the shared POS PIN pad (issue #150): owners
// now enrol devices across several tenants, so a terminal can no longer
// assume "one deployment == one tenant" (POS_TENANT_ID's old posture - see
// auth/login/route.ts). Plain localStorage, no cookie/server round-trip -
// same per-device, no-live-signal posture as kds-station-storage.ts. Wrapped
// in try/catch throughout: private-browsing/storage-disabled contexts can
// throw on access, and losing the saved binding there should just fall back
// to POS_TENANT_ID, never crash the PIN pad.
const KEY = "pos:terminal-binding";

export interface TerminalBinding {
  tenantId: string;
  deviceId: string;
  tenantName?: string;
}

export function getTerminalBinding(): TerminalBinding | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TerminalBinding> | null;
    if (typeof parsed?.tenantId !== "string" || typeof parsed.deviceId !== "string") return null;
    return {
      tenantId: parsed.tenantId,
      deviceId: parsed.deviceId,
      ...(typeof parsed.tenantName === "string" ? { tenantName: parsed.tenantName } : {}),
    };
  } catch {
    return null;
  }
}

export function saveTerminalBinding(binding: TerminalBinding): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(binding));
  } catch {
    // Best-effort - the PIN pad still works for this session, just won't remember the binding.
  }
}

// Device topology (issue #210): which enrolled device *this tab* is. The
// binding above lives in localStorage, shared by every tab in the browser, so
// a printer tab signing in would re-point a POS tab at the printer. The tab's
// own id lives in sessionStorage and falls back to the shared binding.
const TAB_KEY = "pos:tab-device";

export function getTabDeviceId(): string | null {
  try {
    const own = window.sessionStorage.getItem(TAB_KEY);
    if (own) return own;
  } catch {
    // sessionStorage unavailable - fall back to the shared binding.
  }
  return getTerminalBinding()?.deviceId ?? null;
}

export function saveTabDeviceId(deviceId: string): void {
  try {
    window.sessionStorage.setItem(TAB_KEY, deviceId);
  } catch {
    // Best-effort - the tab falls back to the shared binding.
  }
}

export function clearTerminalBinding(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up if storage never worked in the first place.
  }
}
