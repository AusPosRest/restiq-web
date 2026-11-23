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
import { cashRoundOffMinor } from "@/lib/money";
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
 * captured + pending tenders cover the total exactly, or the cash covers its
 * market-rounded share (restiq-web#377). Same "at least one
 * tender" posture as bill-state.ts's canFinalizeBill.
 */
export function canFinalizeWithElectronic(
  bill: Pick<BillView, "status" | "tenders">,
  totalMinor: number,
  pendingTenders: readonly PendingTender[],
  intents: readonly PaymentIntentView[],
  currency = "",
): boolean {
  if (bill.status !== "open" || hasPendingIntent(intents)) return false;
  if (pendingTenders.length === 0 && capturedElectronicMinor(bill) === 0) return false;
  return remainingToTenderMinor(totalMinor, bill, pendingTenders) === 0 || cashSettlement(totalMinor, bill, pendingTenders, currency).covers;
}

function pendingCashMinor(pendingTenders: readonly PendingTender[]): number {
  return pendingTenders.reduce((sum, tender) => (tender.method === "cash" ? sum + tender.amountMinor : sum), 0);
}

/**
 * The cash leg of a bill: what the cash has to cover once every other tender
 * is counted, rounded to the nearest rupee for INR / 5 cents for AUD (CU-11,
 * restiq-web#377 - nobody hands back 60 paise), whether the keyed cash covers it, and the change. An
 * over-keyed UPI/external amount (other tenders already past the total) is
 * a mistake to fix, never change to give.
 */
function cashSettlement(totalMinor: number, bill: Pick<BillView, "tenders">, pendingTenders: readonly PendingTender[], currency: string): { covers: boolean; changeMinor: number } {
  const cash = pendingCashMinor(pendingTenders);
  const dueBeforeCash = remainingToTenderMinor(totalMinor, bill, pendingTenders) + cash;
  if (cash === 0 || dueBeforeCash < 0) return { covers: false, changeMinor: 0 };
  const cashDue = dueBeforeCash + cashRoundOffMinor(dueBeforeCash, currency);
  return { covers: cash >= cashDue, changeMinor: Math.max(0, cash - cashDue) };
}

/** Change to hand back (issue #306), against the market-rounded cash due (CU-11, restiq-web#377) - see cashSettlement. */
export function cashChangeMinor(totalMinor: number, bill: Pick<BillView, "tenders">, pendingTenders: readonly PendingTender[], currency = ""): number {
  return cashSettlement(totalMinor, bill, pendingTenders, currency).changeMinor;
}

/** Change taken back off the cash, last cash tender first; a cash tender it uses up entirely is dropped. */
export function tendersNetOfChange(pendingTenders: readonly PendingTender[], changeMinor: number): PendingTender[] {
  let left = changeMinor;
  const net = [...pendingTenders].reverse().map((tender) => {
    if (tender.method !== "cash" || left === 0) return tender;
    const taken = Math.min(left, tender.amountMinor);
    left -= taken;
    return { ...tender, amountMinor: tender.amountMinor - taken };
  });
  return net.reverse().filter((tender) => tender.amountMinor > 0);
}

/**
 * The tenders finalize posts (restiq-web#377): the cash that went into the
 * drawer - change taken off, the market round-off NOT added back, so bill-core
 * stores the round-off on the bill and shift close expects the real cash. Each
 * posted cash tender carries tenderedMinor; the last one also carries the
 * whole change, so tendered sums to the cash keyed.
 */
export function tendersForFinalize(totalMinor: number, bill: Pick<BillView, "tenders">, pendingTenders: readonly PendingTender[], currency: string): PendingTender[] {
  if (pendingCashMinor(pendingTenders) === 0) return [...pendingTenders];
  const change = cashChangeMinor(totalMinor, bill, pendingTenders, currency);
  const net = tendersNetOfChange(pendingTenders, change);
  const lastCash = net.map((tender) => tender.method).lastIndexOf("cash");
  return net.map((tender, index) => (tender.method === "cash" ? { ...tender, tenderedMinor: tender.amountMinor + (index === lastCash ? change : 0) } : tender));
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
