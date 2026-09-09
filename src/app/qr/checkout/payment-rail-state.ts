// Q6 real rails, pure half (CAP-P3, issue #177, W1) - what W3 wires into
// checkout-screen.tsx in place of the simulate buttons. Framework-free like
// checkout-state.ts. Owns: which pay options Q6 offers (UPI-first, FR-42),
// the app-specific UPI deep link, the per-share phase the sheet renders,
// and the handoff a freshly created intent asks the browser to make.
//
// PROVISIONAL against wiki/features/payments.md; reconcile with
// restiq-backend#129 B4 (guest intent endpoints) when it merges.
import { isActiveIntent, type PaymentIntentView, type PaymentProviderKind } from "@/lib/payment-intent";
import type { BillShareView } from "./checkout-api";

export type UpiApp = "gpay" | "phonepe" | "paytm" | "other";

/** UPI-first, the design's button order; "other" opens the OS app chooser. */
export const UPI_APPS: readonly { id: UpiApp; label: string }[] = [
  { id: "gpay", label: "Google Pay" },
  { id: "phonepe", label: "PhonePe" },
  { id: "paytm", label: "Paytm" },
  { id: "other", label: "Any UPI app" },
];

export type GuestPayOption = { kind: "upi"; app: UpiApp } | { kind: "card" } | { kind: "counter" };

export interface GuestPaymentCapabilities {
  /** The outlet's `online_payments` capability (ADR-007). */
  onlinePayments: boolean;
  provider: PaymentProviderKind;
  /** From the provider's capabilities(): whether `card_online` is offered. */
  cardOnline: boolean;
}

/** Pay at counter is always last and always present; with online payments off it is the only option. */
export function guestPayOptions(capabilities: GuestPaymentCapabilities): GuestPayOption[] {
  if (!capabilities.onlinePayments) return [{ kind: "counter" }];
  const upi: GuestPayOption[] = UPI_APPS.map((app) => ({ kind: "upi", app: app.id }));
  const card: GuestPayOption[] = capabilities.cardOnline ? [{ kind: "card" }] : [];
  return [...upi, ...card, { kind: "counter" }];
}

// Scheme+path swap only. The query string (pa, pn, am, tr, tn, cu) is the
// provider's signed payload and is never touched - the app just gets a
// direct door instead of the OS chooser.
const APP_SCHEME: Record<UpiApp, string | null> = {
  gpay: "tez://upi/pay",
  phonepe: "phonepe://pay",
  paytm: "paytmmp://pay",
  other: null,
};

export function toAppUpiUrl(upiUrl: string, app: UpiApp): string {
  const scheme = APP_SCHEME[app];
  const query = upiUrl.indexOf("?");
  if (scheme === null || query === -1 || !upiUrl.toLowerCase().startsWith("upi://pay")) return upiUrl;
  return `${scheme}${upiUrl.slice(query)}`;
}

export type SharePayPhase = "idle" | "awaiting" | "paid" | "retry";

/** The share row's state from the bill's own status plus this guest's latest intent - the server's `paid` always wins. */
export function sharePayPhase(share: Pick<BillShareView, "status">, intent: PaymentIntentView | null): SharePayPhase {
  if (share.status === "paid") return "paid";
  if (intent === null) return "idle";
  if (isActiveIntent(intent)) return "awaiting";
  // The intent confirmed but the bill read is one poll behind - render paid, never a retry button (ADR-002).
  if (intent.status === "succeeded") return "paid";
  return "retry";
}

/** The demo badge and the simulate controls show only here (ADR-004). */
export function isDemoProvider(provider: PaymentProviderKind): boolean {
  return provider === "simulated";
}

export type IntentHandoff =
  | { kind: "simulated" }
  | { kind: "upi_url"; url: string }
  | { kind: "checkout"; keyId: string; orderId: string; upiFirst: boolean }
  | { kind: "none" };

/** What the browser does the moment an intent comes back: demo controls, a direct app deep link, or hosted checkout. */
export function intentHandoff(intent: Pick<PaymentIntentView, "client">, app: UpiApp | null): IntentHandoff {
  const { simulated, upiIntentUrl, checkout } = intent.client;
  if (simulated) return { kind: "simulated" };
  if (upiIntentUrl) return { kind: "upi_url", url: app === null ? upiIntentUrl : toAppUpiUrl(upiIntentUrl, app) };
  if (checkout) return { kind: "checkout", ...checkout };
  return { kind: "none" };
}
