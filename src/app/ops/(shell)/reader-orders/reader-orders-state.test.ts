import { describe, expect, it } from "vitest";
import { actionsFor, orderPatch, ordersPath, parseOrderFilter } from "./reader-orders-state";

describe("reader-orders-state", () => {
  it("only moves forward, and cancels only before shipping", () => {
    expect(actionsFor("paid")).toEqual(["ordered", "cancelled"]);
    expect(actionsFor("ordered")).toEqual(["shipped", "cancelled"]);
    expect(actionsFor("shipped")).toEqual(["delivered"]);
    expect(actionsFor("delivered")).toEqual([]);
    expect(actionsFor("cancelled")).toEqual([]);
    expect(actionsFor("payment_failed")).toEqual([]);
  });

  it("sends tracking only when shipping and typed", () => {
    expect(orderPatch("shipped", "sent", " AP123 ")).toEqual({ status: "shipped", reason: "sent", trackingRef: "AP123" });
    expect(orderPatch("shipped", "sent", "  ")).toEqual({ status: "shipped", reason: "sent" });
    expect(orderPatch("ordered", "placed", "AP123")).toEqual({ status: "ordered", reason: "placed" });
  });

  it("defaults the filter to orders that need action", () => {
    expect(parseOrderFilter(null)).toBe("paid");
    expect(parseOrderFilter("junk")).toBe("paid");
    expect(parseOrderFilter("shipped")).toBe("shipped");
    expect(parseOrderFilter("all")).toBe("");
    expect(ordersPath("")).toBe("reader-orders");
    expect(ordersPath("paid")).toBe("reader-orders?status=paid");
  });
});
