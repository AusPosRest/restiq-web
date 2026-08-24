import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../toast";
import { StationsPanel } from "./stations-panel";
import type { PrinterView, StationView } from "./floor-plan-state";

const updateStation = vi.fn();
vi.mock("../../api", () => ({
  updateStation: (...args: unknown[]) => updateStation(...args),
}));

const PRINTERS: PrinterView[] = [
  { id: "printer-1", name: "HOT Printer 1 (Bar)", renderMode: "text" },
  { id: "printer-2", name: "HOT Printer 2", renderMode: "bitmap" },
];

const STATIONS: StationView[] = [
  { id: "station-1", name: "Expo (Main)", ageingThresholdMinutes: 10, primaryPrinterId: "printer-1", fallbackPrinterId: null },
  { id: "station-2", name: "Fry", ageingThresholdMinutes: 8, primaryPrinterId: null, fallbackPrinterId: null },
];

function renderPanel(stations: StationView[] = STATIONS) {
  const onStationUpdated = vi.fn();
  render(
    <ToastProvider>
      <StationsPanel outletId="outlet-1" stations={stations} printers={PRINTERS} onStationUpdated={onStationUpdated} />
    </ToastProvider>,
  );
  return { onStationUpdated };
}

afterEach(() => {
  cleanup();
  updateStation.mockReset();
});

describe("StationsPanel", () => {
  it("shows an already-assigned printer as selected, with no acknowledgement needed", () => {
    renderPanel();
    expect(screen.getByTestId("station-printer-select-station-1")).toHaveProperty("value", "printer-1");
    expect(screen.getByTestId("station-no-printer-ack-station-1")).toHaveProperty("checked", false);
  });

  it("a station already saved with no printer starts valid (the invariant was already met at save time)", () => {
    renderPanel();
    expect(screen.queryByTestId("station-printer-error-station-2")).toBeNull();
    expect(screen.getByTestId("station-no-printer-ack-station-2")).toHaveProperty("checked", true);
  });

  it("flags a station left with no printer and no acknowledgement as invalid, and blocks the save", async () => {
    renderPanel();
    await userEvent.selectOptions(screen.getByTestId("station-printer-select-station-1"), "");

    expect(screen.getByTestId("station-printer-error-station-1").textContent).toContain("Choose a printer");
    expect(updateStation).not.toHaveBeenCalled();
  });

  it("saves when a printer is picked from the dropdown", async () => {
    updateStation.mockResolvedValue({ ...STATIONS[1], primaryPrinterId: "printer-2" });
    renderPanel();

    await userEvent.selectOptions(screen.getByTestId("station-printer-select-station-2"), "printer-2");

    await waitFor(() => expect(updateStation).toHaveBeenCalledWith("outlet-1", "station-2", { primaryPrinterId: "printer-2", noPrinterAcknowledged: false }));
    expect(screen.queryByTestId("station-printer-error-station-2")).toBeNull();
  });

  it("saves an explicit no-printer acknowledgement, clearing the blocked-save error", async () => {
    updateStation.mockResolvedValue({ ...STATIONS[0], primaryPrinterId: null });
    renderPanel();
    await userEvent.selectOptions(screen.getByTestId("station-printer-select-station-1"), "");
    expect(screen.getByTestId("station-printer-error-station-1")).toBeTruthy();

    await userEvent.click(screen.getByTestId("station-no-printer-ack-station-1"));

    await waitFor(() => expect(updateStation).toHaveBeenCalledWith("outlet-1", "station-1", { primaryPrinterId: null, noPrinterAcknowledged: true }));
    expect(screen.queryByTestId("station-printer-error-station-1")).toBeNull();
  });

  it("rejects an ageing threshold below 1 without saving", async () => {
    renderPanel();
    const input = screen.getByTestId("station-ageing-input-station-1");
    await userEvent.clear(input);
    await userEvent.type(input, "0");
    await userEvent.tab();

    expect(screen.getByTestId("station-ageing-error-station-1").textContent).toBeTruthy();
    expect(updateStation).not.toHaveBeenCalled();
  });

  it("saves a valid ageing threshold change", async () => {
    updateStation.mockResolvedValue({ ...STATIONS[0], ageingThresholdMinutes: 15 });
    renderPanel();
    const input = screen.getByTestId("station-ageing-input-station-1");
    await userEvent.clear(input);
    await userEvent.type(input, "15");
    await userEvent.tab();

    await waitFor(() => expect(updateStation).toHaveBeenCalledWith("outlet-1", "station-1", { ageingThresholdMinutes: 15 }));
  });
});
