// restiq-web#369 (AP-pe-6 / AP-se-20): with a discount pending, the CGST/SGST
// lines are on the discounted value, so discount + tax lines add up to TOTAL.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BillSummary } from "./bill-summary";
import type { BillView } from "./bill-state";

afterEach(cleanup);

const BILL: BillView = {
  id: "bill-1",
  orderId: "order-1",
  billNumber: null,
  status: "open",
  subtotalMinor: 73750,
  taxMinor: 3688,
  taxBreakdown: [
    { label: "CGST", ratePercent: 2.5, amountMinor: 1844 },
    { label: "SGST", ratePercent: 2.5, amountMinor: 1844 },
  ],
  discountMinor: null,
  discountReason: null,
  totalMinor: 77438,
  createdAt: "2026-10-12T10:00:00.000Z",
  finalizedAt: null,
  tenders: [],
};

describe("BillSummary - pending discount (restiq-web#369)", () => {
  it("shows CGST/SGST on the discounted value next to the discounted TOTAL", () => {
    render(<BillSummary bill={BILL} lines={[]} currency="INR" originLabel="T4" pendingDiscount={{ amountMinor: 18438, reason: "Regular guest" }} />);
    const summary = screen.getByTestId("bill-summary").textContent ?? "";
    expect(summary).toContain("-₹184.38");
    expect(summary).toContain("CGST (2.5%)₹13.83");
    expect(summary).toContain("SGST (2.5%)₹13.83");
    expect(summary).not.toContain("₹18.44");
    expect(screen.getByTestId("bill-grand-total").textContent).toBe("₹580.78");
  });
});
