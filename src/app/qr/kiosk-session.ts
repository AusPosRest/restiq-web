// Client-side kiosk session helpers (issue #214). A kiosk is a tab enrolled
// as a `kiosk` device (device-state.ts's sessionStorage record) - that is
// the only thing that puts the guest screens into kiosk mode.
import { isKioskTab, kioskAttractPath, readStoredDevice } from "../device/device-state";

export { isKioskTab };

/** Where this kiosk tab's attract screen lives, or null when the tab is not an enrolled kiosk with an outlet. */
export function kioskHomePath(): string | null {
  const device = readStoredDevice();
  if (!device || device.type !== "kiosk" || !device.outletId) return null;
  return kioskAttractPath(device.outletId, device.id);
}

/** Clears the guest session cookies (POST /qr/auth/kiosk/end) and returns where to go next. Never throws - a failed clear still returns home, the cookies idle out. */
export async function endKioskSession(): Promise<string> {
  await fetch("/qr/auth/kiosk/end", { method: "POST" }).catch(() => undefined);
  return kioskHomePath() ?? "/qr";
}
