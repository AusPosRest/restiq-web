import { describe, expect, it } from "vitest";
import {
  billTotalMinor,
  canFinalizeBill,
  discountRequiresManagerApproval,
  isBillReadOnly,
  pendingTenderedMinor,
  type BillView,
  type PendingTender,
} from "./bill-state";

describe("discountRequiresManagerApproval", () => {
  // bills.service.ts's DISCOUNT_THRESHOLD_PERCENT = 20% of the subtotal.
  const subtotalMinor = 100000; // ₹1000.00

  it("does not require approval below 20% of the subtotal", () => {
    expect(discountRequiresManagerApproval(19999, subtotalMinor)).toBe(false);
  });

  it("does not require approval exactly at 20% of the subtotal", () => {
    expect(discountRequiresManagerApproval(20000, subtotalMinor)).toBe(false);
  });

  it("requires approval above 20% of the subtotal", () => {
    expect(discountRequiresManagerApproval(20001, subtotalMinor)).toBe(true);
  });
});

function bill(overrides: Partial<BillView> = {}): BillView {
  return {
    id: "bill-1",
    orderId: "order-1",
    billNumber: null,
    status: "open",
    subtotalMinor: 100000,
    taxMinor: 5000,
    discountMinor: null,
    discountReason: null,
    totalMinor: 105000,
    createdAt: "2026-08-25T10:00:00.000Z",
    finalizedAt: null,
    tenders: [],
    ...overrides,
  };
}

describe("billTotalMinor", () => {
  it("is subtotal + tax when there is no discount", () => {
    expect(billTotalMinor(bill())).toBe(105000);
  });

  it("subtracts a pending (not-yet-submitted) discount", () => {
    expect(billTotalMinor(bill(), 10000)).toBe(95000);
  });

  it("prefers the bill's own discountMinor once it's real, over any pending preview", () => {
    expect(billTotalMinor(bill({ discountMinor: 5000 }), 10000)).toBe(100000);
  });
});

describe("pendingTenderedMinor", () => {
  it("sums every pending tender", () => {
    const tenders: PendingTender[] = [
      { method: "cash", amountMinor: 50000 },
      { method: "upi_manual", amountMinor: 55000 },
    ];
    expect(pendingTenderedMinor(tenders)).toBe(105000);
  });
});

describe("canFinalizeBill", () => {
  it("is false while pending tenders fall short of the total", () => {
    expect(canFinalizeBill(bill(), 105000, [{ method: "cash", amountMinor: 50000 }])).toBe(false);
  });

  it("is true once pending tenders exactly cover the total", () => {
    expect(canFinalizeBill(bill(), 105000, [{ method: "cash", amountMinor: 105000 }])).toBe(true);
  });

  it("is false when pending tenders exceed the total (never silently over-settles)", () => {
    expect(canFinalizeBill(bill(), 105000, [{ method: "cash", amountMinor: 150000 }])).toBe(false);
  });

  it("is false with no tenders at all", () => {
    expect(canFinalizeBill(bill(), 105000, [])).toBe(false);
  });

  it("is false once the bill is already finalized", () => {
    expect(canFinalizeBill(bill({ status: "finalized" }), 105000, [{ method: "cash", amountMinor: 105000 }])).toBe(false);
  });
});

describe("isBillReadOnly", () => {
  it("is false for an open bill", () => {
    expect(isBillReadOnly(bill({ status: "open" }))).toBe(false);
  });

  it("is true for a finalized bill", () => {
    expect(isBillReadOnly(bill({ status: "finalized" }))).toBe(true);
  });
});
