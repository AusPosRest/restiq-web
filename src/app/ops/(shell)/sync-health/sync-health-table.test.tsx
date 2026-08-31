// O8 Sync Health: severity-sorted rendering, silent-row critical styling,
// the "N updates - refresh" chip (never auto-reordering under the cursor),
// and honoring the dashboard's ?filter= pre-filter links.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncHealthResult, SyncHealthRow } from "../api";
import { SyncHealthTable } from "./sync-health-table";

const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/ops/sync-health",
  useSearchParams: () => new URLSearchParams(search),
}));

function row(overrides: Partial<SyncHealthRow>): SyncHealthRow {
  return {
    deviceId: "d1",
    tenantId: "t1",
    tenantName: "Spice Route Hospitality",
    outletId: "o1",
    outletName: "Indiranagar",
    deviceLabel: "Terminal 1",
    deviceType: "pos",
    lastContactAt: "2026-08-22T08:00:00.000Z",
    lagSeconds: 60,
    outboxDepth: 0,
    appVersion: "2.4.1",
    clockSkewSeconds: 0,
    recentRejectionCount: 0,
    severity: "healthy",
    ...overrides,
  };
}

function resultOf(devices: SyncHealthRow[]): SyncHealthResult {
  const summary = { healthy: 0, lagging: 0, silent: 0 };
  for (const device of devices) summary[device.severity] += 1;
  return { devices, summary, generatedAt: "2026-08-24T10:00:00.000Z" };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("SyncHealthTable", () => {
  beforeEach(() => {
    replace.mockReset();
    search = "";
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows skeleton rows while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    render(<SyncHealthTable />);
    expect(screen.getByTestId("sync-health-loading")).toBeTruthy();
  });

  it("renders rows in the severity-sorted order the API returns, never re-sorting them", async () => {
    const silent = row({ deviceId: "silent-1", deviceLabel: "Silent Device", severity: "silent", lagSeconds: 50 * 3600, lastContactAt: null });
    const lagging = row({ deviceId: "lagging-1", deviceLabel: "Lagging Device", severity: "lagging", lagSeconds: 2 * 3600 });
    const healthy = row({ deviceId: "healthy-1", deviceLabel: "Healthy Device", severity: "healthy", lagSeconds: 60 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(resultOf([silent, lagging, healthy]))),
    );

    render(<SyncHealthTable />);
    const table = await screen.findByTestId("sync-health-table");
    const ids = Array.from(table.querySelectorAll("tbody tr")).map((tr) => tr.getAttribute("data-testid"));
    expect(ids).toEqual(["sync-health-row-silent-1", "sync-health-row-lagging-1", "sync-health-row-healthy-1"]);
  });

  it("renders a silent row with critical styling and its alert timestamp", async () => {
    const silent = row({
      deviceId: "silent-1",
      severity: "silent",
      lagSeconds: 50 * 3600,
      lastContactAt: "2026-08-22T08:00:00.000Z",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(resultOf([silent]))));

    render(<SyncHealthTable />);
    const rowEl = await screen.findByTestId("sync-health-row-silent-1");
    expect(rowEl.getAttribute("data-severity")).toBe("silent");
    expect(rowEl.className).toContain("border-l-status-critical");
    expect(screen.getByTestId("sync-health-row-silent-1-alert")).toBeTruthy();
    expect(rowEl.textContent).toContain("Silent since");
  });

  it("honors ?filter=silent from the dashboard's alert-tile link", async () => {
    search = "filter=silent";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(resultOf([row({ severity: "silent" })])));
    vi.stubGlobal("fetch", fetchMock);

    render(<SyncHealthTable />);
    await screen.findByTestId("sync-health-table");

    const call = fetchMock.mock.calls.find(([url]) => (url as string).includes("/ops/api/sync-health"));
    expect(call?.[0]).toContain("severity=silent");
    expect((screen.getByTestId("sync-health-filter") as HTMLSelectElement).value).toBe("silent");
    expect(screen.getByTestId("sync-health-filter-chips").textContent).toContain("Silent");
  });

  it("honors ?filter=rejections by showing only devices with recent rejections", async () => {
    search = "filter=rejections";
    const withRejections = row({ deviceId: "d-rej", recentRejectionCount: 3 });
    const withoutRejections = row({ deviceId: "d-clean", recentRejectionCount: 0 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(resultOf([withRejections, withoutRejections]))));

    render(<SyncHealthTable />);
    await screen.findByTestId("sync-health-row-d-rej");
    expect(screen.queryByTestId("sync-health-row-d-clean")).toBeNull();
  });

  it("does not auto-refresh on a live poll - it surfaces an 'N updates - refresh' chip instead", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = resultOf([row({ deviceId: "d1", severity: "healthy" })]);
    const second = resultOf([row({ deviceId: "d1", severity: "lagging", lagSeconds: 9000 })]);
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(first)).mockResolvedValueOnce(jsonResponse(second));
    vi.stubGlobal("fetch", fetchMock);

    render(<SyncHealthTable />);
    await vi.waitFor(() => expect(screen.getByTestId("sync-health-row-d1-severity").textContent).toContain("healthy"));

    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(() => expect(screen.getByTestId("sync-health-refresh-chip")).toBeTruthy());
    // Still showing the old snapshot - no auto-reorder/update under the cursor.
    expect(screen.getByTestId("sync-health-row-d1-severity").textContent).toContain("healthy");

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByTestId("sync-health-refresh-chip"));
    await vi.waitFor(() => expect(screen.getByTestId("sync-health-row-d1-severity").textContent).toContain("lagging"));
    expect(screen.queryByTestId("sync-health-refresh-chip")).toBeNull();
  });

  it("shows a load error with retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<SyncHealthTable />);
    expect(await screen.findByTestId("sync-health-error")).toBeTruthy();
  });

  it("shows the true-empty state when the fleet has no devices", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(resultOf([]))));
    render(<SyncHealthTable />);
    expect(await screen.findByTestId("sync-health-empty")).toBeTruthy();
  });

  it("shows the filtered-empty state (distinct from true-empty) when a filter yields no rows", async () => {
    search = "filter=rejections";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(resultOf([row({ recentRejectionCount: 0 })]))));
    render(<SyncHealthTable />);
    expect(await screen.findByTestId("sync-health-filtered-empty")).toBeTruthy();
  });

  it("clearing the filter navigates back to the unfiltered URL", async () => {
    search = "filter=silent";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(resultOf([row({ severity: "silent" })]))));
    render(<SyncHealthTable />);
    await screen.findByTestId("sync-health-table");

    await userEvent.click(screen.getByTestId("sync-health-clear-filter"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ops/sync-health"));
  });
});
