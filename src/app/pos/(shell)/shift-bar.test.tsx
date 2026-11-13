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

const NOT_A_HUB = () => jsonResponse(404, { error: { code: "not_found", message: "Cannot GET /pos/v1/hub/status" } });

/** Routes by URL; the hub status poll answers 404 (cloud, not a hub) unless a test says otherwise. */
function routeFetch(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url) => Promise.resolve((routes[url] ?? (url === "/pos/api/hub/status" ? NOT_A_HUB : () => new Response(null, { status: 204 })))()));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const HUB = { online: false, lastSyncAt: "2026-11-13T10:00:00.000Z", outboxDepth: 4, mustSyncBefore: "2026-11-14T10:00:00.000Z", locked: false, lockReason: null, rejections: 2, orphans: 1 };

describe("ShiftBar", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("shows the staff name and outlet from the server-provided display, with no client fetch on mount but the hub status poll", async () => {
    const fetchMock = routeFetch({});
    render(<ShiftBar initial={DISPLAY} />);

    expect(screen.getByTestId("pos-shift-bar-staff-name").textContent).toBe("Priya Nair");
    expect(screen.getByTestId("pos-shift-bar-clock-status").textContent).toBe("Spice Route - Indiranagar");
    expect(screen.getByTestId("pos-shift-bar-clock-out")).toBeTruthy();
    expect(screen.getByTestId("pos-shift-bar-shift-link")).toHaveProperty("href", expect.stringContaining("/pos/shift"));
    expect(screen.getByTestId("pos-shift-bar-open-orders-link")).toHaveProperty(
      "href",
      expect.stringContaining("/pos/open-orders"),
    );
    expect(screen.getByTestId("pos-shift-bar-status-link")).toHaveProperty("href", expect.stringContaining("/pos/status"));
    expect(screen.getByTestId("pos-shift-bar-payments-link")).toHaveProperty("href", expect.stringContaining("/pos/payments"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/pos/api/hub/status");
    // Off a hub (404): today's chrome exactly - no sync issues link, no lock banner.
    expect(screen.queryByTestId("pos-shift-bar-sync-issues-link")).toBeNull();
    expect(screen.queryByTestId("pos-hub-lock-banner")).toBeNull();
  });

  it("on a hub, shows the hub's state and a Sync issues link with the open count when the staff may read them (D-7)", async () => {
    const fetchMock = routeFetch({
      "/pos/api/hub/status": () => jsonResponse(200, HUB),
      "/pos/api/hub/rejections": () => jsonResponse(200, { items: [] }),
    });
    render(<ShiftBar initial={DISPLAY} />);

    const link = await screen.findByTestId("pos-shift-bar-sync-issues-link");
    expect(link).toHaveProperty("href", expect.stringContaining("/pos/sync-issues"));
    expect(screen.getByTestId("pos-shift-bar-sync-issues-count").textContent).toBe("3");
    expect(screen.getByTestId("pos-status-online").textContent).toBe("Offline · 4 sales waiting to sync");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/pos/api/hub/rejections")).toHaveLength(1);
  });

  it("on a hub, hides Sync issues from staff without settle_bills (the hub answers 403)", async () => {
    const fetchMock = routeFetch({
      "/pos/api/hub/status": () => jsonResponse(200, HUB),
      "/pos/api/hub/rejections": () => jsonResponse(403, { error: { code: "forbidden", message: "Missing permission settle_bills" } }),
    });
    render(<ShiftBar initial={DISPLAY} />);

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === "/pos/api/hub/rejections")).toBe(true));
    expect(screen.getByTestId("pos-status-online").getAttribute("data-hub")).toBe("true");
    expect(screen.queryByTestId("pos-shift-bar-sync-issues-link")).toBeNull();
  });

  it("on a locked hub, shows the red lock banner under the bar", async () => {
    routeFetch({ "/pos/api/hub/status": () => jsonResponse(200, { ...HUB, locked: true, lockReason: "offline_limit" }) });
    render(<ShiftBar initial={DISPLAY} />);
    expect((await screen.findByTestId("pos-hub-lock-banner")).getAttribute("data-reason")).toBe("offline_limit");
  });

  it("clocks out, signs out, and redirects to login", async () => {
    const fetchMock = routeFetch({ "/pos/api/clock/out": () => jsonResponse(200, { id: "c1", type: "clock_out", occurredAt: "2026-08-25T09:00:00.000Z" }) });
    render(<ShiftBar initial={DISPLAY} />);

    await userEvent.click(screen.getByTestId("pos-shift-bar-clock-out"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/pos/login"));
    const calls = fetchMock.mock.calls.map(([url]) => url).filter((url) => url !== "/pos/api/hub/status");
    expect(calls).toEqual(["/pos/api/clock/out", "/pos/auth/logout"]);
    const clockOutInit = fetchMock.mock.calls.find(([url]) => url === "/pos/api/clock/out")?.[1] as RequestInit | undefined;
    expect(clockOutInit?.method).toBe("POST");
  });

  it("shows an inline error with retry when clocking out fails, without signing out", async () => {
    routeFetch({ "/pos/api/clock/out": () => jsonResponse(409, { error: { code: "not_clocked_in", message: "You are not currently clocked in" } }) });
    render(<ShiftBar initial={DISPLAY} />);

    await userEvent.click(screen.getByTestId("pos-shift-bar-clock-out"));

    expect(await screen.findByTestId("pos-shift-bar-error")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs out and redirects to login without clocking out", async () => {
    routeFetch({});
    render(<ShiftBar initial={DISPLAY} />);

    await userEvent.click(screen.getByTestId("pos-shift-bar-sign-out"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/pos/login"));
  });

  it("falls back to a bare sign-out control if the display cookie is somehow missing", () => {
    routeFetch({});
    render(<ShiftBar initial={null} />);
    expect(screen.queryByTestId("pos-shift-bar-staff-name")).toBeNull();
    expect(screen.getByTestId("pos-shift-bar-sign-out")).toBeTruthy();
  });
});
