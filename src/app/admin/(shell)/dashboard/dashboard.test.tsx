import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "./dashboard";
import type { DashboardView } from "./dashboard-state";

const NO_DATA = { amountMinor: 0, currency: "INR", hasData: false, message: "No sales data yet - connect POS to see live figures" };

const MULTI_OUTLET: DashboardView = {
  asOf: "2026-08-24T09:05:00.000Z",
  tenant: { outletCount: 2, staffCount: 12, menuItemCount: 84, deviceCount: 7 },
  outlets: [
    {
      outletId: "o1",
      outletName: "Indiranagar",
      sales: { amountMinor: 8432000, currency: "INR", hasData: true, message: "" },
      margin: { amountMinor: 2396288, currency: "INR", hasData: true, message: "" },
      labourCost: { amountMinor: 1200000, currency: "INR", hasData: true, message: "" },
      waste: { amountMinor: 124000, currency: "INR", hasData: true, message: "" },
    },
    {
      outletId: "o2",
      outletName: "Koramangala",
      sales: NO_DATA,
      margin: NO_DATA,
      labourCost: NO_DATA,
      waste: NO_DATA,
    },
  ],
};

const SINGLE_OUTLET: DashboardView = {
  asOf: "2026-08-24T09:05:00.000Z",
  tenant: { outletCount: 1, staffCount: 3, menuItemCount: 20, deviceCount: 2 },
  outlets: [
    {
      outletId: "o1",
      outletName: "Whitefield",
      sales: NO_DATA,
      margin: NO_DATA,
      labourCost: NO_DATA,
      waste: NO_DATA,
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(view: DashboardView) {
  const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(view)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Dashboard", () => {
  it("shows a loading skeleton, then real counts for outlets/staff/menu items/devices", async () => {
    stubFetch(MULTI_OUTLET);
    render(<Dashboard />);
    expect(screen.getByTestId("dashboard-loading")).toBeTruthy();

    expect((await screen.findByTestId("dashboard-count-outlets-value")).textContent).toBe("2");
    expect(screen.getByTestId("dashboard-count-staff-value").textContent).toBe("12");
    expect(screen.getByTestId("dashboard-count-menu-items-value").textContent).toBe("84");
    expect(screen.getByTestId("dashboard-count-devices-value").textContent).toBe("7");
  });

  it("shows a retryable error panel when loading fails", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ error: { code: "error", message: "nope" } }, 500)));
    vi.stubGlobal("fetch", fetchMock);
    render(<Dashboard />);

    await screen.findByTestId("dashboard-load-error");
    await userEvent.click(screen.getByTestId("dashboard-load-error-retry"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renders real figures for an outlet with sales data, and the honest no-data state for one without", async () => {
    stubFetch(MULTI_OUTLET);
    render(<Dashboard />);
    await screen.findByTestId("dashboard-count-outlets-value");

    expect(screen.getByTestId("outlet-kpi-o1-sales-value").textContent).toBe("₹84320");
    expect(screen.getByTestId("outlet-kpi-o1-margin-value").textContent).toBe("₹23963");
    expect(screen.getByTestId("outlet-kpi-o1-labour-value").textContent).toBe("₹12000");
    expect(screen.getByTestId("outlet-kpi-o1-waste-value").textContent).toBe("₹1240");
    expect(screen.queryByTestId("outlet-kpi-o1-sales-empty")).toBeNull();

    const noDataTile = screen.getByTestId("outlet-kpi-o2-sales-empty");
    expect(noDataTile.textContent).toContain("No sales data yet.");
    expect(noDataTile.textContent).toContain("Connect POS to see live figures.");
    expect(screen.getByTestId("outlet-kpi-o2-margin-empty")).toBeTruthy();
    expect(screen.getByTestId("outlet-kpi-o2-labour-empty")).toBeTruthy();
    expect(screen.getByTestId("outlet-kpi-o2-waste-empty")).toBeTruthy();
    expect(screen.queryByTestId("outlet-kpi-o2-sales-value")).toBeNull();
  });

  it("renders a cross-outlet comparison table with real and honest no-data cells side by side", async () => {
    stubFetch(MULTI_OUTLET);
    render(<Dashboard />);
    const table = await screen.findByTestId("dashboard-comparison-table");

    const row1 = within(table).getByTestId("dashboard-comparison-row-o1");
    expect(within(row1).getByTestId("dashboard-comparison-o1-sales").textContent).toBe("₹84320");
    const row2 = within(table).getByTestId("dashboard-comparison-row-o2");
    expect(within(row2).getByTestId("dashboard-comparison-o2-sales").textContent).toBe("No data yet");
  });

  it("does not render the comparison table for a single-outlet tenant", async () => {
    stubFetch(SINGLE_OUTLET);
    render(<Dashboard />);
    await screen.findByTestId("dashboard-count-outlets-value");

    expect(screen.queryByTestId("dashboard-comparison-table")).toBeNull();
  });

  it("formats the freshness badge as-of time - always live, since the backend computes it fresh on every request", async () => {
    // formatAsOf's bare-time vs. dated format depends on whether `asOf` is
    // "today" - pin the clock to the fixture's own day so this doesn't
    // silently flip format (and fail) once the real date moves on.
    // Fake only Date, not timers - RTL's findBy*/waitFor polling relies on
    // real setTimeout/setInterval and would hang under a fully-faked clock.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    try {
      stubFetch(MULTI_OUTLET);
      render(<Dashboard />);

      const badge = await screen.findByTestId("dashboard-freshness-badge");
      expect(badge.textContent).toContain("As of 9:05am");
      expect(badge.getAttribute("data-stale")).toBe("false");
    } finally {
      vi.useRealTimers();
    }
  });
});
