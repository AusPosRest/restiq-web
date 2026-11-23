// useMenuRefresh (restiq-web#374): an open till re-reads the menu when it
// comes back into view and every MENU_REFRESH_MS while it is visible.
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MENU_REFRESH_MS, useMenuRefresh } from "./use-menu-refresh";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useMenuRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });
  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("refreshes when the document becomes visible again", () => {
    const refresh = vi.fn();
    renderHook(() => useMenuRefresh(refresh));
    setVisibility("hidden");
    expect(refresh).not.toHaveBeenCalled();
    setVisibility("visible");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes every 30 s while visible, not while hidden", () => {
    const refresh = vi.fn();
    renderHook(() => useMenuRefresh(refresh));
    expect(MENU_REFRESH_MS).toBe(30_000);
    vi.advanceTimersByTime(MENU_REFRESH_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MENU_REFRESH_MS);
    expect(refresh).toHaveBeenCalledTimes(2);

    setVisibility("hidden");
    vi.advanceTimersByTime(MENU_REFRESH_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("stops listening and polling on unmount", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useMenuRefresh(refresh));
    unmount();
    vi.advanceTimersByTime(MENU_REFRESH_MS * 2);
    setVisibility("hidden");
    setVisibility("visible");
    expect(refresh).not.toHaveBeenCalled();
  });
});
