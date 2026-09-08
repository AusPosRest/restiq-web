// Pure Reports ▸ Reconciliation logic (CAP-P6, FR-51, issue #177, W1), kept
// free of React like payments-state.ts / reports-state.ts. W6 builds the
// exception queue over this: rows, severity, totals, and the resolve /
// write-off rule (a reason is mandatory - it lands in audit_events).
//
// PROVISIONAL against wiki/features/payments.md; reconcile with
// restiq-backend#129 B9 (`GET admin/v1/payments/exceptions`,
// `POST …/exceptions/:id/resolve`) when it merges.
import type { PaymentRail } from "@/lib/payment-intent";

export type PaymentExceptionKind =
  | "unconfirmed_intent"
  | "provider_captured_no_tender"
  | "amount_mismatch"
  | "provider_status_conflict"
  | "refund_mismatch";

export type PaymentExceptionStatus = "open" | "resolved" | "written_off";

export interface PaymentExceptionRow {
  id: string;
  kind: PaymentExceptionKind;
  status: PaymentExceptionStatus;
  billId: string | null;
  billNumber: number | null;
  outletId: string;
  outletName: string;
  intentId: string | null;
  providerRef: string | null;
  rail: PaymentRail | null;
  localAmountMinor: number | null;
  providerAmountMinor: number | null;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionReason: string | null;
}

export interface PaymentExceptionsResponse {
  items: PaymentExceptionRow[];
  nextCursor: string | null;
  totals: { open: number };
}

export const EXCEPTION_KIND_LABEL: Record<PaymentExceptionKind, string> = {
  unconfirmed_intent: "Payment never confirmed",
  provider_captured_no_tender: "Provider captured, no tender recorded",
  amount_mismatch: "Amount differs from the bill",
  provider_status_conflict: "Provider disagrees with our record",
  refund_mismatch: "Refund not reflected by the provider",
};

/** What the owner should do - written from their side of the screen. */
export const EXCEPTION_KIND_HINT: Record<PaymentExceptionKind, string> = {
  unconfirmed_intent: "The guest's app reported success but the provider never confirmed. Check the provider dashboard for the reference; if the money arrived, resolve - if not, the share is still outstanding.",
  provider_captured_no_tender: "Money reached your provider account for a payment we have no record of. Find the bill it belongs to, then resolve with the bill number.",
  amount_mismatch: "The captured amount is not the amount the bill asked for. The tender was recorded as captured; settle the difference by change or refund, then resolve.",
  provider_status_conflict: "We recorded a payment the provider now shows as failed or refunded. Confirm with the provider before resolving.",
  refund_mismatch: "A credit note's refund did not process at the provider. Retry the refund from the credit note, or write it off with a reason.",
};

export type ExceptionSeverity = "critical" | "high" | "medium";

/** Money that moved but is not in our books is critical; an unconfirmed claim is high; a refund that did not go through is medium (the credit note still stands). */
export function exceptionSeverity(kind: PaymentExceptionKind): ExceptionSeverity {
  switch (kind) {
    case "provider_captured_no_tender":
    case "amount_mismatch":
      return "critical";
    case "unconfirmed_intent":
    case "provider_status_conflict":
      return "high";
    case "refund_mismatch":
      return "medium";
  }
}

const SEVERITY_RANK: Record<ExceptionSeverity, number> = { critical: 0, high: 1, medium: 2 };

/** Worst first, then oldest first - the queue's fixed order. */
export function sortForQueue(rows: readonly PaymentExceptionRow[]): PaymentExceptionRow[] {
  return [...rows].sort((a, b) => {
    const severity = SEVERITY_RANK[exceptionSeverity(a.kind)] - SEVERITY_RANK[exceptionSeverity(b.kind)];
    return severity !== 0 ? severity : a.detectedAt.localeCompare(b.detectedAt);
  });
}

/** The figure in dispute on one row: the gap when both sides are known, otherwise whichever side is. */
export function unmatchedMinor(row: Pick<PaymentExceptionRow, "localAmountMinor" | "providerAmountMinor">): number {
  if (row.localAmountMinor !== null && row.providerAmountMinor !== null) return Math.abs(row.providerAmountMinor - row.localAmountMinor);
  return row.providerAmountMinor ?? row.localAmountMinor ?? 0;
}

export interface ExceptionSummary {
  open: number;
  byKind: Record<PaymentExceptionKind, number>;
  /** Sum of unmatchedMinor over open rows - the headline "money in question" figure. */
  unmatchedMinor: number;
}

export function summarizeExceptions(rows: readonly PaymentExceptionRow[]): ExceptionSummary {
  const summary: ExceptionSummary = {
    open: 0,
    byKind: { unconfirmed_intent: 0, provider_captured_no_tender: 0, amount_mismatch: 0, provider_status_conflict: 0, refund_mismatch: 0 },
    unmatchedMinor: 0,
  };
  for (const row of rows) {
    if (row.status !== "open") continue;
    summary.open += 1;
    summary.byKind[row.kind] += 1;
    summary.unmatchedMinor += unmatchedMinor(row);
  }
  return summary;
}

export type ResolutionAction = "resolved" | "written_off";

export function canResolve(row: Pick<PaymentExceptionRow, "status">): boolean {
  return row.status === "open";
}

export const MIN_RESOLUTION_REASON_LENGTH = 5;

/** Mirrors the backend's 409 (not open) and 400 (empty reason) - the reason is the audit trail, so a token entry is refused. */
export function validateResolution(row: Pick<PaymentExceptionRow, "status">, reason: string): string | null {
  if (!canResolve(row)) return "This exception has already been closed.";
  if (reason.trim().length < MIN_RESOLUTION_REASON_LENGTH) return "Give a reason - it is written to the audit log.";
  return null;
}
