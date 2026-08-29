// Server-only lookup for the QR entry point (CAP-1): does this outlet+table
// exist, is qr_ordering enabled (OutletCapability, SPEC Constraints), and is
// a table session already open (decides Q1's "Start ordering" vs "Join your
// table" CTA, EXPERIENCE.md IA step 1). Called directly from page.tsx before
// any guest session exists, so it hits the backend directly rather than
// through /qr/api (which requires a guest JWT).
//
// Contract assumed from SPEC.md pending reconciliation with issue #68
// (feature/68-guest-session) - not reachable from this worktree at build
// time. Assumed shape:
//   GET /guest/v1/tables/{outletId}/{tableId} ->
//     200 { outlet: { id, name }, table: { id, label }, qrOrderingEnabled, sessionOpen }
//     404 { code: "not_found", message }
// Flagged for reconciliation in wiki/features/qr-self-order.md once #68 lands.
export interface TableStatus {
  outlet: { id: string; name: string };
  table: { id: string; label: string };
  qrOrderingEnabled: boolean;
  sessionOpen: boolean;
}

export type TableStatusResult =
  | { kind: "ok"; status: TableStatus }
  | { kind: "not_found" }
  | { kind: "unreachable" };

export async function fetchTableStatus(outletId: string, tableId: string): Promise<TableStatusResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return { kind: "unreachable" };

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/guest/v1/tables/${outletId}/${tableId}`, { cache: "no-store" });
  } catch {
    return { kind: "unreachable" };
  }

  if (upstream.status === 404) return { kind: "not_found" };
  if (!upstream.ok) return { kind: "unreachable" };

  const status = (await upstream.json().catch(() => null)) as TableStatus | null;
  if (!status || typeof status.qrOrderingEnabled !== "boolean" || typeof status.sessionOpen !== "boolean") {
    return { kind: "unreachable" };
  }
  return { kind: "ok", status };
}
