import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HUB_POLL_MS, useHubStatus } from "./use-hub-status";

const HUB = { online: true, lastSyncAt: null, outboxDepth: 0, mustSyncBefore: null, locked: false, lockReason: null, rejections: 0, orphans: 0 };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useHubStatus (W2)", () => {
  it("stays null and stops polling when the API answers 404 (not on a hub)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json(404, { error: { code: "not_found", message: "nope" } })));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useHubStatus());
    await act(() => vi.advanceTimersByTimeAsync(HUB_POLL_MS * 3));
    expect(result.current).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual(["/pos/api/hub/status", expect.anything()]);
  });

  it("does not poll while disabled (the PIN pad)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useHubStatus(false));
    await act(() => vi.advanceTimersByTimeAsync(HUB_POLL_MS * 2));
    expect(result.current).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("polls the hub every 10 s and keeps the last answer through a failed poll", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, HUB))
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(json(200, { ...HUB, online: false, outboxDepth: 3 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useHubStatus());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current?.online).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(HUB_POLL_MS));
    expect(result.current?.online).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(HUB_POLL_MS));
    expect(result.current).toMatchObject({ online: false, outboxDepth: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
