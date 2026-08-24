// Mirrors ops's code-chip.test.tsx (same timer math, same fake-timer
// pattern) - kept as a separate file since the component itself is mirrored,
// not imported, across the ops/admin route split (AD-4).
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeChip } from "./code-chip";

describe("CodeChip", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("counts down live and shows the code", () => {
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    render(<CodeChip code="R7K-4PD" expiresAt="2026-08-24T12:15:00.000Z" onRegenerate={vi.fn()} />);

    expect(screen.getByTestId("device-code-chip-value").textContent).toBe("R7K-4PD");
    expect(screen.getByTestId("device-code-chip-countdown").textContent).toContain("15:00");
    expect(screen.queryByTestId("device-code-chip-expired")).toBeNull();
    expect(screen.queryByTestId("device-code-chip-regenerate")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByTestId("device-code-chip-countdown").textContent).toContain("13:59");
  });

  it("grays out and offers regenerate once expired", () => {
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    render(<CodeChip code="R7K-4PD" expiresAt="2026-08-24T12:00:05.000Z" onRegenerate={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(screen.getByTestId("device-code-chip-expired")).toBeTruthy();
    expect(screen.queryByTestId("device-code-chip-countdown")).toBeNull();
    expect(screen.getByTestId("device-code-chip-regenerate")).toBeTruthy();
  });

  it("calls onRegenerate when the regenerate button is clicked", () => {
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    const onRegenerate = vi.fn();
    render(<CodeChip code="R7K-4PD" expiresAt="2026-08-24T11:59:00.000Z" onRegenerate={onRegenerate} />);

    screen.getByTestId("device-code-chip-regenerate").click();
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it("disables regenerate and relabels it while regenerating", () => {
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    render(<CodeChip code="R7K-4PD" expiresAt="2026-08-24T11:59:00.000Z" onRegenerate={vi.fn()} regenerating />);

    const button = screen.getByTestId("device-code-chip-regenerate") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Regenerating");
  });
});
