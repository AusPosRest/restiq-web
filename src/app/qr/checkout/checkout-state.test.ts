import { describe, expect, it } from "vitest";
import type { BillShareView, GuestBillView } from "./checkout-api";
import { canPayAll, findShare, formatRupees, isSettled, sortSharesOwnFirst } from "./checkout-state";

function share(overrides: Partial<BillShareView> = {}): BillShareView {
  return {
    guestId: "g1",
    guestName: "Ananya",
    amountMinor: 10500,
    status: "outstanding",
    payerPhone: null,
    paidAt: null,
    ...overrides,
  };
}

function bill(overrides: Partial<GuestBillView> = {}): GuestBillView {
  return {
    id: "b1",
    orderId: "o1",
    billNumber: null,
    subtotalMinor: 50000,
    taxMinor: 2500,
    discountMinor: null,
    discountReason: null,
    totalMinor: 52500,
    status: "open",
    createdAt: "2026-08-29T10:00:00.000Z",
    finalizedAt: null,
    tenders: [],
    shares: [],
    ...overrides,
  };
}

describe("formatRupees", () => {
  it("formats minor units with the rupee symbol and two decimals", () => {
    expect(formatRupees(52500)).toBe("₹525.00");
  });

  it("formats zero cleanly", () => {
    expect(formatRupees(0)).toBe("₹0.00");
  });
});

describe("findShare", () => {
  it("finds the share matching the given guestId", () => {
    const shares = [share({ guestId: "g1" }), share({ guestId: "g2" })];
    expect(findShare(shares, "g2")?.guestId).toBe("g2");
  });

  it("returns undefined when no share matches", () => {
    expect(findShare([share({ guestId: "g1" })], "g9")).toBeUndefined();
  });
});

describe("sortSharesOwnFirst", () => {
  it("puts the caller's own share first, everyone else after in their original order", () => {
    const shares = [share({ guestId: "g1", guestName: "Ananya" }), share({ guestId: "g2", guestName: "Rohan" }), share({ guestId: "g3", guestName: "Meera" })];
    const sorted = sortSharesOwnFirst(shares, "g2");
    expect(sorted.map((s) => s.guestId)).toEqual(["g2", "g1", "g3"]);
  });

  it("leaves the order unchanged when the caller isn't a billed guest at all", () => {
    const shares = [share({ guestId: "g1" }), share({ guestId: "g2" })];
    expect(sortSharesOwnFirst(shares, "unknown").map((s) => s.guestId)).toEqual(["g1", "g2"]);
  });
});

describe("canPayAll", () => {
  it("is true when every share is still outstanding", () => {
    expect(canPayAll([share({ status: "outstanding" }), share({ status: "outstanding" })])).toBe(true);
  });

  it("is false once any share is already paid individually - mirrors the backend's partial_payment_exists rule", () => {
    expect(canPayAll([share({ status: "paid" }), share({ status: "outstanding" })])).toBe(false);
  });

  it("is true for a bill with no shares yet", () => {
    expect(canPayAll([])).toBe(true);
  });
});

describe("isSettled", () => {
  it("is true once the bill has finalized", () => {
    expect(isSettled(bill({ status: "finalized" }))).toBe(true);
  });

  it("is false while the bill is still open", () => {
    expect(isSettled(bill({ status: "open" }))).toBe(false);
  });
});
