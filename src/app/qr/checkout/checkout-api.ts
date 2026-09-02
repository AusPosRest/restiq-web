// Q6 Checkout and split payment, simulated (CAP-5, issue #84): the real,
// merged restiq-backend contract (PR #84, src/guest/bills/bills.{dtos,
// controller,service}.ts, read directly - not a guess). Shape copied
// field-for-field from GuestBillView/BillShareView there. `BillView` (the
// shape GuestBillView extends, src/pos/bills/bills.dtos.ts) carries no
// `currency` field at all - checkout-state.ts's formatRupees is INR-only for
// that reason, same India-first posture cart-state.ts's formatMinor default
// already established.
import { guestApi } from "../api-client";

export type BillStatus = "open" | "finalized";
export type BillShareStatus = "outstanding" | "paid";
export type SimulatedOutcome = "success" | "failure";

export interface TenderView {
  id: string;
  method: string;
  amountMinor: number;
  createdAt: string;
}

export interface BillShareView {
  guestId: string;
  guestName: string;
  amountMinor: number;
  status: BillShareStatus;
  payerPhone: string | null;
  paidAt: string | null;
}

export interface GuestBillView {
  id: string;
  orderId: string;
  billNumber: number | null;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number | null;
  discountReason: string | null;
  totalMinor: number;
  status: BillStatus;
  createdAt: string;
  finalizedAt: string | null;
  tenders: TenderView[];
  shares: BillShareView[];
}

export interface SimulatedPaymentInput {
  simulatedOutcome: SimulatedOutcome;
  payerPhone?: string;
}

/**
 * POST /guest/v1/orders/:orderId/bill - create-or-fetch, idempotent per
 * order (restiq-backend#98): 201 GuestBillView for a genuinely new bill, 200
 * with that same GuestBillView for any later call on an order that already
 * has one (any guest at the table may be first to request it - this is also
 * how that race resolves, with no client-side fallback needed); 409
 * `conflict` if the order is closed with no bill ever created; 410
 * `session_closed`; 404 `not_found`.
 */
export function createOrFetchBill(orderId: string): Promise<GuestBillView> {
  return guestApi<GuestBillView>(`orders/${orderId}/bill`, { method: "POST" });
}

/**
 * POST /guest/v1/bills/:id/shares/:guestId/pay - 200 GuestBillView for BOTH
 * simulated outcomes (a 'failure' is a valid demo result, not an HTTP error -
 * the returned share simply stays 'outstanding'); 409 `share_already_paid`;
 * 409 `already_finalized`; 410 `session_closed`; 404 `not_found`.
 */
export function payShare(billId: string, guestId: string, input: SimulatedPaymentInput): Promise<GuestBillView> {
  return guestApi<GuestBillView>(`bills/${billId}/shares/${guestId}/pay`, { method: "POST", body: JSON.stringify(input) });
}

/**
 * POST /guest/v1/bills/:id/pay-all - 200 GuestBillView; 409
 * `partial_payment_exists` if any share was already paid individually
 * (checkout-state.ts's canPayAll mirrors this so the UI never offers a
 * control the API would reject); 409 `already_finalized`; 410 `session_closed`.
 */
export function payAll(billId: string, input: SimulatedPaymentInput): Promise<GuestBillView> {
  return guestApi<GuestBillView>(`bills/${billId}/pay-all`, { method: "POST", body: JSON.stringify(input) });
}
