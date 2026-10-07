// Issue #214: tap to start posts outlet + device and lands on the menu; a
// refusal shows the backend's message and never navigates.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KioskStart } from "./kiosk-start";

const push = vi.fn();
let search = "device=dev-1";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  push.mockReset();
  search = "device=dev-1";
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("KioskStart", () => {
  it("starts a kiosk session for the outlet and device, then opens the menu", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ pin: "" })));
    vi.stubGlobal("fetch", fetchMock);
    render(<KioskStart outletId="out-1" />);

    await userEvent.click(screen.getByTestId("kiosk-start"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/qr/menu"));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/qr/auth/kiosk");
    expect(JSON.parse(String(init.body))).toEqual({ outletId: "out-1", deviceId: "dev-1" });
    // A tab opened from the console's "Open kiosk" link now remembers it is this kiosk.
    expect(JSON.parse(sessionStorage.getItem("device:enrolled") ?? "null")).toMatchObject({ id: "dev-1", outletId: "out-1", type: "kiosk" });
  });

  it("falls back to the tab's enrolled device when the URL has none", async () => {
    search = "";
    sessionStorage.setItem("device:enrolled", JSON.stringify({ id: "stored-dev", tenantId: "t", outletId: "out-1", label: "K", type: "kiosk", role: "terminal", status: "active", enrolledAt: "", revokedAt: null }));
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ pin: "" })));
    vi.stubGlobal("fetch", fetchMock);
    render(<KioskStart outletId="out-1" />);
    await userEvent.click(screen.getByTestId("kiosk-start"));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ outletId: "out-1", deviceId: "stored-dev" });
  });

  it("shows the backend's refusal and stays put", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "kiosk_disabled", message: "Kiosk ordering is not available at this outlet right now" } }, 403))));
    render(<KioskStart outletId="out-1" />);
    await userEvent.click(screen.getByTestId("kiosk-start"));
    expect((await screen.findByTestId("kiosk-start-error")).textContent).toContain("Kiosk ordering is not available");
    expect(push).not.toHaveBeenCalled();
    expect((screen.getByTestId("kiosk-start") as HTMLButtonElement).disabled).toBe(false);
  });

  it("explains when the tab is not enrolled at all", async () => {
    search = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<KioskStart outletId="out-1" />);
    await userEvent.click(screen.getByTestId("kiosk-start"));
    expect((await screen.findByTestId("kiosk-start-error")).textContent).toContain("isn't enrolled");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
