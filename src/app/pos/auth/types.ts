// Shared shapes for the CAP-1 PIN login flow, matching restiq-backend's real
// feature/44-pos-auth-clock contract exactly (src/pos/auth/auth.dtos.ts,
// read directly from that branch - not merged to restiq-backend/dev yet but
// real and pushed, and this story's own backend counterpart).
export interface StaffSummary {
  id: string;
  name: string;
}

export interface OutletSummary {
  id: string;
  name: string;
}

export type PosLoginResult =
  | { status: "authenticated"; token: string; staff: StaffSummary; outlet: OutletSummary }
  | { status: "select_outlet"; pendingToken: string; staff: StaffSummary; outlets: OutletSummary[] };
