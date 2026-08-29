// Pure helpers for Q6 Checkout (CAP-5): money formatting and the
// own-share-emphasis/pay-all-eligibility logic the whole screen hinges on.
// Kept framework-free, same split as cart/cart-state.ts, so it's
// unit-testable without a DOM.
import type { BillShareView, GuestBillView } from "./checkout-api";

// GuestBillView (via BillView, src/pos/bills/bills.dtos.ts) carries no
// `currency` field at all - this demo's money model is INR-only, so unlike
// cart-state.ts's formatMinor there is no other currency to fall back to.
export function formatRupees(amountMinor: number): string {
  return `₹${(amountMinor / 100).toFixed(2)}`;
}

export function findShare(shares: BillShareView[], guestId: string): BillShareView | undefined {
  return shares.find((share) => share.guestId === guestId);
}

/** Own share first (the primary action), everyone else's in the order the bill returned them - the signed-in guest's own row is the only one this screen ever renders a Pay action for. */
export function sortSharesOwnFirst(shares: BillShareView[], myGuestId: string): BillShareView[] {
  const mine = shares.filter((share) => share.guestId === myGuestId);
  const others = shares.filter((share) => share.guestId !== myGuestId);
  return [...mine, ...others];
}

/** Mirrors the backend's `partial_payment_exists` rule (bills.service.ts's payAll) so the UI never offers a "pay for the table" control the API would reject: one-payment mode is a whole-bill choice, not a way to mop up a partial per-share flow. */
export function canPayAll(shares: BillShareView[]): boolean {
  return !shares.some((share) => share.status === "paid");
}

export function isSettled(bill: GuestBillView): boolean {
  return bill.status === "finalized";
}
