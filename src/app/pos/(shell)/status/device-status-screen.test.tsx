// Reconciled (restiq-web#98) against the real, merged restiq-backend
// `attendance.controller.ts`/`attendance.dtos.ts` contract: the route is
// `outlets/:outletId/attendance` (no `/today`), the response has no
// `clockOutAt` (only currently-clocked-in staff are ever listed) and no
// `device` object - just a top-level `printerStatus`.
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
  asOf: "2026-08-25T09:32:00.000Z",
  staff: [{ staffId: "s1", name: "Priya Nair", clockedInAt: "2026-08-25T03:32:00.000Z" }],
  printerStatus: { status: "connected", mocked: true },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DeviceStatusScreen", () => {
  it("renders the real clocked-in staff from the real backend response, with name and clock-in time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        expect(String(input)).toBe(`/pos/api/outlets/${OUTLET_ID}/attendance`);
        return Promise.resolve(jsonResponse(ATTENDANCE_VIEW));
      }),
    );

    render(<DeviceStatusScreen outletId={OUTLET_ID} />);

    expect(await screen.findByTestId("device-status-content")).toBeTruthy();
    expect(screen.getByTestId("attendance-row-s1").textContent).toContain("Priya Nair");
    expect(screen.getByTestId("attendance-row-s1").textContent).toContain("Clocked in");
  });

  it("shows the empty-attendance state when no one has clocked in today - never fabricated rows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...ATTENDANCE_VIEW, staff: [] })));

    render(<DeviceStatusScreen outletId={OUTLET_ID} />);

    expect(await screen.findByTestId("attendance-empty")).toBeTruthy();
    expect(screen.queryByTestId("attendance-list")).toBeNull();
  });

  it("shows only real status - the browser's own connectivity, no made-up printer or (demo) text (PE-19)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(ATTENDANCE_VIEW)));

    render(<DeviceStatusScreen outletId={OUTLET_ID} />);

    const connectivityPill = await screen.findByTestId("pos-connectivity-status-pill");
    expect(connectivityPill.textContent).toBe("Online");
    expect(screen.queryByTestId("pos-printer-status-chip")).toBeNull();
    expect(screen.getByTestId("device-status-content").textContent).not.toContain("(demo)");
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
