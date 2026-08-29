import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATUS_POLL_MS, useStatusPoll } from "./use-status-poll";
import type { GuestOrderStatusView, GuestSessionOrdersView } from "./status-api";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function order(step: GuestOrderStatusView["step"]): GuestOrderStatusView {
  return {
    orderId: "order-1",
    tableId: "table-1",
    step,
    steps: [
      { step: "placed", reachedAt: "2026-08-29T10:00:00.000Z" },
      { step: "accepted", reachedAt: step === "placed" ? null : "2026-08-29T10:01:00.000Z" },
      { step: "preparing", reachedAt: step === "placed" ? null : "2026-08-29T10:01:00.000Z" },
      { step: "ready", reachedAt: step === "ready" ? "2026-08-29T10:15:00.000Z" : null },
    ],
  };
}

function sessionOrders(...orders: GuestOrderStatusView[]): GuestSessionOrdersView {
  return { sessionId: "s1", orders };
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("useStatusPoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("loads the session's orders on mount", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, sessionOrders(order("placed")))));
    const { result } = renderHook(() => useStatusPoll());
    await flush();

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(sessionOrders(order("placed")));
    expect(result.current.failed).toBe(false);
  });

  it("converges to a later poll's value ~5s later, in place", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, sessionOrders(order("placed"))))
      .mockResolvedValueOnce(jsonResponse(200, sessionOrders(order("preparing"))));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useStatusPoll());
    await flush();
    expect(result.current.data?.orders[0].step).toBe("placed");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_POLL_MS);
    });

    expect(result.current.data?.orders[0].step).toBe("preparing");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps last-known data and flags staleness when a later poll fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, sessionOrders(order("placed"))))
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useStatusPoll());
    await flush();
    expect(result.current.data).toEqual(sessionOrders(order("placed")));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_POLL_MS);
    });

    expect(result.current.data).toEqual(sessionOrders(order("placed")));
    expect(result.current.stale).toBe(true);
  });

  it("surfaces failed (not stale) when the very first load fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { result } = renderHook(() => useStatusPoll());
    await flush();

    expect(result.current.loading).toBe(false);
    expect(result.current.failed).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("flips to sessionClosed on a 410 and stops polling further", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, sessionOrders(order("placed"))))
      .mockResolvedValueOnce(jsonResponse(410, { error: { code: "session_closed", message: "This session has ended" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useStatusPoll());
    await flush();
    expect(result.current.data).toEqual(sessionOrders(order("placed")));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_POLL_MS);
    });
    expect(result.current.sessionClosed).toBe(true);
    const callsAtClose = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_POLL_MS * 3);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAtClose);
  });
});
