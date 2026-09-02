// Server-only: fetches the live device fleet for the landing page's Devices
// section, so the owner can click straight into any enrolled device. Ops
// credentials (DEMO_OPS_EMAIL/DEMO_OPS_PASSWORD) are server-only demo-env
// secrets - never exposed to the client - and the token this exchanges them
// for never leaves this module. Mirrors the fetch-then-degrade pattern in
// src/app/qr/t/[outletId]/[tableId]/availability.ts.
//   POST ops/v1/auth/login {email,password} -> { token, operator }
//   GET  ops/v1/devices    -> { devices: DeviceListItem[], nextCursor, total }
export interface LandingDevice {
  id: string;
  label: string;
  type: string;
  status: string;
  tenantName: string;
  outletName: string | null;
}

export type LandingDevicesResult =
  | { kind: "available"; devices: LandingDevice[] }
  | { kind: "unavailable" };

// pos/kiosk terminals sign in at the shared POS PIN pad; kds shares that
// auth realm at its own route; other device types (cds - customer display)
// have no standalone login surface to open. A revoked device is never
// openable regardless of type.
export function deviceOpenHref(device: Pick<LandingDevice, "type" | "status">): string | null {
  if (device.status === "revoked") return null;
  if (device.type === "pos" || device.type === "kiosk") return "/pos/login";
  if (device.type === "kds") return "/kds";
  return null;
}

export async function fetchLandingDevices(): Promise<LandingDevicesResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const email = process.env.DEMO_OPS_EMAIL;
  const password = process.env.DEMO_OPS_PASSWORD;
  if (!apiUrl || !email || !password) return { kind: "unavailable" };

  try {
    const loginRes = await fetch(`${apiUrl}/ops/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    if (!loginRes.ok) return { kind: "unavailable" };
    const loginBody = (await loginRes.json().catch(() => null)) as { token?: string } | null;
    if (!loginBody?.token) return { kind: "unavailable" };

    // ponytail: one page at the API's max page size rather than a cursor
    // loop - fine for a demo-scale fleet; add pagination if it outgrows 100.
    const devicesRes = await fetch(`${apiUrl}/ops/v1/devices?limit=100`, {
      headers: { authorization: `Bearer ${loginBody.token}` },
      cache: "no-store",
    });
    if (!devicesRes.ok) return { kind: "unavailable" };
    const body = (await devicesRes.json().catch(() => null)) as { devices?: LandingDevice[] } | null;
    if (!body?.devices) return { kind: "unavailable" };

    const devices = [...body.devices].sort(
      (a, b) => a.tenantName.localeCompare(b.tenantName) || a.label.localeCompare(b.label),
    );
    return { kind: "available", devices };
  } catch {
    return { kind: "unavailable" };
  }
}
