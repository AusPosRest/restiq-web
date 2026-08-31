// Station-picker persistence (SPEC/EXPERIENCE.md: "the choice persists per
// browser - a wall display picks once"). Plain localStorage, no cookie/
// server round-trip - this is a per-device UI preference, not session state.
// Scoped per outlet (not a single global key) so a browser that somehow saw
// more than one outlet's picker (e.g. local dev against different tenants)
// never shows a stale station id from the wrong outlet's list. Wrapped in
// try/catch throughout: private-browsing/storage-disabled contexts can throw
// on access, and losing the saved choice there should just fall back to the
// picker, never crash the display.
const KEY_PREFIX = "kds:station:";

export function getSavedStationId(outletId: string): string | null {
  try {
    return window.localStorage.getItem(KEY_PREFIX + outletId);
  } catch {
    return null;
  }
}

export function saveStationId(outletId: string, stationId: string): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + outletId, stationId);
  } catch {
    // Best-effort - the picker still works for this session, just won't persist.
  }
}

export function clearSavedStationId(outletId: string): void {
  try {
    window.localStorage.removeItem(KEY_PREFIX + outletId);
  } catch {
    // Nothing to clean up if storage never worked in the first place.
  }
}
