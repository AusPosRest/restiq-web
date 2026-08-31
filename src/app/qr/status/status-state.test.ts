import { describe, expect, it } from "vitest";
import type { GuestOrderStatusView } from "./status-api";
import { formatReachedAt, reachedAtFor, sortOrdersNewestFirst, stepState } from "./status-state";

function order(overrides: Partial<GuestOrderStatusView>): GuestOrderStatusView {
  return {
    orderId: "order-1",
    tableId: "table-1",
    step: "placed",
    steps: [
      { step: "placed", reachedAt: "2026-08-29T10:00:00.000Z" },
      { step: "accepted", reachedAt: null },
      { step: "preparing", reachedAt: null },
      { step: "ready", reachedAt: null },
    ],
    ...overrides,
  };
}

describe("stepState", () => {
  it("marks every step before the furthest step as done", () => {
    expect(stepState("placed", "preparing")).toBe("done");
    expect(stepState("accepted", "preparing")).toBe("done");
  });

  it("marks the furthest step as active", () => {
    expect(stepState("preparing", "preparing")).toBe("active");
    expect(stepState("placed", "placed")).toBe("active");
  });

  it("marks every step after the furthest step as upcoming", () => {
    expect(stepState("ready", "preparing")).toBe("upcoming");
    expect(stepState("accepted", "placed")).toBe("upcoming");
  });
});

describe("reachedAtFor", () => {
  it("returns the reachedAt for a matching step", () => {
    const o = order({ steps: [{ step: "placed", reachedAt: "2026-08-29T10:00:00.000Z" }] });
    expect(reachedAtFor(o, "placed")).toBe("2026-08-29T10:00:00.000Z");
  });

  it("returns null when the step hasn't been reached", () => {
    const o = order({ step: "placed" });
    expect(reachedAtFor(o, "ready")).toBeNull();
  });
});

describe("formatReachedAt", () => {
  it("returns null for a null timestamp", () => {
    expect(formatReachedAt(null)).toBeNull();
  });

  it("formats an ISO timestamp as a short local time", () => {
    const formatted = formatReachedAt("2026-08-29T10:32:00.000Z");
    expect(formatted).toEqual(expect.stringMatching(/\d{1,2}:\d{2}/));
  });
});

describe("sortOrdersNewestFirst", () => {
  it("sorts by the placed step's reachedAt, newest first", () => {
    const older = order({ orderId: "order-older", steps: [{ step: "placed", reachedAt: "2026-08-29T09:00:00.000Z" }] });
    const newer = order({ orderId: "order-newer", steps: [{ step: "placed", reachedAt: "2026-08-29T11:00:00.000Z" }] });
    const sorted = sortOrdersNewestFirst([older, newer]);
    expect(sorted.map((o) => o.orderId)).toEqual(["order-newer", "order-older"]);
  });

  it("does not mutate the input array", () => {
    const list = [order({ orderId: "a" }), order({ orderId: "b" })];
    const copy = [...list];
    sortOrdersNewestFirst(list);
    expect(list).toEqual(copy);
  });
});
