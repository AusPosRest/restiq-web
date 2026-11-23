// usePosLoad's quiet refresh (restiq-web#374): a background re-fetch keeps
// what's on screen - no loading flash, no error panel - and retry() still
// drops the data and shows the loading state.
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePosLoad } from "./use-pos-load";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePosLoad", () => {
  it("refresh() keeps the data visible while refetching, then replaces it", async () => {
    let release: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ v: 1 }))
      .mockReturnValueOnce(new Promise<Response>((resolve) => (release = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePosLoad<{ v: number }>("menu"));
    await waitFor(() => expect(result.current.data).toEqual({ v: 1 }));

    act(() => result.current.refresh());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ v: 1 });

    await act(async () => release(jsonResponse({ v: 2 })));
    await waitFor(() => expect(result.current.data).toEqual({ v: 2 }));
    expect(result.current.loading).toBe(false);
    expect(result.current.failed).toBe(false);
  });

  it("refresh() keeps the old data when the refetch fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ v: 1 }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "down", message: "down" } }, 500));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePosLoad<{ v: number }>("menu"));
    await waitFor(() => expect(result.current.data).toEqual({ v: 1 }));

    await act(async () => result.current.refresh());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.data).toEqual({ v: 1 });
    expect(result.current.loading).toBe(false);
    expect(result.current.failed).toBe(false);
  });

  it("retry() still drops the data and shows the loading state", async () => {
    let release: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ v: 1 }))
      .mockReturnValueOnce(new Promise<Response>((resolve) => (release = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePosLoad<{ v: number }>("menu"));
    await waitFor(() => expect(result.current.data).toEqual({ v: 1 }));

    act(() => result.current.retry());
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await act(async () => release(jsonResponse({ v: 2 })));
    await waitFor(() => expect(result.current.data).toEqual({ v: 2 }));
  });
});
