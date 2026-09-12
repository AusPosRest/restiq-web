import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminApiError } from "../../api";
import { ToastProvider } from "../toast";
import type { AdminDeviceView } from "./devices-state";
import { Topology } from "./topology";

const { setDevicePairing } = vi.hoisted(() => ({ setDevicePairing: vi.fn() }));
vi.mock("../../api", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../api")>()), setDevicePairing }));

const NOW = Date.parse("2026-09-12T10:00:00.000Z");

function device(id: string, type: string, overrides: Partial<AdminDeviceView> = {}): AdminDeviceView {
  return {
    id,
    tenantId: "t1",
    label: id,
    type,
    role: "terminal",
    status: "active",
    enrolledAt: "2026-09-01T00:00:00.000Z",
    revokedAt: null,
    lastContactAt: null,
    pairedPosId: null,
    ...overrides,
  };
}

const DEVICES: AdminDeviceView[] = [
  device("main", "pos", { lastContactAt: "2026-09-12T09:59:40.000Z" }),
  device("bar", "pos"),
  device("main-printer", "printer", { pairedPosId: "main", lastContactAt: "2026-09-12T09:50:00.000Z" }),
  device("spare-terminal", "terminal"),
  device("kitchen", "kds"),
  device("old-pos", "pos", { status: "revoked" }),
];

function renderTopology() {
  const onLinked = vi.fn();
  render(
    <ToastProvider>
      <Topology outletId="outlet-1" devices={DEVICES} now={NOW} onLinked={onLinked} />
    </ToastProvider>,
  );
  return onLinked;
}

afterEach(() => {
  cleanup();
  setDevicePairing.mockReset();
});

describe("Topology", () => {
  it("hangs each linked device under its POS, keeps unlinked ones shared, and lists the rest", () => {
    renderTopology();

    expect(within(screen.getByTestId("topology-pos-main")).getByTestId("topology-device-main-printer")).toBeTruthy();
    expect(screen.getByTestId("topology-pos-main-terminal-shared")).toBeTruthy();
    expect(screen.getByTestId("topology-pos-bar-printer-shared")).toBeTruthy();
    expect(within(screen.getByTestId("topology-shared")).getByTestId("topology-device-spare-terminal")).toBeTruthy();
    expect(within(screen.getByTestId("topology-others")).getByTestId("topology-device-kitchen")).toBeTruthy();
    // A revoked device is out of service - not on the map.
    expect(screen.queryByTestId("topology-pos-old-pos")).toBeNull();
  });

  it("shows online, offline and never-connected from the last heartbeat", () => {
    renderTopology();

    expect(screen.getByTestId("topology-status-main").dataset.state).toBe("online");
    expect(screen.getByTestId("topology-status-main-printer").dataset.state).toBe("offline");
    expect(screen.getByTestId("topology-status-bar").dataset.state).toBe("never");
  });

  it("links a shared device to a POS, and a linked one back to the whole outlet", async () => {
    setDevicePairing.mockResolvedValue({});
    const onLinked = renderTopology();

    fireEvent.change(screen.getByTestId("topology-link-select-spare-terminal"), { target: { value: "bar" } });
    await waitFor(() => expect(onLinked).toHaveBeenCalledWith("spare-terminal", "bar"));
    expect(setDevicePairing).toHaveBeenCalledWith("outlet-1", "spare-terminal", "bar");

    fireEvent.change(screen.getByTestId("topology-link-select-main-printer"), { target: { value: "" } });
    await waitFor(() => expect(onLinked).toHaveBeenCalledWith("main-printer", null));
    expect(setDevicePairing).toHaveBeenCalledWith("outlet-1", "main-printer", null);
  });

  it("shows the server's reason when a link is refused, and leaves the map as it was", async () => {
    setDevicePairing.mockRejectedValue(new AdminApiError("bar already has a card terminal linked (x). Unlink it first.", 409, "pos_already_linked"));
    const onLinked = renderTopology();

    fireEvent.change(screen.getByTestId("topology-link-select-spare-terminal"), { target: { value: "bar" } });
    expect(await screen.findByText(/Unlink it first/)).toBeTruthy();
    expect(onLinked).not.toHaveBeenCalled();
  });
});
