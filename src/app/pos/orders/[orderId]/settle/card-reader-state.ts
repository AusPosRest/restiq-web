// Stripe smart readers on the card-terminal tender (restiq-web#429) - the
// pure decisions: which reader is picked, whether it can take a payment, what
// the waiting / failed panel says, and when the sandbox simulate buttons show.
// No readers means none of this applies and the simulated terminal runs as before.
import { isActiveIntent, type PaymentIntentView } from "@/lib/payment-intent";
import type { CardReaderView } from "../../../api";

/** `unknown` (Stripe didn't say) is still offered - only a known-offline reader is refused. */
export function isReaderAvailable(reader: Pick<CardReaderView, "status">): boolean {
  return reader.status !== "offline";
}

/** The remembered reader if it is still here and not offline, else the first available one; null when none can take a payment. */
export function defaultReaderId(readers: readonly CardReaderView[], rememberedId: string | null): string | null {
  const remembered = readers.find((reader) => reader.id === rememberedId);
  if (remembered && isReaderAvailable(remembered)) return remembered.id;
  return readers.find(isReaderAvailable)?.id ?? null;
}

/** The send button needs a chosen reader that is not offline. */
export function canSendToReader(readers: readonly CardReaderView[], readerId: string | null): boolean {
  const reader = readers.find((candidate) => candidate.id === readerId);
  return reader !== undefined && isReaderAvailable(reader);
}

export function readerWaitingText(readerLabel: string | null | undefined): string {
  return `Tap, insert or swipe on ${readerLabel || "the card reader"}`;
}

/** Stripe's own words for a failed reader payment; null for anything else (the status label already says it). */
export function readerFailureText(intent: Pick<PaymentIntentView, "provider" | "status" | "failureReason">): string | null {
  if (intent.provider !== "stripe" || intent.status !== "failed") return null;
  return intent.failureReason || "The card reader couldn't take this payment.";
}

/** Sandbox-only test controls: a Stripe intent still waiting, until the server 404s the simulate call (a live key). */
export function showSimulateControls(intent: PaymentIntentView, sandbox: boolean): boolean {
  return sandbox && intent.provider === "stripe" && isActiveIntent(intent);
}

const LAST_READER_KEY = "pos:card-reader:";

/** Last reader this device used at the outlet - best effort, storage may be unavailable. */
export function readRememberedReader(outletId: string): string | null {
  try {
    return window.localStorage.getItem(LAST_READER_KEY + outletId);
  } catch {
    return null;
  }
}

export function rememberReader(outletId: string, readerId: string): void {
  try {
    window.localStorage.setItem(LAST_READER_KEY + outletId, readerId);
  } catch {
    // Best-effort - the picker still holds the choice for this screen.
  }
}
