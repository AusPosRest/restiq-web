// Code Chip: the live TTL countdown ticks down and, on expiry, grays out and
// offers regenerate (EXPERIENCE.md O6).
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeChip, formatCountdown, secondsRemaining } from "./code-chip";

describe("secondsRemaining", () => {
  it("floors at zero and never goes negative", () => {
    const now = Date.parse("2026-08-24T12:00:00.000Z");
    expect(secondsRemaining("2026-08-24T12:15:00.000Z", now)).toBe(900);
    expect(secondsRemaining("2026-08-24T11:59:00.000Z", now)).toBe(0);
    expect(secondsRemaining("2026-08-24T12:00:00.000Z", now)).toBe(0);
  });
});

describe("formatCountdown", () => {
  it("formats as m:ss", () => {
    expect(formatCountdown(900)).toBe("15:00");
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(5)).toBe("0:05");
  });
});

describe("CodeChip", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("counts down live and shows the code", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    vi.setSystemTime(now);
    render(<CodeChip code="R7K-4PD" expiresAt="2026-08-24T12:15:00.000Z" onRegenerate={vi.fn()} />);

    expect(screen.getByTestId("code-chip-value").textContent).toBe("R7K-4PD");
    expect(screen.getByTestId("code-chip-countdown").textContent).toContain("15:00");
    expect(screen.queryByTestId("code-chip-expired")).toBeNull();
    expect(screen.queryByTestId("code-chip-regenerate")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByTestId("code-chip-countdown").textContent).toContain("13:59");
  });

  it("grays out and offers regenerate once expired", () => {
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    render(<CodeChip code="R7K-4PD" expiresAt="2026-08-24T12:00:05.000Z" onRegenerate={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(screen.getByTestId("code-chip-expired")).toBeTruthy();
    expect(screen.queryByTestId("code-chip-countdown")).toBeNull();
    expect(screen.getByTestId("code-chip-regenerate")).toBeTruthy();
  });

  it("calls onRegenerate when the regenerate button is clicked", () => {
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    const onRegenerate = vi.fn();
    render(<CodeChip code="R7K-4PD" expiresAt="2026-08-24T11:59:00.000Z" onRegenerate={onRegenerate} />);

    screen.getByTestId("code-chip-regenerate").click();
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it("disables regenerate and relabels it while regenerating", () => {
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    render(<CodeChip code="R7K-4PD" expiresAt="2026-08-24T11:59:00.000Z" onRegenerate={vi.fn()} regenerating />);

    const button = screen.getByTestId("code-chip-regenerate") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Regenerating");
  });
});
