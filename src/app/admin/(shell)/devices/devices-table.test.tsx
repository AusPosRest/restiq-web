import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevicesTable } from "./devices-table";
import type { AdminDeviceView } from "./devices-state";

function device(overrides: Partial<AdminDeviceView> = {}): AdminDeviceView {
  return {
    id: "device-1",
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
