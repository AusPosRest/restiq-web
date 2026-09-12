import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevicesTable } from "./devices-table";
import type { AdminDeviceView } from "./devices-state";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(() => Promise.resolve("data:image/png;base64,FAKE")) },
}));

function device(overrides: Partial<AdminDeviceView> = {}): AdminDeviceView {
  return {
    id: "device-1",
    tenantId: "tenant-1",
    label: "Terminal 1",
    type: "pos",
    role: "hub",
    status: "active",
    appVersion: "v2.4.1",
    lastContactAt: "2026-08-24T11:58:00.000Z",
    enrolledAt: "2026-08-01T00:00:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

describe("DevicesTable", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders each device's name, type, role, app version, last seen and status", () => {
    render(<DevicesTable devices={[device()]} />);

    const row = screen.getByTestId("devices-row-device-1");
    expect(row.textContent).toContain("Terminal 1");
    expect(row.textContent).toContain("POS");
    expect(row.textContent).toContain("Hub");
    expect(row.textContent).toContain("v2.4.1");
    expect(row.textContent).toContain("2 min ago");
    expect(row.textContent).toContain("Enrolled");
  });

  it("labels a non-hub device as Terminal and a revoked device plainly", () => {
    render(<DevicesTable devices={[device({ id: "device-2", role: "terminal", status: "revoked" })]} />);

    const row = screen.getByTestId("devices-row-device-2");
    expect(row.textContent).toContain("Terminal");
    expect(row.textContent).not.toContain("Hub");
    expect(row.textContent).toContain("Revoked");
  });

  it("links each enrolled POS/KDS device to its surface, and nothing for revoked or unsupported types", () => {
    render(
      <DevicesTable
        devices={[
          device({ id: "pos-1", type: "pos" }),
          device({ id: "kds-1", type: "kds" }),
          device({ id: "printer-1", type: "printer" }),
          device({ id: "terminal-1", type: "terminal" }),
          device({ id: "kiosk-1", type: "kiosk" }),
          device({ id: "cds-1", type: "cds" }),
          device({ id: "gone-1", type: "pos", status: "revoked" }),
        ]}
      />,
    );
    expect(screen.getByTestId("device-open-pos-1").getAttribute("href")).toBe("/pos/login?device=pos-1&tenant=tenant-1");
    expect(screen.getByTestId("device-open-kds-1").getAttribute("href")).toBe("/kds");
    expect(screen.getByTestId("device-open-printer-1").getAttribute("href")).toBe("/pos/login?device=printer-1&tenant=tenant-1&next=%2Fpos%2Fprinter");
    expect(screen.getByTestId("device-open-printer-1").textContent).toContain("Open printer");
    expect(screen.getByTestId("device-open-terminal-1").getAttribute("href")).toBe("/pos/login?device=terminal-1&tenant=tenant-1&next=%2Fpos%2Fterminal");
    expect(screen.getByTestId("device-open-terminal-1").textContent).toContain("Open terminal");
    // Kiosk and customer display have no web surface yet.
    expect(screen.queryByTestId("device-open-cds-1")).toBeNull();
    expect(screen.queryByTestId("device-open-kiosk-1")).toBeNull();
    expect(screen.queryByTestId("device-open-gone-1")).toBeNull();
  });

  it("shows a scan QR of the device's open link, only for devices with a surface", async () => {
    vi.useRealTimers();
    render(<DevicesTable devices={[device({ id: "printer-1", type: "printer" }), device({ id: "cds-1", type: "cds" })]} />);
    expect(screen.queryByTestId("device-qr-cds-1")).toBeNull();

    fireEvent.click(screen.getByTestId("device-qr-printer-1"));
    expect((await screen.findByTestId("device-qr-dialog-image")).getAttribute("src")).toBe("data:image/png;base64,FAKE");
    const url = `${window.location.origin}/pos/login?device=printer-1&tenant=tenant-1&next=%2Fpos%2Fprinter`;
    expect(screen.getByTestId("device-qr-dialog-url").textContent).toBe(url);
    const { default: QRCode } = await import("qrcode");
    expect(QRCode.toDataURL).toHaveBeenCalledWith(url, expect.anything());
  });

  it("shows an empty state with no devices", () => {
    render(<DevicesTable devices={[]} />);
    expect(screen.getByTestId("devices-empty")).toBeTruthy();
  });

  it("falls back gracefully when the backend omits appVersion/lastContactAt", () => {
    const sparse = device();
    delete (sparse as { appVersion?: string }).appVersion;
    delete (sparse as { lastContactAt?: string }).lastContactAt;
    render(<DevicesTable devices={[sparse]} />);

    const row = screen.getByTestId("devices-row-device-1");
    expect(row.textContent).toContain("-");
    expect(row.textContent).toContain("Never");
  });
});
