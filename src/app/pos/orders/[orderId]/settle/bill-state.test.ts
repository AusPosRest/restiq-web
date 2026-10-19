import { describe, expect, it } from "vitest";
import {
  billFigures,
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
    expect(billTotalMinor(bill({ discountMinor: 5000, totalMinor: 100000 }), 10000)).toBe(100000);
  });

  it("charges GST on the discounted value for an India bill (restiq-backend#207)", () => {
    const india = bill({
      subtotalMinor: 24045,
      taxMinor: 1202,
      totalMinor: 24045 + 1202,
      taxBreakdown: [
        { label: "CGST", ratePercent: 2.5, amountMinor: 601 },
        { label: "SGST", ratePercent: 2.5, amountMinor: 601 },
      ],
    });
    // 10% discount: net 21641; GST = round(21641 x 5%) = round(1082.05) = 1082, split 541 + 541.
    expect(billTotalMinor(india, 2404)).toBe(21641 + 541 + 541);
    // No discount: unchanged from the snapshotted tax.
    expect(billTotalMinor(india)).toBe(24045 + 601 + 601);
  });

  it("keeps a composition-scheme bill's own tax (no rated breakdown)", () => {
    expect(billTotalMinor(bill({ taxMinor: 0, taxBreakdown: [] }), 10000)).toBe(90000);
  });

  it("never adds tax on top of a tax-inclusive (AU) subtotal (issue #156)", () => {
    expect(billTotalMinor(bill({ pricesIncludeTax: true, totalMinor: 100000 }))).toBe(100000);
    expect(billTotalMinor(bill({ pricesIncludeTax: true }), 10000)).toBe(90000);
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

describe("billFigures (restiq-web#369)", () => {
  const CGST_SGST = [
    { label: "CGST", ratePercent: 2.5, amountMinor: 1844 },
    { label: "SGST", ratePercent: 2.5, amountMinor: 1844 },
  ];

  it("puts CGST/SGST on the discounted value so discount and tax lines add up to TOTAL (AP-pe-6 repro)", () => {
    // ₹737.50 with 25% off: discount ₹184.38, GST round(55312 x 5%) = 2766 -> CGST ₹13.83 + SGST ₹13.83, TOTAL ₹580.78.
    const b = bill({ subtotalMinor: 73750, taxMinor: 3688, taxBreakdown: CGST_SGST, totalMinor: 77438 });
    const figures = billFigures(b, 18438);
    expect(figures.taxBreakdown).toEqual([
      { label: "CGST", ratePercent: 2.5, amountMinor: 1383 },
      { label: "SGST", ratePercent: 2.5, amountMinor: 1383 },
    ]);
    expect(figures.taxMinor).toBe(2766);
    expect(figures.totalMinor).toBe(58078);
    expect(73750 - 18438 + 1383 + 1383).toBe(figures.totalMinor);
  });

  it("rounds the total GST once and splits CGST = floor(half), SGST = remainder on odd paisa (restiq-backend#244)", () => {
    // ₹778 with 10% off: net 70020, GST round(3501) = 3501 -> 1750 + 1751, TOTAL ₹735.21.
    const b = bill({ subtotalMinor: 77800, taxMinor: 3890, taxBreakdown: CGST_SGST, totalMinor: 81690 });
    const figures = billFigures(b, 7780);
    expect(figures.taxBreakdown?.map((line) => line.amountMinor)).toEqual([1750, 1751]);
    expect(figures.totalMinor).toBe(70020 + 3501);
  });

  it("backs GST out of the discounted price for a tax-inclusive (AU) bill", () => {
    // A$110 incl. 10% GST, A$11 off: net 9900, GST = 9900 - round(9900 / 1.1) = 900; total stays the net.
    const b = bill({ subtotalMinor: 11000, taxMinor: 1000, pricesIncludeTax: true, taxBreakdown: [{ label: "GST", ratePercent: 10, amountMinor: 1000 }], totalMinor: 11000 });
    expect(billFigures(b, 1100)).toEqual({ taxMinor: 900, taxBreakdown: [{ label: "GST", ratePercent: 10, amountMinor: 900 }], totalMinor: 9900 });
  });

  it("keeps the server's own figures with no pending discount, or once the bill has its discount", () => {
    const b = bill({ subtotalMinor: 73750, taxMinor: 3688, taxBreakdown: CGST_SGST, totalMinor: 77438 });
    expect(billFigures(b)).toEqual({ taxMinor: 3688, taxBreakdown: CGST_SGST, totalMinor: 77438 });
    const finalized = bill({ status: "finalized", discountMinor: 18438, taxMinor: 2766, totalMinor: 58078 });
    expect(billFigures(finalized, 18438).totalMinor).toBe(58078);
  });
});
