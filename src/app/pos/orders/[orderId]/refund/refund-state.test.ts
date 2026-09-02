// Pure-logic tests for P10 Refund & Adjustments (CAP-9, story 10). Mirrors
// the P10 mock's own numbers exactly (2 x Butter Naan @ Rs60 -> Rs120
// subtotal, Rs6 tax reversal at the combined 5% rate, Rs126 total) so a
// regression here is easy to spot against the design source of truth.
import { describe, expect, it } from "vitest";
import type { OrderLineView } from "../order-taking-state";
import type { BillTaxLineView } from "../settle/bill-state";
import {
  canRefundBill,
  computeRefundTotals,
  hasRefundSelection,
  setLineQuantity,
  toRefundLineInputs,
  toggleLineSelected,
} from "./refund-state";

const TAX_LINES: BillTaxLineView[] = [
  { label: "CGST", ratePercent: 2.5, amountMinor: 1800 },
  { label: "SGST", ratePercent: 2.5, amountMinor: 1800 },
];

function makeLine(overrides: Partial<OrderLineView> = {}): OrderLineView {
  return {
    id: "line-butter-naan",
    itemId: "item-butter-naan",
    itemName: "Butter Naan",
    variantId: null,
    variantName: null,
    quantity: 2,
    unitPriceMinor: 6000,
    modifiers: [],
    lineTotalMinor: 12000,
    addedByStaffId: "staff-1",
    seatNumber: null,
    ...overrides,
  };
}

describe("toggleLineSelected / setLineQuantity", () => {
  it("selecting a line defaults its quantity to the full original line quantity", () => {
    const line = makeLine();
    const selection = toggleLineSelected({}, line, true);
    expect(selection[line.id]).toBe(2);
  });

  it("deselecting a line removes it from the selection entirely", () => {
    const line = makeLine();
    const selected = toggleLineSelected({}, line, true);
    const deselected = toggleLineSelected(selected, line, false);
    expect(deselected[line.id]).toBeUndefined();
  });

  it("clamps the refund quantity to between 1 and the line's original quantity", () => {
    const line = makeLine({ quantity: 2 });
    expect(setLineQuantity({}, line, 0)[line.id]).toBe(1);
    expect(setLineQuantity({}, line, 5)[line.id]).toBe(2);
    expect(setLineQuantity({}, line, 1)[line.id]).toBe(1);
  });
});

describe("computeRefundTotals", () => {
  it("computes the correct partial-refund amount for a full-quantity selection, matching the P10 mock exactly", () => {
    const line = makeLine();
    const bill = { lines: [line], taxLines: TAX_LINES };
    const totals = computeRefundTotals(bill, { [line.id]: 2 });

    expect(totals.subtotalMinor).toBe(12000); // Rs120.00
    expect(totals.taxReversalMinor).toBe(600); // Rs6.00 (5% combined)
    expect(totals.totalMinor).toBe(12600); // Rs126.00
  });

  it("computes the correct partial-refund amount for a partial-quantity selection", () => {
    const line = makeLine();
    const bill = { lines: [line], taxLines: TAX_LINES };
    const totals = computeRefundTotals(bill, { [line.id]: 1 });

    expect(totals.subtotalMinor).toBe(6000); // Rs60.00
    expect(totals.taxReversalMinor).toBe(300); // Rs3.00
    expect(totals.totalMinor).toBe(6300); // Rs63.00
  });

  it("excludes unselected lines and lines selected with a zero quantity", () => {
    const naan = makeLine();
    const paneer = makeLine({ id: "line-paneer", itemName: "Paneer Tikka", quantity: 1, unitPriceMinor: 32000 });
    const bill = { lines: [naan, paneer], taxLines: TAX_LINES };

    const totals = computeRefundTotals(bill, { [naan.id]: 2, [paneer.id]: 0 });
    expect(totals.lines).toHaveLength(1);
    expect(totals.lines[0].line.id).toBe(naan.id);
  });
});

describe("hasRefundSelection / toRefundLineInputs", () => {
  it("reports no selection when every entry is zero or absent", () => {
    expect(hasRefundSelection({})).toBe(false);
    expect(hasRefundSelection({ "line-1": 0 })).toBe(false);
  });

  it("reports a selection once at least one line has a positive quantity", () => {
    expect(hasRefundSelection({ "line-1": 1 })).toBe(true);
  });

  it("converts the selection into the API's line-input shape, dropping zero entries", () => {
    expect(toRefundLineInputs({ "line-1": 2, "line-2": 0 })).toEqual([{ lineId: "line-1", quantity: 2 }]);
  });
});

describe("canRefundBill", () => {
  it("only allows refunding a finalised bill", () => {
    expect(canRefundBill({ status: "finalised" })).toBe(true);
    expect(canRefundBill({ status: "draft" })).toBe(false);
  });
});
