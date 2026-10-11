// restiq-web#343 (PE-16/CU-13): which counter order this tab is ringing up,
// per signed-in staff member, so a reload resumes it instead of starting a
// new one. sessionStorage: the order belongs to this till tab, not to every
// tab in the browser. Best-effort - storage can be unavailable.
const keyFor = (staffId: string) => `pos:counter-order:${staffId}`;

export function readCounterOrderId(staffId: string): string | null {
  try {
    return window.sessionStorage.getItem(keyFor(staffId));
  } catch {
    return null;
  }
}

export function saveCounterOrderId(staffId: string, orderId: string): void {
  try {
    window.sessionStorage.setItem(keyFor(staffId), orderId);
  } catch {
    // The order still works; a reload just won't resume it.
  }
}

export function clearCounterOrderId(staffId: string): void {
  try {
    window.sessionStorage.removeItem(keyFor(staffId));
  } catch {
    // Nothing stored if storage never worked.
  }
}
