import { describe, expect, it } from "vitest";
import type { CartLineView, PlacedOrderLineView, PlacedOrderView, TableCartView } from "./cart-api";
import { formatMinor, groupPlacedOrderLinesByGuest, isCartEmpty, isOwnLine } from "./cart-state";

function line(overrides: Partial<CartLineView> = {}): CartLineView {
  return {
    id: "l1",
    guestId: "g1",
    guestName: "Ananya",
    itemId: "i1",
    itemName: "Butter Chicken",
    variantId: null,
    variantName: null,
    quantity: 1,
    unitPriceMinor: 36000,
    modifiers: [],
    lineTotalMinor: 36000,
    createdAt: "2026-08-29T10:00:00.000Z",
    ...overrides,
  };
}

describe("formatMinor", () => {
  it("formats INR with the rupee symbol and two decimals", () => {
    expect(formatMinor(162750, "INR")).toBe("₹1627.50");
  });

  it("falls back to the currency code for an unrecognized currency", () => {
    expect(formatMinor(500, "USD")).toBe("USD 5.00");
  });
});

describe("isOwnLine", () => {
  it("is true when the line's guestId matches", () => {
    expect(isOwnLine(line({ guestId: "g1" }), "g1")).toBe(true);
  });

  it("is false for another guest's line", () => {
    expect(isOwnLine(line({ guestId: "g2" }), "g1")).toBe(false);
  });
});

describe("isCartEmpty", () => {
  function cart(guests: TableCartView["guests"]): TableCartView {
    return { sessionId: "s1", guests, totalMinor: 0, currency: "INR" };
  }

  it("is true when every guest has no lines", () => {
    expect(isCartEmpty(cart([{ guestId: "g1", guestName: "Ananya", lines: [], subtotalMinor: 0 }]))).toBe(true);
  });

  it("is true for a session with no guests yet", () => {
    expect(isCartEmpty(cart([]))).toBe(true);
  });

  it("is false when any guest has a line", () => {
    expect(isCartEmpty(cart([{ guestId: "g1", guestName: "Ananya", lines: [line()], subtotalMinor: 36000 }]))).toBe(false);
  });
});

describe("groupPlacedOrderLinesByGuest", () => {
  function placedLine(overrides: Partial<PlacedOrderLineView> = {}): PlacedOrderLineView {
    return {
      id: "ol1",
      itemId: "i1",
      itemName: "Butter Chicken",
      variantId: null,
      variantName: null,
      quantity: 2,
      unitPriceMinor: 34000,
      seatNumber: 1,
      guestId: "g1",
      guestName: "Ananya",
      modifiers: [],
      ...overrides,
    };
  }

  function placedOrder(lines: PlacedOrderLineView[]): PlacedOrderView {
    return { orderId: "o1", tableId: "t1", status: "sent", source: "qr", sessionId: "s1", lines };
  }

  it("groups lines under their adding guest, in first-appearance order", () => {
    const order = placedOrder([
      placedLine({ id: "ol1", guestId: "g1", guestName: "Ananya" }),
      placedLine({ id: "ol2", guestId: "g2", guestName: "Rohan", itemName: "Garlic Naan" }),
      placedLine({ id: "ol3", guestId: "g1", guestName: "Ananya", itemName: "Mango Lassi" }),
    ]);

    const groups = groupPlacedOrderLinesByGuest(order);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ guestId: "g1", guestName: "Ananya" });
    expect(groups[0].lines.map((l) => l.id)).toEqual(["ol1", "ol3"]);
    expect(groups[1]).toMatchObject({ guestId: "g2", guestName: "Rohan" });
    expect(groups[1].lines.map((l) => l.id)).toEqual(["ol2"]);
  });

  it("returns no groups for an order with no lines", () => {
    expect(groupPlacedOrderLinesByGuest(placedOrder([]))).toEqual([]);
  });
});
