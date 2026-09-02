import { describe, expect, it } from "vitest";
import { elapsedLabel, isOwnOrder, originLabel, summarize, toOpenOrderEntry, type OpenOrderEntry, type RawOpenOrder } from "./open-orders-state";

function order(overrides: Partial<OpenOrderEntry> = {}): OpenOrderEntry {
  return {
    id: "order-1",
    origin: "table",
    tableLabel: "table-9",
    ownerStaffId: "staff-priya",
    status: "open",
    openedAt: new Date().toISOString(),
    itemCount: 0,
    totalMinor: 0,
    ...overrides,
  };
}

function rawOrder(overrides: Partial<RawOpenOrder> = {}): RawOpenOrder {
  return {
    id: "order-1",
    tableId: "table-9",
    tableLabel: "T9",
    ownerId: "staff-priya",
    status: "open",
    createdAt: new Date().toISOString(),
    lines: [],
    ...overrides,
  };
}

describe("toOpenOrderEntry", () => {
  it("maps a table order using the real tableLabel, never the raw table id (regression for #96)", () => {
    const entry = toOpenOrderEntry(rawOrder({ tableId: "table-9", tableLabel: "T9" }));
    expect(entry.origin).toBe("table");
    expect(entry.tableLabel).toBe("T9");
  });

  it("falls back to the raw table id only if tableLabel is somehow missing, never the other way round", () => {
    const entry = toOpenOrderEntry(rawOrder({ tableId: "table-9", tableLabel: null }));
    expect(entry.tableLabel).toBe("table-9");
  });

  it("maps a counter order (null tableId) with no table label", () => {
    const entry = toOpenOrderEntry(rawOrder({ tableId: null, tableLabel: null }));
    expect(entry.origin).toBe("counter");
    expect(entry.tableLabel).toBeNull();
  });

  it("carries the raw owner id through unchanged (no staff-name lookup exists server-side yet)", () => {
    expect(toOpenOrderEntry(rawOrder({ ownerId: "staff-priya" })).ownerStaffId).toBe("staff-priya");
  });

  it("sums line quantities into itemCount, zero (not null) when there are no lines", () => {
    expect(toOpenOrderEntry(rawOrder({ lines: [] })).itemCount).toBe(0);
    expect(
      toOpenOrderEntry(
        rawOrder({
          lines: [
            { quantity: 2, unitPriceMinor: 10000, modifiers: [] },
            { quantity: 1, unitPriceMinor: 5000, modifiers: [] },
          ],
        }),
      ).itemCount,
    ).toBe(3);
  });

  it("sums quantity * (unitPriceMinor + modifiers) into totalMinor", () => {
    const entry = toOpenOrderEntry(
      rawOrder({
        lines: [
          { quantity: 2, unitPriceMinor: 10000, modifiers: [{ priceMinor: 2000 }] },
          { quantity: 1, unitPriceMinor: 5000, modifiers: [] },
        ],
      }),
    );
    expect(entry.totalMinor).toBe(2 * (10000 + 2000) + 5000);
  });
});

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
  it("sums totals across every order", () => {
    const orders = [order({ totalMinor: 100000 }), order({ id: "order-2", totalMinor: 50000 })];
    expect(summarize(orders)).toEqual({ count: 2, totalMinor: 150000 });
  });

  it("handles an empty list as a true zero, not a missing value", () => {
    expect(summarize([])).toEqual({ count: 0, totalMinor: 0 });
  });
});
