// Server-only lookup for the QR entry point (CAP-1): is qr_ordering enabled
// for this outlet (OutletCapability, SPEC Constraints)? Called directly from
// page.tsx before any guest session exists, so it hits the backend directly
// rather than through /qr/api (which requires a guest JWT).
//
// Replaces the pre-reconciliation table-status.ts, which assumed a
// per-table session-status endpoint that does not exist on the real backend
// (restiq-backend PR #69, merged to `dev`). The real, only public gate check
// is per-outlet, not per-table, and says nothing about whether a session is
// already open - see welcome-flow.tsx for how start-vs-join is decided
// instead (reactively, from the start/join responses themselves).
//   GET /guest/v1/outlets/{outletId}/availability ->
//     200 { available: boolean, reason?: "not_found" | "qr_ordering_disabled" }
export type AvailabilityReason = "not_found" | "qr_ordering_disabled";

export type AvailabilityResult =
  | { kind: "available" }
  | { kind: "unavailable"; reason?: AvailabilityReason }
  | { kind: "unreachable" };

export async function checkAvailability(outletId: string): Promise<AvailabilityResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return { kind: "unreachable" };

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl}/guest/v1/outlets/${outletId}/availability`, { cache: "no-store" });
  } catch {
    return { kind: "unreachable" };
  }
  if (!upstream.ok) return { kind: "unreachable" };

  const body = (await upstream.json().catch(() => null)) as { available?: boolean; reason?: AvailabilityReason } | null;
  if (!body || typeof body.available !== "boolean") return { kind: "unreachable" };
  return body.available ? { kind: "available" } : { kind: "unavailable", reason: body.reason };
}
