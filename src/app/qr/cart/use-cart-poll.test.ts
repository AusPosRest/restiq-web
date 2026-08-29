import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_POLL_MS, useCartPoll } from "./use-cart-poll";
import type { TableCartView } from "./cart-api";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function cart(totalMinor: number): TableCartView {
  return { sessionId: "s1", guests: [], totalMinor, currency: "INR" };
}

// waitFor polls via a (now-faked) setInterval, so it never resolves under
// fake timers - flush pending microtasks with a 0ms fake-timer advance
// instead, same discipline that advancing by CART_POLL_MS uses for the
// interval tick itself.
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("useCartPoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("loads the cart on mount", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, cart(100))));
    const { result } = renderHook(() => useCartPoll());
    await flush();

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(cart(100));
    expect(result.current.failed).toBe(false);
  });

  it("converges to a later poll's value ~5s later, in place (no reload flicker)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, cart(100))).mockResolvedValueOnce(jsonResponse(200, cart(250)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCartPoll());
    await flush();

    expect(result.current.data).toEqual(cart(100));
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CART_POLL_MS);
    });

    expect(result.current.data).toEqual(cart(250));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps last-known data and flags staleness when a later poll fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, cart(100))).mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCartPoll());
    await flush();
    expect(result.current.data).toEqual(cart(100));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CART_POLL_MS);
    });

    expect(result.current.data).toEqual(cart(100));
    expect(result.current.stale).toBe(true);
  });

  it("surfaces failed (not stale) when the very first load fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { result } = renderHook(() => useCartPoll());
    await flush();

    expect(result.current.loading).toBe(false);
    expect(result.current.failed).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("flips to sessionClosed on a 410 and stops polling further", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, cart(100)))
      .mockResolvedValueOnce(jsonResponse(410, { error: { code: "session_closed", message: "This session has ended" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCartPoll());
    await flush();
    expect(result.current.data).toEqual(cart(100));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CART_POLL_MS);
    });
    expect(result.current.sessionClosed).toBe(true);
    const callsAtClose = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CART_POLL_MS * 3);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAtClose);
  });

  it("applyUpdate pushes a mutation's response in immediately", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, cart(100))));
    const { result } = renderHook(() => useCartPoll());
    await flush();
    expect(result.current.data).toEqual(cart(100));

    act(() => result.current.applyUpdate(cart(999)));
    expect(result.current.data).toEqual(cart(999));
  });
});
