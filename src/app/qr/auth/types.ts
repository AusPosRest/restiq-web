// Shared shapes for the CAP-1 guest session flow (start/join/availability).
//
// RECONCILED against the real backend contract (restiq-backend PR #69,
// merged to `dev` - `src/guest/sessions/sessions.{controller,dtos,service}.ts`,
// read directly). See wiki/features/qr-self-order.md's "Reconciliation"
// section for what changed from the pre-merge guess this replaced -
// most notably, there is no per-table session-status lookup: only a public
// per-outlet `availability` check plus start/join/session-read endpoints.
//   GET  /guest/v1/outlets/:outletId/availability (public) ->
//     200 { available: boolean, reason?: 'not_found' | 'qr_ordering_disabled' }
//   POST /guest/v1/sessions       { outletId, tableId, name, phone } ->
//     201 { token, pin, session: TableSessionView }
//     409 session_already_open, 403 qr_ordering_disabled, 404 not_found
//   POST /guest/v1/sessions/join  { outletId, tableId, pin, name } ->
//     200 { token, session: TableSessionView }
//     403 invalid_pin, 429 locked_out (5/30s per outlet+table), 404 no_open_session
//   GET  /guest/v1/session (guest token) -> 200 TableSessionView, 410 session_closed
// Every error follows the house envelope: { error: { code, message } }.
export interface GuestSummary {
  id: string;
  name: string;
  joinedAt: string;
}

export interface TableSummary {
  id: string;
  label: string;
}

export type TableSessionStatus = "open" | "settled" | "closed";

export interface TableSessionView {
  sessionId: string;
  status: TableSessionStatus;
  table: TableSummary;
  outletId: string;
  guests: GuestSummary[];
  createdAt: string;
  expiresAt: string;
  closedAt: string | null;
}

export type GuestStartResult = {
  token: string;
  pin: string;
  session: TableSessionView;
};

export type GuestJoinResult = {
  token: string;
  session: TableSessionView;
};

export interface GuestApiError {
  error?: { code?: string; message?: string };
}
