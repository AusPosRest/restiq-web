import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceStatusScreen } from "./device-status-screen";

const OUTLET_ID = "outlet-1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const ATTENDANCE_VIEW = {
  outletId: OUTLET_ID,
  staff: [
    { staffId: "s1", staffName: "Priya Nair", clockInAt: "2026-08-25T03:32:00.000Z", clockOutAt: null },
    { staffId: "s2", staffName: "Ravi Kumar", clockInAt: "2026-08-25T02:00:00.000Z", clockOutAt: "2026-08-25T09:00:00.000Z" },
  ],
  device: { printer: "connected", connectivity: "online" },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DeviceStatusScreen", () => {
  it("renders the real clocked-in staff from the mocked backend response, with name and clock-in time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        expect(String(input)).toBe(`/pos/api/outlets/${OUTLET_ID}/attendance/today`);
        return Promise.resolve(jsonResponse(ATTENDANCE_VIEW));
      }),
    );

    render(<DeviceStatusScreen outletId={OUTLET_ID} />);

    expect(await screen.findByTestId("device-status-content")).toBeTruthy();
    expect(screen.getByTestId("attendance-row-s1").textContent).toContain("Priya Nair");
    expect(screen.getByTestId("attendance-row-s1").textContent).toContain("Clocked in");
    expect(screen.getByTestId("attendance-row-s2").textContent).toContain("Ravi Kumar");
    expect(screen.getByTestId("attendance-row-s2").textContent).toContain("Out");
  });

  it("shows the empty-attendance state when no one has clocked in today - never fabricated rows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...ATTENDANCE_VIEW, staff: [] })));

    render(<DeviceStatusScreen outletId={OUTLET_ID} />);

    expect(await screen.findByTestId("attendance-empty")).toBeTruthy();
    expect(screen.queryByTestId("attendance-list")).toBeNull();
  });

  it("visibly marks the mocked device status as a placeholder in the DOM, not just a code comment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(ATTENDANCE_VIEW)));

    render(<DeviceStatusScreen outletId={OUTLET_ID} />);

    const printerChip = await screen.findByTestId("pos-printer-status-chip");
    const connectivityPill = screen.getByTestId("pos-connectivity-status-pill");
    expect(printerChip.textContent).toContain("(demo)");
    expect(connectivityPill.textContent).toContain("(demo)");
    expect(printerChip.getAttribute("title")).toContain("Mocked");
    expect(connectivityPill.getAttribute("title")).toContain("Mocked");
  });

  it("shows an inline error with retry when the load fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "error", message: "boom" } }, 500))
      .mockResolvedValueOnce(jsonResponse(ATTENDANCE_VIEW));
    vi.stubGlobal("fetch", fetchMock);

    render(<DeviceStatusScreen outletId={OUTLET_ID} />);

    expect(await screen.findByTestId("device-status-load-error")).toBeTruthy();
    await userEvent.click(screen.getByTestId("device-status-load-error-retry"));

    expect(await screen.findByTestId("device-status-content")).toBeTruthy();
  });
});
