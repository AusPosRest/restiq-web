// restiq-backend#209 (SE-12): an enrolled device gets a secret once, in the enrolment
// response. The PIN pad sends it with the device id so the API knows the sign-in
// really comes from that till (a bare device id sits in URLs and proves nothing).
// localStorage, like the POS terminal binding it pairs with, so reopening the till
// in a new tab still proves itself. Best-effort: storage can throw (private mode),
// and then the till simply signs in like any browser.
const keyFor = (deviceId: string) => `device:secret:${deviceId}`;

export function saveDeviceSecret(deviceId: string, secret: string): void {
  try {
    window.localStorage.setItem(keyFor(deviceId), secret);
  } catch {
    // See file header - losing it only costs the till its own sign-in allowance.
  }
}

export function getDeviceSecret(deviceId: string): string | null {
  try {
    return window.localStorage.getItem(keyFor(deviceId));
  } catch {
    return null;
  }
}
