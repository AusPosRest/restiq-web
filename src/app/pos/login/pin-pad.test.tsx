import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PinPad } from "./pin-pad";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function typePin(digits: string) {
  for (const digit of digits) {
    await userEvent.click(screen.getByTestId(`pos-pin-digit-${digit}`));
  }
}

describe("PinPad", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("renders the keypad and four empty PIN dots", () => {
    render(<PinPad nextPath="/pos" />);
    expect(screen.getByTestId("pos-pin-pad")).toBeTruthy();
    for (let i = 0; i < 4; i++) {
      expect(screen.getByTestId(`pos-pin-dot-${i}`).className).not.toContain("bg-primary");
    }
    for (const digit of "0123456789") {
      expect(screen.getByTestId(`pos-pin-digit-${digit}`)).toBeTruthy();
    }
    expect(screen.getByTestId("pos-pin-backspace")).toBeTruthy();
  });

  it("auto-submits at 4 digits and redirects on a correct PIN", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { status: "authenticated", staff: { id: "s1", name: "Priya" }, outlet: { id: "o1", name: "Spice Route" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<PinPad nextPath="/pos" />);

    await typePin("1234");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/pos"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/pos/auth/login");
    expect(JSON.parse(init.body as string)).toEqual({ pin: "1234" });
  });

  it("shows an inline error on a wrong PIN and clears the dots", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { code: "invalid_pin", message: "Incorrect tenant or PIN" })));
    render(<PinPad nextPath="/pos" />);

    await typePin("9999");

    const error = await screen.findByTestId("pos-pin-error");
    expect(error.textContent).toBe("Incorrect tenant or PIN");
    expect(screen.getByTestId("pos-pin-dot-0").className).not.toContain("bg-primary");
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows the outlet picker only when the backend requires outlet selection, then resubmits to select-outlet with the pendingToken", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: "select_outlet",
          pendingToken: "pending-jwt",
          staff: { id: "s1", name: "Priya" },
          outlets: [
            { id: "o1", name: "Spice Route - Indiranagar" },
            { id: "o2", name: "Spice Route - Koramangala" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { status: "authenticated", staff: { id: "s1", name: "Priya" }, outlet: { id: "o2", name: "Spice Route - Koramangala" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<PinPad nextPath="/pos" />);

    expect(screen.queryByTestId("pos-outlet-picker")).toBeNull();

    await typePin("1234");

    const picker = await screen.findByTestId("pos-outlet-picker");
    expect(picker).toBeTruthy();
    expect(screen.getByTestId("pos-outlet-o1")).toBeTruthy();
    expect(screen.getByTestId("pos-outlet-o2")).toBeTruthy();

    await userEvent.click(screen.getByTestId("pos-outlet-o2"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/pos"));
    const [url, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/pos/auth/select-outlet");
    expect(JSON.parse(secondInit.body as string)).toEqual({ pendingToken: "pending-jwt", outletId: "o2" });
  });

  it("shows a live lockout countdown after 5 wrong attempts and re-enables the keypad once it expires", async () => {
    // The real backend's 429 carries no lockedUntil (see pin-pad.tsx's file
    // header) - the countdown is timed off this tab's own clock the moment
    // the response arrives, so mocking Date.now around a fixed window keeps
    // this deterministic without waiting out a real 30s.
    const nowSpy = vi.spyOn(Date, "now");
    const start = Date.now();
    nowSpy.mockImplementation(() => start);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(429, { code: "locked_out", message: "Too many attempts" })));
    render(<PinPad nextPath="/pos" />);

    await typePin("0000");

    expect(await screen.findByTestId("pos-pin-locked")).toBeTruthy();
    expect(screen.getByTestId("pos-pin-lockout-countdown").textContent).toBe("30s");

    nowSpy.mockImplementation(() => start + 31_000);
    await waitFor(() => expect(screen.queryByTestId("pos-pin-locked")).toBeNull(), { timeout: 2000 });
    expect(screen.getByTestId("pos-pin-pad")).toBeTruthy();
    expect(screen.getByTestId("pos-pin-digit-1")).toBeTruthy();
    nowSpy.mockRestore();
  });
});
