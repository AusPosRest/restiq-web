// Shared shapes for the CAP-1 guest session flow (start/join).
//
// NOT YET RECONCILED against a real backend contract: issue #68
// (feature/68-guest-session) was building in parallel and hadn't pushed a
// reachable branch at the time this story shipped, and this worktree has no
// access to the restiq-backend checkout to verify directly. These shapes
// are the SPEC's own stated contract (spec-qr-self-order/SPEC.md CAP-1 +
// the issue's "Expected shape" note):
//   POST /guest/v1/sessions       { outletId, tableId, name, phone } ->
//     201 { token, pin, session: { outletId, tableId } }
//   POST /guest/v1/sessions/join  { outletId, tableId, pin, name } ->
//     200 { token, session: { outletId, tableId } }
//     401 { code: "invalid_pin", message }
//     404 { code: "no_active_session", message }
//     429 { code: "rate_limited", message } (PIN join is rate-limited, not
//       credential-grade per SPEC Constraints - no lockout drama)
//   Capability gate: qr_ordering disabled -> 403 { code: "capability_disabled", message }
// Flagged for reconciliation in wiki/features/qr-self-order.md once #68 lands.
export interface GuestSessionSummary {
  outletId: string;
  tableId: string;
}

export type GuestStartResult = {
  token: string;
  pin: string;
  session: GuestSessionSummary;
};

export type GuestJoinResult = {
  token: string;
  session: GuestSessionSummary;
};

export interface GuestApiError {
  code?: string;
  message?: string;
  error?: { code?: string; message?: string };
}
