import { describe, expect, it } from "vitest";
import {
  canResolve,
  exceptionSeverity,
  sortForQueue,
  summarizeExceptions,
  unmatchedMinor,
  validateResolution,
  type PaymentExceptionRow,
} from "./reconciliation-state";

function row(overrides: Partial<PaymentExceptionRow> = {}): PaymentExceptionRow {
  return {
    id: "ex-1",
    kind: "unconfirmed_intent",
    status: "open",
    billId: "bill-1",
    billNumber: 41,
    outletId: "outlet-1",
    outletName: "Koramangala",
    intentId: "pi-1",
    providerRef: "pay_123",
    rail: "upi_intent",
    localAmountMinor: 52500,
    providerAmountMinor: null,
    detectedAt: "2026-09-09T06:10:00.000Z",
    resolvedAt: null,
    resolvedBy: null,
    resolutionReason: null,
    ...overrides,
  };
}

describe("exceptionSeverity / sortForQueue", () => {
  it("ranks money-moved-but-unrecorded as critical, unconfirmed claims high, refund gaps medium", () => {
    expect(exceptionSeverity("provider_captured_no_tender")).toBe("critical");
    expect(exceptionSeverity("amount_mismatch")).toBe("critical");
    expect(exceptionSeverity("unconfirmed_intent")).toBe("high");
    expect(exceptionSeverity("provider_status_conflict")).toBe("high");
    expect(exceptionSeverity("refund_mismatch")).toBe("medium");
  });

  it("orders worst first, then oldest first, without mutating the input", () => {
    const rows = [
      row({ id: "medium-old", kind: "refund_mismatch", detectedAt: "2026-09-08T00:00:00.000Z" }),
      row({ id: "high-new", kind: "unconfirmed_intent", detectedAt: "2026-09-09T02:00:00.000Z" }),
      row({ id: "critical", kind: "amount_mismatch", detectedAt: "2026-09-09T03:00:00.000Z" }),
      row({ id: "high-old", kind: "provider_status_conflict", detectedAt: "2026-09-09T01:00:00.000Z" }),
    ];
    expect(sortForQueue(rows).map((r) => r.id)).toEqual(["critical", "high-old", "high-new", "medium-old"]);
    expect(rows[0].id).toBe("medium-old");
  });
});

describe("unmatchedMinor / summarizeExceptions", () => {
  it("takes the gap when both sides are known, otherwise the known side", () => {
    expect(unmatchedMinor({ localAmountMinor: 52500, providerAmountMinor: 55000 })).toBe(2500);
    expect(unmatchedMinor({ localAmountMinor: null, providerAmountMinor: 55000 })).toBe(55000);
    expect(unmatchedMinor({ localAmountMinor: 52500, providerAmountMinor: null })).toBe(52500);
    expect(unmatchedMinor({ localAmountMinor: null, providerAmountMinor: null })).toBe(0);
  });

  it("counts and sums open rows only", () => {
    const summary = summarizeExceptions([
      row({ id: "a", kind: "amount_mismatch", localAmountMinor: 52500, providerAmountMinor: 55000 }),
      row({ id: "b", kind: "provider_captured_no_tender", localAmountMinor: null, providerAmountMinor: 12000 }),
      row({ id: "c", kind: "unconfirmed_intent", status: "resolved", resolvedAt: "2026-09-09T07:00:00.000Z" }),
    ]);
    expect(summary.open).toBe(2);
    expect(summary.byKind.amount_mismatch).toBe(1);
    expect(summary.byKind.provider_captured_no_tender).toBe(1);
    expect(summary.byKind.unconfirmed_intent).toBe(0);
    expect(summary.unmatchedMinor).toBe(14500);
  });
});

describe("validateResolution", () => {
  it("refuses a closed row and a token reason, accepts an open row with a real reason", () => {
    expect(validateResolution(row({ status: "resolved" }), "Matched to bill 41 in the Razorpay dashboard")).toMatch(/already been closed/);
    expect(validateResolution(row(), "  ok  ")).toMatch(/Give a reason/);
    expect(validateResolution(row(), "Matched to bill 41 in the Razorpay dashboard")).toBeNull();
    expect(canResolve(row({ status: "written_off" }))).toBe(false);
  });
});
