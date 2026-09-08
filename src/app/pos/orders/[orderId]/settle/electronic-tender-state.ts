// pos/CAP-P4 electronic tenders (issue #177, W1) - the pure half of what
// W4 wires into TenderKeypad / bill-settle-view / counter-view. Composes
// over bill-state.ts (the cash / manual-UPI PendingTender list and total
// math stay exactly as they are) and the shared intent machine in
// src/lib/payment-intent.ts.
//
// The one model change this encodes (ADR-001): an electronic tender is
// never a PendingTender. The server writes it when the provider confirms,
// so it shows up in `bill.tenders` on the next bill read and the screen
// only has to subtract it from what is still due.
//
// PROVISIONAL against wiki/features/payments.md; reconcile with
// restiq-backend#129 B5 (`BillView.tenders[]` gains `paymentIntentId` and
// `riskAcknowledged`, `method` widens to the full TenderMethod) when it
// merges. bill-state.ts's `BillTenderMethod` is left untouched here - W4
// widens it in the same change that reconciles this header.
import { isActiveIntent, type PaymentIntentView } from "@/lib/payment-intent";
import { pendingTenderedMinor, type BillView, type PendingTender } from "./bill-state";

export type ElectronicTenderMethod = "upi_intent" | "upi_qr" | "card_online" | "card_terminal";

export const ELECTRONIC_TENDER_METHODS: readonly ElectronicTenderMethod[] = ["upi_intent", "upi_qr", "card_online", "card_terminal"];

export function isElectronicMethod(method: string): method is ElectronicTenderMethod {
  return (ELECTRONIC_TENDER_METHODS as readonly string[]).includes(method);
}

/** FR-52: a manual UPI tender is the cashier's own verification - the screen makes them say so. */
export const MANUAL_UPI_RISK_TEXT =
  "I have checked my UPI app or soundbox and this payment has been received. RESTIQ cannot verify a manual UPI payment.";

export function validateManualUpiTender(method: string, riskAcknowledged: boolean): string | null {
  if (method !== "upi_manual") return null;
  return riskAcknowledged ? null : "Confirm you have verified the UPI payment before adding it.";
}

/** Sum of the server-written electronic tenders already on the bill. */
export function capturedElectronicMinor(bill: Pick<BillView, "tenders">): number {
  return bill.tenders.reduce((sum, tender) => (isElectronicMethod(tender.method) ? sum + tender.amountMinor : sum), 0);
}

/**
 * What the cashier still has to cover: total − captured electronic − pending
 * cash/manual. Negative means overpaid (a late capture landed after cash was
 * keyed) - callers show it, never clamp it away, since finalise will refuse
 * until it is dealt with (ADR-011 / the overpayment failure mode).
 */
export function remainingToTenderMinor(totalMinor: number, bill: Pick<BillView, "tenders">, pendingTenders: readonly PendingTender[]): number {
  return totalMinor - capturedElectronicMinor(bill) - pendingTenderedMinor(pendingTenders);
}

export function hasPendingIntent(intents: readonly PaymentIntentView[]): boolean {
  return intents.some((intent) => isActiveIntent(intent));
}

/**
 * Mirrors bill-core's finalise gate plus the new 409 `payment_pending`
 * (ADR-001): open bill, no intent still waiting on a provider, and the
 * captured + pending tenders cover the total exactly. Same "at least one
 * tender" posture as bill-state.ts's canFinalizeBill.
 */
export function canFinalizeWithElectronic(
  bill: Pick<BillView, "status" | "tenders">,
  totalMinor: number,
  pendingTenders: readonly PendingTender[],
  intents: readonly PaymentIntentView[],
): boolean {
  if (bill.status !== "open" || hasPendingIntent(intents)) return false;
  if (pendingTenders.length === 0 && capturedElectronicMinor(bill) === 0) return false;
  return remainingToTenderMinor(totalMinor, bill, pendingTenders) === 0;
}

/** The amount a new QR asks for: whole remaining figure by default (split-tender cashiers key a smaller one). */
export function validateIntentAmount(amountMinor: number, remainingMinor: number): string | null {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return "Enter an amount greater than zero.";
  if (amountMinor > remainingMinor) return "The amount cannot be more than what is still due.";
  return null;
}

export type IntentPanelPhase = "idle" | "showing" | "checking" | "paid" | "retry";

/** Which panel the tender column renders for the bill's latest intent. */
export function intentPanelPhase(intent: PaymentIntentView | null, awaitingServerExpiry: boolean): IntentPanelPhase {
  if (intent === null) return "idle";
  if (intent.status === "succeeded") return "paid";
  if (isActiveIntent(intent)) return awaitingServerExpiry ? "checking" : "showing";
  return "retry";
}
