import { describe, expect, it } from "vitest";
import { SyncHealthRow, SyncHealthResult } from "../api";
import { diffCount } from "./use-live-sync-health";

function row(overrides: Partial<SyncHealthRow>): SyncHealthRow {
  return {
    deviceId: "d1",
    tenantId: "t1",
    tenantName: "Spice Route",
    outletId: "o1",
    outletName: "Indiranagar",
    deviceLabel: "Terminal 1",
    deviceType: "pos",
    lastContactAt: "2026-08-24T10:00:00.000Z",
    lagSeconds: 60,
    outboxDepth: 0,
    appVersion: "2.4.1",
    clockSkewSeconds: 0,
    recentRejectionCount: 0,
    severity: "healthy",
    ...overrides,
  };
}

function result(devices: SyncHealthRow[]): SyncHealthResult {
  return { devices, summary: { healthy: devices.length, lagging: 0, silent: 0 }, generatedAt: "2026-08-24T10:00:00.000Z" };
}

describe("diffCount", () => {
  it("is 0 with no prior snapshot", () => {
    expect(diffCount(null, result([row({})]))).toBe(0);
  });

  it("is 0 when nothing changed", () => {
    const snapshot = result([row({})]);
    expect(diffCount(snapshot, result([row({})]))).toBe(0);
  });

  it("counts a row whose fields changed", () => {
    const shown = result([row({ lagSeconds: 60 })]);
    const next = result([row({ lagSeconds: 9000, severity: "lagging" })]);
    expect(diffCount(shown, next)).toBe(1);
  });

  it("counts an added row and a removed row", () => {
    const shown = result([row({ deviceId: "d1" })]);
    const next = result([row({ deviceId: "d2" })]);
    expect(diffCount(shown, next)).toBe(2);
  });
});
