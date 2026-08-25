import { describe, expect, it } from "vitest";
import { elapsedLabel, isOwnOrder, originLabel, summarize, type OpenOrderEntry } from "./open-orders-state";

function order(overrides: Partial<OpenOrderEntry> = {}): OpenOrderEntry {
  return {
    id: "order-1",
    origin: "table",
    tableLabel: "T4",
    ownerStaffId: "staff-priya",
    ownerStaffName: "Priya",
    status: "open",
    openedAt: new Date().toISOString(),
    itemCount: null,
    totalMinor: null,
    ...overrides,
  };
}

describe("isOwnOrder", () => {
  it("is true when the order's owner matches the current staff id", () => {
    expect(isOwnOrder(order({ ownerStaffId: "staff-me" }), "staff-me")).toBe(true);
  });

  it("is false for someone else's order", () => {
    expect(isOwnOrder(order({ ownerStaffId: "staff-priya" }), "staff-me")).toBe(false);
  });
});

describe("originLabel", () => {
  it("labels a table order with its table", () => {
    expect(originLabel(order({ origin: "table", tableLabel: "T9" }))).toBe("Table T9");
  });

  it("labels a counter order without a table", () => {
    expect(originLabel(order({ origin: "counter", tableLabel: null }))).toBe("Counter");
  });
});

describe("elapsedLabel", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");

  it("renders minutes under an hour", () => {
    expect(elapsedLabel(new Date("2026-08-25T11:52:00.000Z").toISOString(), now)).toBe("8m");
  });

  it("renders whole hours with no remainder", () => {
    expect(elapsedLabel(new Date("2026-08-25T10:00:00.000Z").toISOString(), now)).toBe("2h");
  });

  it("renders hours and minutes together", () => {
    expect(elapsedLabel(new Date("2026-08-25T09:45:00.000Z").toISOString(), now)).toBe("2h 15m");
  });

  it("never goes negative for a future timestamp (clock skew)", () => {
    expect(elapsedLabel(new Date("2026-08-25T12:05:00.000Z").toISOString(), now)).toBe("0m");
  });
});

describe("summarize", () => {
  it("sums totals when every order has one", () => {
    const orders = [order({ totalMinor: 100000 }), order({ id: "order-2", totalMinor: 50000 })];
    expect(summarize(orders)).toEqual({ count: 2, totalMinor: 150000 });
  });

  it("reports no total if any order is missing one (no partial/misleading sum)", () => {
    const orders = [order({ totalMinor: 100000 }), order({ id: "order-2", totalMinor: null })];
    expect(summarize(orders)).toEqual({ count: 2, totalMinor: null });
  });

  it("handles an empty list as a true zero, not a missing value", () => {
    expect(summarize([])).toEqual({ count: 0, totalMinor: 0 });
  });
});
