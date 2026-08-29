import { describe, expect, it } from "vitest";
import type { CartLineView, TableCartView } from "./cart-api";
import { formatMinor, isCartEmpty, isOwnLine } from "./cart-state";

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
