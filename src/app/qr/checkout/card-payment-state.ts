// Card payments on the guest's phone (issue #427, restiq-backend#284), pure half: which
// wallets Stripe's Payment Element may show, the return-URL round trip for a redirect
// (3-D Secure, some wallets), and how long to wait for the bill to catch up with a payment
// Stripe already reported. Framework-free like checkout-state.ts.
import type { PaymentWalletOption } from "@stripe/stripe-js";
import type { CardPaymentMethod, GuestBillView } from "./checkout-api";
import { findShare } from "./checkout-state";

export function walletOptions(allowed: CardPaymentMethod[]): { applePay: PaymentWalletOption; googlePay: PaymentWalletOption } {
  return {
    applePay: allowed.includes("apple_pay") ? "auto" : "never",
    googlePay: allowed.includes("google_pay") ? "auto" : "never",
  };
}

const INTENT_PARAM = "card_intent";
// What Stripe appends to the return_url on a redirect.
const STRIPE_RETURN_PARAMS = ["payment_intent", "payment_intent_client_secret", "redirect_status"];

/** The checkout URL Stripe sends the guest back to after a redirect. */
export function cardReturnUrl(href: string, intentId: string): string {
  const url = new URL(href);
  url.searchParams.set(INTENT_PARAM, intentId);
  return url.toString();
}

export interface CardReturn {
  intentId: string;
  /** Stripe said "succeeded" - worth waiting for the bill to show it. */
  reportedSuccess: boolean;
  /** Stripe said "failed". */
  reportedFailure: boolean;
}

export function parseCardReturn(search: string): CardReturn | null {
  const params = new URLSearchParams(search);
  const intentId = params.get(INTENT_PARAM);
  if (!intentId) return null;
  const status = params.get("redirect_status");
  return { intentId, reportedSuccess: status === "succeeded", reportedFailure: status === "failed" };
}

/** The same URL without the return params, so a reload doesn't sync again. */
export function stripCardReturn(href: string): string {
  const url = new URL(href);
  for (const name of [INTENT_PARAM, ...STRIPE_RETURN_PARAMS]) url.searchParams.delete(name);
  return url.toString();
}

/** A card payment by this guest is done: their share is paid, or the whole bill is. */
export function isPaidFor(bill: GuestBillView, guestId: string): boolean {
  return bill.status === "finalized" || findShare(bill.shares, guestId)?.status === "paid";
}

// The webhook may settle the bill before or after the sync call reads Stripe.
export const SYNC_RETRY_DELAYS_MS = [1000, 2000, 3000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Sync, then retry on the delays above while the bill still shows this guest unpaid. */
export async function syncUntilPaid(
  sync: () => Promise<GuestBillView>,
  guestId: string,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<{ bill: GuestBillView; paid: boolean }> {
  let bill = await sync();
  for (const delay of SYNC_RETRY_DELAYS_MS) {
    if (isPaidFor(bill, guestId)) return { bill, paid: true };
    await wait(delay);
    bill = await sync();
  }
  return { bill, paid: isPaidFor(bill, guestId) };
}
