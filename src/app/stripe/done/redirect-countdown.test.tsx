import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedirectCountdown } from "./redirect-countdown";

describe("RedirectCountdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("counts down each second, then replaces the page", () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });
    render(<RedirectCountdown href="/ops/tenants/t1?tab=payments" seconds={3} />);
    expect(screen.getByTestId("stripe-done-countdown").textContent).toBe("Taking you back in 3…");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId("stripe-done-countdown").textContent).toBe("Taking you back in 2…");
    act(() => vi.advanceTimersByTime(1000));
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(replace).toHaveBeenCalledWith("/ops/tenants/t1?tab=payments");
    expect(screen.getByTestId("stripe-done-go").getAttribute("href")).toBe("/ops/tenants/t1?tab=payments");
  });
});
