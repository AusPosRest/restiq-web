import { describe, expect, it } from "vitest";
import {
  canFinalizeBill,
  DISCOUNT_MANAGER_APPROVAL_THRESHOLD_PERCENT,
  discountRequiresManagerApproval,
  isBillReadOnly,
  type BillView,
} from "./bill-state";

describe("discountRequiresManagerApproval", () => {
  it("does not require approval below the threshold", () => {
    expect(discountRequiresManagerApproval(DISCOUNT_MANAGER_APPROVAL_THRESHOLD_PERCENT - 1)).toBe(false);
  });

  it("requires approval exactly at the threshold", () => {
    expect(discountRequiresManagerApproval(DISCOUNT_MANAGER_APPROVAL_THRESHOLD_PERCENT)).toBe(true);
  });

  it("requires approval above the threshold", () => {
    expect(discountRequiresManagerApproval(DISCOUNT_MANAGER_APPROVAL_THRESHOLD_PERCENT + 5)).toBe(true);
  });
});

function bill(overrides: Partial<BillView>): BillView {
  return {
    id: "bill-1",
    billNumber: "TN1-000001",
    orderId: "order-1",
    tableLabel: "T4",
    currency: "INR",
    status: "draft",
    lines: [],
    subtotalMinor: 100000,
    discount: null,
    taxLines: [],
    roundOffMinor: 0,
    grandTotalMinor: 100000,
    tenders: [],
    tenderedMinor: 0,
    remainingMinor: 100000,
    finalisedAt: null,
    ...overrides,
  };
}

describe("canFinalizeBill", () => {
  it("is false while tenders fall short of the grand total", () => {
    expect(canFinalizeBill(bill({ tenderedMinor: 50000, grandTotalMinor: 100000 }))).toBe(false);
  });

  it("is true once tenders exactly cover the grand total", () => {
    expect(canFinalizeBill(bill({ tenderedMinor: 100000, grandTotalMinor: 100000 }))).toBe(true);
  });

  it("is false when tenders exceed the grand total (never silently over-settles)", () => {
    expect(canFinalizeBill(bill({ tenderedMinor: 150000, grandTotalMinor: 100000 }))).toBe(false);
  });

  it("is false once the bill is already finalised", () => {
    expect(canFinalizeBill(bill({ status: "finalised", tenderedMinor: 100000, grandTotalMinor: 100000 }))).toBe(false);
  });
});

describe("isBillReadOnly", () => {
  it("is false for a draft bill", () => {
    expect(isBillReadOnly(bill({ status: "draft" }))).toBe(false);
  });

  it("is true for a finalised bill", () => {
    expect(isBillReadOnly(bill({ status: "finalised" }))).toBe(true);
  });
});
