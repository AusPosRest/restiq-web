import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "./dashboard";
import type { DashboardView } from "./dashboard-state";

const MULTI_OUTLET: DashboardView = {
  asOf: "2026-08-24T09:05:00.000Z",
  stale: false,
  counts: { outlets: 2, staff: 12, menuItems: 84, devices: 7 },
  outlets: [
    {
      outletId: "o1",
      outletName: "Indiranagar",
      sales: { status: "available", totalMinor: 8432000, currency: "INR" },
      margin: { status: "available", percent: 28.4 },
      labour: { status: "available", costMinor: 1200000, currency: "INR", percentOfSales: 14.2 },
      waste: { status: "available", costMinor: 124000, currency: "INR" },
    },
    {
      outletId: "o2",
      outletName: "Koramangala",
      sales: { status: "unavailable" },
      margin: { status: "unavailable" },
      labour: { status: "unavailable" },
      waste: { status: "unavailable" },
    },
  ],
};

const SINGLE_OUTLET: DashboardView = {
  asOf: "2026-08-24T09:05:00.000Z",
  stale: true,
  counts: { outlets: 1, staff: 3, menuItems: 20, devices: 2 },
  outlets: [
    {
      outletId: "o1",
      outletName: "Whitefield",
      sales: { status: "unavailable" },
      margin: { status: "unavailable" },
      labour: { status: "unavailable" },
      waste: { status: "unavailable" },
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
    expect(screen.getByTestId("outlet-kpi-o1-margin-value").textContent).toBe("28.4%");
    expect(screen.getByTestId("outlet-kpi-o1-labour-value").textContent).toContain("14.2% of sales");
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

  it("formats the freshness badge as-of time and marks it live when the sync is current", async () => {
    stubFetch(MULTI_OUTLET);
    render(<Dashboard />);

    const badge = await screen.findByTestId("dashboard-freshness-badge");
    expect(badge.textContent).toContain("As of 9:05am");
    expect(badge.getAttribute("data-stale")).toBe("false");
  });

  it("marks the freshness badge stale and never presents it as live when the sync is behind", async () => {
    stubFetch(SINGLE_OUTLET);
    render(<Dashboard />);

    const badge = await screen.findByTestId("dashboard-freshness-badge");
    expect(badge.textContent).toContain("Sync is behind");
    expect(badge.getAttribute("data-stale")).toBe("true");
  });
});
