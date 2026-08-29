import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { summarizeCart, useCartSummary, type TableCartView } from "./cart-summary";

function cart(overrides: Partial<TableCartView> = {}): TableCartView {
  return {
    sessionId: "s1",
    guests: [
      { guestId: "g1", guestName: "Ananya", lines: [{ quantity: 2 }, { quantity: 1 }], subtotalMinor: 96000 },
      { guestId: "g2", guestName: "Rohan", lines: [{ quantity: 1 }], subtotalMinor: 32000 },
    ],
    totalMinor: 128000,
    currency: "INR",
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("summarizeCart", () => {
  it("sums every guest's line quantities and carries the real total/currency", () => {
    expect(summarizeCart(cart())).toEqual({ count: 4, totalMinor: 128000, currency: "INR" });
  });

  it("summarizes an empty cart as zero", () => {
    expect(summarizeCart(cart({ guests: [], totalMinor: 0 }))).toEqual({ count: 0, totalMinor: 0, currency: "INR" });
  });
});

describe("useCartSummary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fetches the real cart on mount and exposes its summary", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, cart())));

    const { result } = renderHook(() => useCartSummary());

    await waitFor(() => expect(result.current.summary.count).toBe(4));
    expect(result.current.summary).toEqual({ count: 4, totalMinor: 128000, currency: "INR" });
  });

  it("keeps the last-known summary when a poll fails, rather than blanking it", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, cart())).mockResolvedValueOnce(jsonResponse(500, {}));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCartSummary());
    await waitFor(() => expect(result.current.summary.count).toBe(4));

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.summary.count).toBe(4);
  });
});
