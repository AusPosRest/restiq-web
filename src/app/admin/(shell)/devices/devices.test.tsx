import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutletProvider } from "../outlet-context";
import { ToastProvider } from "../toast";
import { Devices } from "./devices";

const OUTLETS = [{ id: "outlet-1", name: "Indiranagar", address: "100 Ft Road", type: "dine_in", timezone: "Asia/Kolkata" }];

function devicesResponse() {
  return {
    devices: [
      { id: "d1", label: "Terminal 1", type: "pos", role: "hub", status: "active", appVersion: "v2.4.1", lastContactAt: "2026-08-24T11:58:00.000Z", enrolledAt: "2026-08-01T00:00:00.000Z", revokedAt: null },
    ],
  };
}

function floorPlanResponse() {
  return {
    floors: [],
    stations: [{ id: "s1", outletId: "outlet-1", name: "Billing", ageingThresholdMinutes: 10, primaryPrinterId: "p1", fallbackPrinterId: null }],
    printers: [{ id: "p1", outletId: "outlet-1", name: "Billing Counter", renderMode: "text" }],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/devices/enrolment-codes") && method === "POST") {
      return Promise.resolve(jsonResponse({ code: "R7K-4PD", deviceType: "pos", expiresAt: "2026-08-24T12:15:00.000Z" }));
    }
    if (url.includes("/outlets/outlet-1/devices")) return Promise.resolve(jsonResponse(devicesResponse()));
    if (url.includes("/floor-plan")) return Promise.resolve(jsonResponse(floorPlanResponse()));
    if (url.includes("/admin/api/outlets")) return Promise.resolve(jsonResponse(OUTLETS));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDevices() {
  return render(
    <ToastProvider>
      <OutletProvider>
        <Devices />
      </OutletProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  // Fakes Date only (not setTimeout/setInterval), so async findBy* polling -
  // which relies on real timers - still resolves while the code chip's
  // countdown reads a deterministic "now".
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Devices", () => {
  it("loads the outlet's devices and printers", async () => {
    stubFetch();
    renderDevices();

    expect(await screen.findByTestId("devices-row-d1")).toBeTruthy();
    expect(screen.getByTestId("printer-row-p1")).toBeTruthy();
    expect(screen.getByTestId("devices-no-active-code")).toBeTruthy();
  });

  it("generates an enrolment code and shows the live code chip in place of the empty state", async () => {
    stubFetch();
    renderDevices();
    await screen.findByTestId("devices-row-d1");

    await userEvent.click(screen.getByTestId("devices-generate-code"));
    await userEvent.click(screen.getByTestId("generate-code-submit"));

    const dialog = screen.getByTestId("generate-code-dialog");
    expect(await within(dialog).findByTestId("device-code-chip-value")).toHaveProperty("textContent", "R7K-4PD");
    await userEvent.click(screen.getByTestId("generate-code-done"));
    expect(screen.queryByTestId("devices-no-active-code")).toBeNull();
    expect(screen.getByTestId("device-code-chip-countdown").textContent).toContain("15:00");
  });
});
