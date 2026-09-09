import { describe, expect, it } from "vitest";
import type { PaymentIntentView } from "@/lib/payment-intent";
import type { BillView, PendingTender } from "./bill-state";
import {
  canFinalizeWithElectronic,
  capturedElectronicMinor,
  hasPendingIntent,
  intentPanelPhase,
  isElectronicMethod,
  remainingToTenderMinor,
  validateIntentAmount,
  validateManualUpiTender,
} from "./electronic-tender-state";

// bill-state.ts's BillTenderMethod is still cash | upi_manual (W4 widens it);
// the server-written rows this module reads are cast the way the wire will
// actually deliver them.
type AnyTender = BillView["tenders"][number];
function tender(method: string, amountMinor: number): AnyTender {
  return { id: `t-${method}-${amountMinor}`, method: method as AnyTender["method"], amountMinor, createdAt: "2026-09-09T06:00:00.000Z" };
}

function bill(tenders: AnyTender[] = [], status: BillView["status"] = "open"): Pick<BillView, "status" | "tenders"> {
  return { status, tenders };
}

function intent(status: PaymentIntentView["status"]): PaymentIntentView {
  return {
    id: `pi-${status}`,
    billId: "bill-1",
    shareGuestId: null,
    rail: "upi_qr",
    provider: "razorpay",
    amountMinor: 30000,
    currency: "INR",
    status,
    failureReason: null,
    providerRef: null,
    client: {},
    createdAt: "2026-09-09T06:00:00.000Z",
    expiresAt: "2026-09-09T06:05:00.000Z",
    succeededAt: null,
    tenderId: null,
  };
}

describe("electronic methods", () => {
  it("classifies every rail as electronic and cash / manual UPI as not", () => {
    expect(isElectronicMethod("upi_qr")).toBe(true);
    expect(isElectronicMethod("card_terminal")).toBe(true);
    expect(isElectronicMethod("cash")).toBe(false);
    expect(isElectronicMethod("upi_manual")).toBe(false);
  });

  it("sums only the server-written electronic tenders", () => {
    expect(capturedElectronicMinor(bill([tender("upi_qr", 30000), tender("cash", 5000), tender("upi_intent", 2500)]))).toBe(32500);
    expect(capturedElectronicMinor(bill())).toBe(0);
  });
});

describe("validateManualUpiTender (FR-52)", () => {
  it("requires the risk acknowledgement for manual UPI only", () => {
    expect(validateManualUpiTender("upi_manual", false)).toMatch(/verified/);
    expect(validateManualUpiTender("upi_manual", true)).toBeNull();
    expect(validateManualUpiTender("cash", false)).toBeNull();
  });
});

describe("remainingToTenderMinor", () => {
  const pending: PendingTender[] = [{ method: "cash", amountMinor: 20000 }];

  it("subtracts captured electronic and pending cash from the total", () => {
    expect(remainingToTenderMinor(52500, bill([tender("upi_qr", 30000)]), pending)).toBe(2500);
  });

  it("goes negative on an overpayment instead of hiding it", () => {
    expect(remainingToTenderMinor(52500, bill([tender("upi_qr", 40000)]), pending)).toBe(-7500);
  });
});

describe("canFinalizeWithElectronic", () => {
  it("finalises when captured + pending cover the total exactly and nothing is pending", () => {
    const b = bill([tender("upi_qr", 30000)]);
    expect(canFinalizeWithElectronic(b, 52500, [{ method: "cash", amountMinor: 22500 }], [intent("succeeded")])).toBe(true);
  });

  it("refuses while any intent is still waiting on the provider (409 payment_pending)", () => {
    const b = bill([tender("upi_qr", 30000)]);
    expect(canFinalizeWithElectronic(b, 52500, [{ method: "cash", amountMinor: 22500 }], [intent("pending")])).toBe(false);
    expect(hasPendingIntent([intent("succeeded"), intent("created")])).toBe(true);
    expect(hasPendingIntent([intent("expired")])).toBe(false);
  });

  it("refuses a short, an over, a finalized bill, and a bill with no tender at all", () => {
    expect(canFinalizeWithElectronic(bill([tender("upi_qr", 30000)]), 52500, [{ method: "cash", amountMinor: 20000 }], [])).toBe(false);
    expect(canFinalizeWithElectronic(bill([tender("upi_qr", 60000)]), 52500, [], [])).toBe(false);
    expect(canFinalizeWithElectronic(bill([tender("upi_qr", 52500)], "finalized"), 52500, [], [])).toBe(false);
    expect(canFinalizeWithElectronic(bill(), 0, [], [])).toBe(false);
  });

  it("finalises a bill fully covered by electronic tenders with no cash keyed", () => {
    expect(canFinalizeWithElectronic(bill([tender("upi_qr", 52500)]), 52500, [], [intent("succeeded")])).toBe(true);
  });
});

describe("validateIntentAmount", () => {
  it("rejects zero, negatives, fractions and anything above what is due", () => {
    expect(validateIntentAmount(0, 1000)).toMatch(/greater than zero/);
    expect(validateIntentAmount(-5, 1000)).toMatch(/greater than zero/);
    expect(validateIntentAmount(10.5, 1000)).toMatch(/greater than zero/);
    expect(validateIntentAmount(1001, 1000)).toMatch(/still due/);
    expect(validateIntentAmount(1000, 1000)).toBeNull();
  });
});

describe("intentPanelPhase", () => {
  it("maps intent state to the panel the tender column shows", () => {
    expect(intentPanelPhase(null, false)).toBe("idle");
    expect(intentPanelPhase(intent("pending"), false)).toBe("showing");
    expect(intentPanelPhase(intent("pending"), true)).toBe("checking");
    expect(intentPanelPhase(intent("succeeded"), false)).toBe("paid");
    expect(intentPanelPhase(intent("expired"), false)).toBe("retry");
    expect(intentPanelPhase(intent("cancelled"), true)).toBe("retry");
  });
});
