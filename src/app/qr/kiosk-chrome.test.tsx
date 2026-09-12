// Issue #214: the kiosk chrome only exists on an enrolled kiosk tab, resets
// the session after IDLE_MS of no activity, and "Start over" does it at once.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_MS, KioskChrome, KioskFrame } from "./kiosk-chrome";

const replace = vi.fn();
let pathname = "/qr/menu";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname,
}));

const KIOSK = { id: "dev-1", tenantId: "t", outletId: "out-1", label: "K", type: "kiosk", role: "terminal", status: "active", enrolledAt: "", revokedAt: null };
const HOME = "/qr/kiosk/out-1?device=dev-1";

beforeEach(() => {
  replace.mockReset();
  pathname = "/qr/menu";
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("KioskChrome", () => {
  it("renders nothing on a tab that is not a kiosk", () => {
    render(<KioskChrome />);
    expect(screen.queryByTestId("kiosk-chrome")).toBeNull();
  });

  it("renders nothing on the attract screen even for a kiosk tab", async () => {
    sessionStorage.setItem("device:enrolled", JSON.stringify(KIOSK));
    pathname = "/qr/kiosk/out-1";
    render(<KioskChrome />);
    await act(async () => undefined);
    expect(screen.queryByTestId("kiosk-chrome")).toBeNull();
  });

  it("Start over ends the session and returns to the attract screen", async () => {
    sessionStorage.setItem("device:enrolled", JSON.stringify(KIOSK));
    render(<KioskChrome />);
    const button = await screen.findByTestId("kiosk-start-over");
    await act(async () => {
      button.click();
    });
    await act(async () => undefined);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe("/qr/auth/kiosk/end");
    expect(replace).toHaveBeenCalledWith(HOME);
  });

  it("resets after the idle timeout, but activity pushes the timeout back", async () => {
    vi.useFakeTimers();
    sessionStorage.setItem("device:enrolled", JSON.stringify(KIOSK));
    render(<KioskChrome />);
    await act(async () => undefined);
    expect(screen.getByTestId("kiosk-chrome")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(IDLE_MS - 1_000);
    });
    window.dispatchEvent(new Event("pointerdown"));
    await act(async () => {
      vi.advanceTimersByTime(IDLE_MS - 1_000);
    });
    expect(replace).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    await act(async () => undefined);
    expect(replace).toHaveBeenCalledWith(HOME);
  });

  it("sends a kiosk tab that lands on bare /qr back to its attract screen", async () => {
    sessionStorage.setItem("device:enrolled", JSON.stringify(KIOSK));
    pathname = "/qr";
    render(<KioskChrome />);
    await act(async () => undefined);
    expect(replace).toHaveBeenCalledWith(HOME);
  });

  it("KioskFrame draws the kiosk body, screen and hardware around the page on a kiosk tab", async () => {
    sessionStorage.setItem("device:enrolled", JSON.stringify(KIOSK));
    render(<KioskFrame><p data-testid="page">menu</p></KioskFrame>);
    await act(async () => undefined);
    const screenEl = screen.getByTestId("kiosk-screen");
    expect(screen.getByTestId("kiosk-device")).toBeTruthy();
    expect(screen.getByTestId("kiosk-hardware")).toBeTruthy();
    // The page renders inside the screen, under the kiosk bar.
    expect(screenEl.contains(screen.getByTestId("page"))).toBe(true);
    expect(screenEl.contains(screen.getByTestId("kiosk-chrome"))).toBe(true);
  });

  it("KioskFrame leaves a normal guest tab untouched", () => {
    render(<KioskFrame><p data-testid="page">menu</p></KioskFrame>);
    expect(screen.getByTestId("page")).toBeTruthy();
    expect(screen.queryByTestId("kiosk-device")).toBeNull();
    expect(screen.queryByTestId("kiosk-hardware")).toBeNull();
  });
});
