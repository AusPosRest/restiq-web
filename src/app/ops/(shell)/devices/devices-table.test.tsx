// Fleet-wide DevicesTable: five-state pattern, the O6a revoke confirmation
// (with its DLQ-routing warning), and hub designation displacing the prior
// hub (EXPERIENCE.md).
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceListItem } from "../api";
import { ToastProvider } from "../toast";
import { DevicesTable } from "./devices-table";

const replace = vi.fn();
const push = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/ops/devices",
  useSearchParams: () => new URLSearchParams(search),
}));

function device(overrides: Partial<DeviceListItem>): DeviceListItem {
  return {
    id: "0193dddd-0000-7000-8000-000000000001",
    tenantId: "0193tttt-0000-7000-8000-000000000001",
    tenantName: "Spice Route Hospitality",
    outletId: "0193oooo-0000-7000-8000-000000000001",
    outletName: "Indiranagar",
    label: "Terminal 1",
    type: "pos",
    role: "terminal",
    status: "active",
    enrolledAt: "2026-08-20T10:00:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function deviceListResponse(devices: DeviceListItem[]): Response {
  return jsonResponse({ devices, nextCursor: null, total: devices.length });
}

function renderTable(devices: DeviceListItem[], extraRoutes?: (url: string, init?: RequestInit) => Response | undefined) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const extra = extraRoutes?.(url, init);
    if (extra) return Promise.resolve(extra);
    if (url.includes("/ops/api/devices?")) return Promise.resolve(deviceListResponse(devices));
    if (url.includes("/ops/api/tenants?")) return Promise.resolve(jsonResponse({ tenants: [], nextCursor: null, total: 0 }));
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <ToastProvider>
      <DevicesTable />
    </ToastProvider>,
  );
  return fetchMock;
}

describe("DevicesTable", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    search = "";
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("shows skeleton rows while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    render(
      <ToastProvider>
        <DevicesTable />
      </ToastProvider>,
    );
    expect(screen.getByTestId("devices-loading")).toBeTruthy();
  });

  it("shows the true-empty state with a Generate code CTA when nothing exists", async () => {
    renderTable([]);
    expect(await screen.findByTestId("devices-empty")).toBeTruthy();
    expect(screen.getByTestId("devices-empty-generate")).toBeTruthy();
  });

  it("renders fleet rows with tenant, outlet, type and status", async () => {
    renderTable([device({})]);
    const row = await screen.findByTestId("devices-row-0193dddd-0000-7000-8000-000000000001");
    expect(row.textContent).toContain("Terminal 1");
    expect(row.textContent).toContain("Spice Route Hospitality");
    expect(row.textContent).toContain("Indiranagar");
  });

  it("revoke: warns that queued ops route to the DLQ and posts the reason", async () => {
    const target = device({});
    const fetchMock = renderTable([target], (url) => {
      if (url.endsWith(`/ops/api/devices/${target.id}/revoke`)) return jsonResponse({ device: { ...target, status: "revoked" } });
      return undefined;
    });
    await screen.findByTestId(`devices-row-${target.id}`);

    await userEvent.click(screen.getByTestId(`device-revoke-${target.id}`));
    expect(screen.getByTestId("confirm-dialog").textContent).toContain(`Revoke device ${target.label}`);
    expect(screen.getByTestId("revoke-dlq-warning").textContent).toContain("routed to the Dead-Letter Queue");
    // Destructive action stays disabled until a reason is entered.
    expect((screen.getByTestId("confirm-submit") as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByTestId("confirm-reason"), "Device reported stolen by outlet manager");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(`/ops/api/devices/${target.id}/revoke`));
      expect(call).toBeTruthy();
    });
    const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(`/ops/api/devices/${target.id}/revoke`))!;
    const init = call[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ reason: "Device reported stolen by outlet manager" });
    expect(await screen.findByTestId("toast-success")).toBeTruthy();
  });

  it("hub designation: shows and displaces the prior hub in the same outlet", async () => {
    const hub = device({ id: "0193dddd-0000-7000-8000-000000000002", label: "Terminal 1", role: "hub" });
    const candidate = device({ id: "0193dddd-0000-7000-8000-000000000003", label: "Terminal 2", role: "terminal" });
    const fetchMock = renderTable([hub, candidate], (url) => {
      if (url.endsWith(`/ops/api/devices/${candidate.id}/hub`)) {
        return jsonResponse({ device: { ...candidate, role: "hub" }, displacedDeviceId: hub.id });
      }
      return undefined;
    });
    await screen.findByTestId(`devices-row-${candidate.id}`);

    // The current hub has no "Designate hub" action - it already is one.
    expect(screen.queryByTestId(`device-hub-${hub.id}`)).toBeNull();

    await userEvent.click(screen.getByTestId(`device-hub-${candidate.id}`));
    expect(screen.getByTestId("confirm-dialog").textContent).toContain("Terminal 1");
    expect(screen.getByTestId("confirm-dialog").textContent).toContain("moved to Terminal");

    await userEvent.type(screen.getByTestId("confirm-reason"), "Moved counter");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(`/ops/api/devices/${candidate.id}/hub`));
      expect(call).toBeTruthy();
    });
    const toast = await screen.findByTestId("toast-success");
    expect(toast.textContent).toContain("previous hub moved to Terminal");
  });
});
