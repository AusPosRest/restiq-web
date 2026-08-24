import { describe, expect, it } from "vitest";
import { formatCountdown, formatLastSeen, secondsRemaining, stationForPrinter } from "./devices-state";
import type { PrinterView, StationView } from "../floor-plan/floor-plan-state";

const printer: PrinterView = { id: "printer-1", name: "Billing Counter", renderMode: "text" };

function station(overrides: Partial<StationView> = {}): StationView {
  return {
    id: "station-1",
    name: "Billing",
    ageingThresholdMinutes: 10,
    primaryPrinterId: null,
    fallbackPrinterId: null,
    ...overrides,
  };
}

describe("secondsRemaining", () => {
  it("floors at zero and never goes negative", () => {
    const now = Date.parse("2026-08-24T12:00:00.000Z");
    expect(secondsRemaining("2026-08-24T12:15:00.000Z", now)).toBe(900);
    expect(secondsRemaining("2026-08-24T11:59:00.000Z", now)).toBe(0);
    expect(secondsRemaining("2026-08-24T12:00:00.000Z", now)).toBe(0);
  });
});

describe("formatCountdown", () => {
  it("formats as m:ss", () => {
    expect(formatCountdown(900)).toBe("15:00");
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(5)).toBe("0:05");
  });
});

describe("formatLastSeen", () => {
  const now = Date.parse("2026-08-24T12:00:00.000Z");

  it("shows 'Never' when the device has no contact record", () => {
    expect(formatLastSeen(null, now)).toBe("Never");
  });

  it("shows 'Never' when the backend response omits the field entirely", () => {
    // restiq-backend's toDeviceView doesn't map lastContactAt into the list
    // response yet (see this file's header) - the field is absent, not null.
    expect(formatLastSeen(undefined, now)).toBe("Never");
  });

  it("shows 'Just now' for under a minute", () => {
    expect(formatLastSeen("2026-08-24T11:59:45.000Z", now)).toBe("Just now");
  });

  it("shows whole minutes under an hour", () => {
    expect(formatLastSeen("2026-08-24T11:58:00.000Z", now)).toBe("2 min ago");
  });

  it("shows whole hours under a day", () => {
    expect(formatLastSeen("2026-08-24T11:00:00.000Z", now)).toBe("1 hr ago");
  });

  it("shows whole days beyond that", () => {
    expect(formatLastSeen("2026-08-22T12:00:00.000Z", now)).toBe("2d ago");
  });
});

describe("stationForPrinter", () => {
  it("returns the one station this printer is primary for", () => {
    const stations = [station({ id: "s1", primaryPrinterId: "printer-1" }), station({ id: "s2", primaryPrinterId: "printer-2" })];
    expect(stationForPrinter(printer, stations)?.id).toBe("s1");
  });

  it("returns null when no station has this printer as primary", () => {
    const stations = [station({ id: "s1", primaryPrinterId: "printer-2" })];
    expect(stationForPrinter(printer, stations)).toBeNull();
  });

  it("returns null when more than one station claims this printer as primary (ambiguous, no single fallback target)", () => {
    const stations = [station({ id: "s1", primaryPrinterId: "printer-1" }), station({ id: "s2", primaryPrinterId: "printer-1" })];
    expect(stationForPrinter(printer, stations)).toBeNull();
  });
});
