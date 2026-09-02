// Pure-logic tests for P10 Refund & Adjustments (CAP-9, story 10), against
// the real, reconciled contract (restiq-web#98) - see refund-state.ts's file
// header. Tax reversal is bill-core.ts's own flat 5% placeholder
// (TAX_RATE_PLACEHOLDER_PERCENT), and a line's refundable per-unit amount
// includes its selected modifiers (bills.service.ts's refund(), read
// directly).
import { describe, expect, it } from "vitest";
import type { OrderLineView } from "../order-taking-state";
import {
  canRefundBill,
  computeRefundTotals,
  hasRefundSelection,
  setLineQuantity,
  toggleLineSelected,
  toRefundLineInputs,
} from "./refund-state";

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
  it("computes the refund amount for a full-quantity selection", () => {
    const line = makeLine();
    const totals = computeRefundTotals([line], { [line.id]: 2 });

    expect(totals.subtotalMinor).toBe(12000); // ₹120.00 (2 × ₹60)
    expect(totals.taxReversalMinor).toBe(600); // ₹6.00 (5% flat placeholder)
    expect(totals.totalMinor).toBe(12600); // ₹126.00
  });

  it("computes the refund amount for a partial-quantity selection", () => {
    const line = makeLine();
    const totals = computeRefundTotals([line], { [line.id]: 1 });

    expect(totals.subtotalMinor).toBe(6000);
    expect(totals.taxReversalMinor).toBe(300);
    expect(totals.totalMinor).toBe(6300);
  });

  it("folds a line's selected modifiers into its refundable unit price", () => {
    const line = makeLine({
      quantity: 1,
      unitPriceMinor: 6000,
      modifiers: [{ modifierId: "mod-extra-butter", name: "Extra butter", priceMinor: 2000 }],
    });
    const totals = computeRefundTotals([line], { [line.id]: 1 });

    expect(totals.subtotalMinor).toBe(8000); // ₹60 + ₹20 modifier
  });

  it("excludes unselected lines and lines selected with a zero quantity", () => {
    const naan = makeLine();
    const paneer = makeLine({ id: "line-paneer", itemName: "Paneer Tikka", quantity: 1, unitPriceMinor: 32000 });

    const totals = computeRefundTotals([naan, paneer], { [naan.id]: 2, [paneer.id]: 0 });
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

  it("converts the selection into the real RefundLineDto shape (orderLineId, not lineId), dropping zero entries", () => {
    expect(toRefundLineInputs({ "line-1": 2, "line-2": 0 })).toEqual([{ orderLineId: "line-1", quantity: 2 }]);
  });
});

describe("canRefundBill", () => {
  it("only allows refunding a finalized bill", () => {
    expect(canRefundBill({ status: "finalized" })).toBe(true);
    expect(canRefundBill({ status: "open" })).toBe(false);
  });
});
