// CU-22/PE-24: the restaurant and table a QR scan points at, so the guest can
// tell they scanned the right one before giving their name and number.
// Server-only, like availability.ts: public endpoint, no guest session yet.
//   GET /guest/v1/outlets/{outletId}/tables/{tableId}/welcome ->
//     200 { restaurantName, outletName, tableLabel } | 404
export interface TableWelcome {
  restaurantName: string;
  outletName: string;
  tableLabel: string;
}

/** null when it can't be read - the welcome screen then just leaves the names out. */
export async function fetchTableWelcome(outletId: string, tableId: string): Promise<TableWelcome | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    const res = await fetch(`${apiUrl}/guest/v1/outlets/${encodeURIComponent(outletId)}/tables/${encodeURIComponent(tableId)}/welcome`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as Partial<TableWelcome> | null;
    if (!body || typeof body.restaurantName !== "string" || typeof body.outletName !== "string" || typeof body.tableLabel !== "string") return null;
    return { restaurantName: body.restaurantName, outletName: body.outletName, tableLabel: body.tableLabel };
  } catch {
    return null;
  }
}
