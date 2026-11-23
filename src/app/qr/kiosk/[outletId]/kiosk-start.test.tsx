// Issue #214: tap to start posts outlet + device and lands on the menu; a
// refusal shows the backend's message and never navigates.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEARTBEAT_MS } from "../../../pos/device-heartbeat";
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
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const HEARTBEAT_URL = "/qr/auth/kiosk/heartbeat";

/** The kiosk-start call, skipping the heartbeat that fires on mount (#389). */
function startCall(fetchMock: { mock: { calls: unknown[][] } }): [string, RequestInit] {
  return fetchMock.mock.calls.find((call) => call[0] === "/qr/auth/kiosk") as unknown as [string, RequestInit];
}

describe("KioskStart", () => {
  it("starts a kiosk session for the outlet and device, then opens the menu", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ pin: "" })));
    vi.stubGlobal("fetch", fetchMock);
    render(<KioskStart outletId="out-1" />);

    await userEvent.click(screen.getByTestId("kiosk-start"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/qr/menu"));
    const [, init] = startCall(fetchMock);
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
    expect(JSON.parse(String(startCall(fetchMock)[1].body))).toEqual({ outletId: "out-1", deviceId: "stored-dev" });
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

// Issue #389: the attract screen reports in every HEARTBEAT_MS, and a kiosk
// the owner removed (404 not_found) shows a plain notice instead of the start button.
describe("KioskStart heartbeat", () => {
  const REMOVED = { error: { code: "not_found", message: "No such outlet or kiosk" } };
  const heartbeats = (fetchMock: { mock: { calls: unknown[][] } }) => fetchMock.mock.calls.filter((call) => call[0] === HEARTBEAT_URL);

  async function flush() {
    await act(async () => undefined);
  }

  it("beats at once with the route's outlet and the URL's device, then on the interval", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<KioskStart outletId="out-1" />);
    await flush();
    expect(heartbeats(fetchMock)).toHaveLength(1);
    expect(JSON.parse(String((heartbeats(fetchMock)[0] as [string, RequestInit])[1].body))).toEqual({ outletId: "out-1", deviceId: "dev-1" });
    await act(async () => {
      vi.advanceTimersByTime(HEARTBEAT_MS);
    });
    expect(heartbeats(fetchMock)).toHaveLength(2);
  });

  it("swaps the start button for a removed notice on 404 not_found, and a later 204 brings it back", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(REMOVED, 404)));
    vi.stubGlobal("fetch", fetchMock);
    render(<KioskStart outletId="out-1" />);
    await flush();
    const notice = screen.getByTestId("kiosk-removed");
    expect(notice.getAttribute("role")).toBe("alert");
    expect(notice.textContent).toContain("This kiosk isn't in use");
    expect(screen.queryByTestId("kiosk-start")).toBeNull();

    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    await act(async () => {
      vi.advanceTimersByTime(HEARTBEAT_MS);
    });
    await flush();
    expect(screen.queryByTestId("kiosk-removed")).toBeNull();
    expect(screen.getByTestId("kiosk-start")).toBeTruthy();
  });

  it("does not treat an old backend's unknown-route 404 as removed", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "error", message: "Cannot POST /guest/v1/kiosk/heartbeat", statusCode: 404 } }, 404))));
    render(<KioskStart outletId="out-1" />);
    await flush();
    expect(screen.queryByTestId("kiosk-removed")).toBeNull();
    expect(screen.getByTestId("kiosk-start")).toBeTruthy();
  });

  it("keeps the last definite answer through a network error or a 5xx", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(REMOVED, 404)));
    vi.stubGlobal("fetch", fetchMock);
    render(<KioskStart outletId="out-1" />);
    await flush();
    expect(screen.getByTestId("kiosk-removed")).toBeTruthy();

    fetchMock.mockImplementation(() => Promise.reject(new TypeError("offline")));
    await act(async () => {
      vi.advanceTimersByTime(HEARTBEAT_MS);
    });
    await flush();
    expect(screen.getByTestId("kiosk-removed")).toBeTruthy();

    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ error: { code: "upstream_unreachable", message: "x" } }, 502)));
    await act(async () => {
      vi.advanceTimersByTime(HEARTBEAT_MS);
    });
    await flush();
    expect(screen.getByTestId("kiosk-removed")).toBeTruthy();
  });

  it("does not beat on a tab with no device at all", async () => {
    search = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<KioskStart outletId="out-1" />);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
