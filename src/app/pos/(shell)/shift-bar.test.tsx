import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShiftBar } from "./shift-bar";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const DISPLAY = { staff: { id: "s1", name: "Priya Nair" }, outlet: { id: "o1", name: "Spice Route - Indiranagar" } };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("ShiftBar", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("shows the staff name and outlet from the server-provided display, with no client fetch on mount", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ShiftBar initial={DISPLAY} />);

    expect(screen.getByTestId("pos-shift-bar-staff-name").textContent).toBe("Priya Nair");
    expect(screen.getByTestId("pos-shift-bar-clock-status").textContent).toBe("Spice Route - Indiranagar");
    expect(screen.getByTestId("pos-shift-bar-clock-out")).toBeTruthy();
    expect(screen.getByTestId("pos-shift-bar-shift-link")).toHaveProperty("href", expect.stringContaining("/pos/shift"));
    expect(screen.getByTestId("pos-shift-bar-status-link")).toHaveProperty("href", expect.stringContaining("/pos/status"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clocks out, signs out, and redirects to login", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "c1", type: "clock_out", occurredAt: "2026-08-25T09:00:00.000Z" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ShiftBar initial={DISPLAY} />);

    await userEvent.click(screen.getByTestId("pos-shift-bar-clock-out"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/pos/login"));
    const [clockOutUrl, clockOutInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(clockOutUrl).toBe("/pos/api/clock/out");
    expect(clockOutInit.method).toBe("POST");
    const [logoutUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(logoutUrl).toBe("/pos/auth/logout");
  });

  it("shows an inline error with retry when clocking out fails, without signing out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(409, { error: { code: "not_clocked_in", message: "You are not currently clocked in" } })),
    );
    render(<ShiftBar initial={DISPLAY} />);

    await userEvent.click(screen.getByTestId("pos-shift-bar-clock-out"));

    expect(await screen.findByTestId("pos-shift-bar-error")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs out and redirects to login without clocking out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    render(<ShiftBar initial={DISPLAY} />);

    await userEvent.click(screen.getByTestId("pos-shift-bar-sign-out"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/pos/login"));
  });

  it("falls back to a bare sign-out control if the display cookie is somehow missing", () => {
    render(<ShiftBar initial={null} />);
    expect(screen.queryByTestId("pos-shift-bar-staff-name")).toBeNull();
    expect(screen.getByTestId("pos-shift-bar-sign-out")).toBeTruthy();
  });
});
