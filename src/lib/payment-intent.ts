// Shared payment-intent client state (issue #177, W1). `src/lib` is the one
// cross-realm home AD-4 allows - pos, qr and admin all poll the same
// PaymentIntentView and need the same status machine, poll cadence and
// monotonic merge, so this lives here rather than as three per-realm copies.
//
// PROVISIONAL contract: mirrors wiki/features/payments.md "API contracts",
// written before restiq-backend#129 (B3) exists. When that PR merges,
// reconcile this header against src/payments/intents.dtos.ts (this repo's
// RECONCILED convention) and change only what the wire shape moved.

export type PaymentRail = "upi_intent" | "upi_qr" | "card_online" | "card_terminal";
export type PaymentProviderKind = "simulated" | "razorpay";
export type PaymentIntentStatus = "created" | "pending" | "succeeded" | "failed" | "expired" | "cancelled";

/** What the browser needs to hand the payer off - never a secret. Exactly one of these is set per rail/provider. */
export interface PaymentIntentClientPayload {
  /** SimulatedProvider (ADR-004): the screen shows the demo controls that call `POST payment-intents/:id/simulate`. */
  simulated?: boolean;
  /** `upi_qr`: the provider-hosted QR image the POS displays. */
  qrImageUrl?: string | null;
  /** `upi_intent` when the provider returns a `upi://pay?…` intent directly. */
  upiIntentUrl?: string;
  /** Hosted checkout (Razorpay Standard Checkout) for `upi_intent` / `card_online`. */
  checkout?: { keyId: string; orderId: string; upiFirst: boolean };
}

export interface PaymentIntentView {
  id: string;
  billId: string;
  /** Set for a per-guest share intent; null for a whole-bill (pay-all or POS) intent. */
  shareGuestId: string | null;
  rail: PaymentRail;
  provider: PaymentProviderKind;
  amountMinor: number;
  currency: "INR" | "AUD";
  status: PaymentIntentStatus;
  failureReason: string | null;
  providerRef: string | null;
  client: PaymentIntentClientPayload;
  createdAt: string;
  expiresAt: string;
  succeededAt: string | null;
  /** The Tender written by the confirmation - set only once `status === "succeeded"` (ADR-001). */
  tenderId: string | null;
}

export const PAYMENT_RAIL_LABEL: Record<PaymentRail, string> = {
  upi_intent: "UPI app",
  upi_qr: "UPI QR",
  card_online: "Card",
  card_terminal: "Card terminal",
};

export const INTENT_STATUS_LABEL: Record<PaymentIntentStatus, string> = {
  created: "Starting…",
  pending: "Waiting for payment",
  succeeded: "Paid",
  failed: "Payment failed",
  expired: "Timed out",
  cancelled: "Cancelled",
};

// Rank order is the whole status machine: a poll may only ever move an
// intent to an equal-or-higher rank. `succeeded` outranks every other
// terminal state so a late capture still lands (ADR-011: expired → succeeded
// is the one allowed move out of a terminal state), and nothing ever moves
// back to pending.
const STATUS_RANK: Record<PaymentIntentStatus, number> = {
  created: 0,
  pending: 1,
  failed: 2,
  expired: 2,
  cancelled: 2,
  succeeded: 3,
};

export function isTerminalIntentStatus(status: PaymentIntentStatus): boolean {
  return STATUS_RANK[status] >= 2;
}

/** True while the payer can still complete this intent - the screen keeps polling and shows the handoff. */
export function isActiveIntent(intent: PaymentIntentView | null): boolean {
  return intent !== null && !isTerminalIntentStatus(intent.status);
}

/** A new intent may be created for the same target only once this one is over and not paid. */
export function canRetryIntent(intent: PaymentIntentView): boolean {
  return intent.status === "failed" || intent.status === "expired" || intent.status === "cancelled";
}

/**
 * Monotonic merge for polling (ADR-010). A stale or reordered response can
 * never regress a status: `succeeded` wins over everything, a terminal state
 * wins over `pending`, and a different intent id simply replaces the current
 * one (a retry created a new intent).
 */
export function mergeIntentPoll(current: PaymentIntentView | null, incoming: PaymentIntentView): PaymentIntentView {
  if (current === null || current.id !== incoming.id) return incoming;
  return STATUS_RANK[incoming.status] < STATUS_RANK[current.status] ? current : incoming;
}

export const INTENT_POLL_FAST_MS = 2_000;
export const INTENT_POLL_SLOW_MS = 5_000;
export const INTENT_POLL_FAST_WINDOW_MS = 30_000;

/** 2 s while a payer is most likely mid-app (first 30 s), then the surface's usual 5 s (ADR-010). */
export function nextIntentPollMs(elapsedMs: number): number {
  return elapsedMs < INTENT_POLL_FAST_WINDOW_MS ? INTENT_POLL_FAST_MS : INTENT_POLL_SLOW_MS;
}

export function intentExpiresInMs(intent: Pick<PaymentIntentView, "expiresAt">, nowMs: number): number {
  return Math.max(0, Date.parse(intent.expiresAt) - nowMs);
}

/**
 * The clock ran out on the client but the server has not said `expired` yet
 * (the sweep runs every 60 s, and a `GET` may expire lazily). Screens show
 * "Checking…" here rather than a retry button - the provider may still
 * confirm (ADR-011), so the intent is not yet retryable.
 */
export function isAwaitingServerExpiry(intent: PaymentIntentView, nowMs: number): boolean {
  return isActiveIntent(intent) && intentExpiresInMs(intent, nowMs) === 0;
}

/** m:ss for the QR / handoff countdown; never negative. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
