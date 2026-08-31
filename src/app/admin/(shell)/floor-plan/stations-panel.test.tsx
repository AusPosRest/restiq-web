import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../toast";
import { StationsPanel } from "./stations-panel";
import type { PrinterView, StationView } from "./floor-plan-state";

const updateStation = vi.fn();
const createStation = vi.fn();
const createPrinter = vi.fn();
vi.mock("../../api", () => ({
  updateStation: (...args: unknown[]) => updateStation(...args),
  createStation: (...args: unknown[]) => createStation(...args),
  createPrinter: (...args: unknown[]) => createPrinter(...args),
}));

const PRINTERS: PrinterView[] = [
  { id: "printer-1", name: "HOT Printer 1 (Bar)", renderMode: "text" },
  { id: "printer-2", name: "HOT Printer 2", renderMode: "bitmap" },
];

const STATIONS: StationView[] = [
  { id: "station-1", name: "Expo (Main)", ageingThresholdMinutes: 10, primaryPrinterId: "printer-1", fallbackPrinterId: null },
  { id: "station-2", name: "Fry", ageingThresholdMinutes: 8, primaryPrinterId: null, fallbackPrinterId: null },
];

function renderPanel(stations: StationView[] = STATIONS, printers: PrinterView[] = PRINTERS) {
  const onStationUpdated = vi.fn();
  const onStationCreated = vi.fn();
  const onPrinterCreated = vi.fn();
  render(
    <ToastProvider>
      <StationsPanel
        outletId="outlet-1"
        stations={stations}
        printers={printers}
        onStationUpdated={onStationUpdated}
        onStationCreated={onStationCreated}
        onPrinterCreated={onPrinterCreated}
      />
    </ToastProvider>,
  );
  return { onStationUpdated, onStationCreated, onPrinterCreated };
}

afterEach(() => {
  cleanup();
  updateStation.mockReset();
  createStation.mockReset();
  createPrinter.mockReset();
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

  describe("Add station", () => {
    it("blocks submission with no printer and no acknowledgement, showing the same inline error as StationRow", async () => {
      renderPanel();
      await userEvent.click(screen.getByTestId("stations-add-station-button"));
      await userEvent.type(screen.getByTestId("add-station-name"), "Bar");

      expect(screen.getByTestId("add-station-printer-error").textContent).toContain("Choose a printer");
      expect((screen.getByTestId("stations-add-station-submit") as HTMLButtonElement).disabled).toBe(true);
      expect(createStation).not.toHaveBeenCalled();
    });

    it("creates a station with the acknowledgement checked and no printer, and appends it", async () => {
      const created = { id: "station-3", name: "Bar", ageingThresholdMinutes: 10, primaryPrinterId: null, fallbackPrinterId: null };
      createStation.mockResolvedValue(created);
      const { onStationCreated } = renderPanel();

      await userEvent.click(screen.getByTestId("stations-add-station-button"));
      await userEvent.type(screen.getByTestId("add-station-name"), "Bar");
      await userEvent.click(screen.getByTestId("add-station-no-printer-ack"));
      await userEvent.click(screen.getByTestId("stations-add-station-submit"));

      await waitFor(() =>
        expect(createStation).toHaveBeenCalledWith("outlet-1", {
          name: "Bar",
          ageingThresholdMinutes: 10,
          primaryPrinterId: null,
          noPrinterAcknowledged: true,
        }),
      );
      await waitFor(() => expect(onStationCreated).toHaveBeenCalledWith(created));
      expect(screen.queryByTestId("stations-add-station-form")).toBeNull();
    });

    it("creates a station with a printer assigned", async () => {
      const created = { id: "station-3", name: "Bar", ageingThresholdMinutes: 10, primaryPrinterId: "printer-2", fallbackPrinterId: null };
      createStation.mockResolvedValue(created);
      renderPanel();

      await userEvent.click(screen.getByTestId("stations-add-station-button"));
      await userEvent.type(screen.getByTestId("add-station-name"), "Bar");
      await userEvent.selectOptions(screen.getByTestId("add-station-printer"), "printer-2");
      await userEvent.click(screen.getByTestId("stations-add-station-submit"));

      await waitFor(() =>
        expect(createStation).toHaveBeenCalledWith("outlet-1", {
          name: "Bar",
          ageingThresholdMinutes: 10,
          primaryPrinterId: "printer-2",
          noPrinterAcknowledged: false,
        }),
      );
    });

    it("toasts and keeps the form open when the create request fails", async () => {
      createStation.mockRejectedValue(new Error("boom"));
      renderPanel();

      await userEvent.click(screen.getByTestId("stations-add-station-button"));
      await userEvent.type(screen.getByTestId("add-station-name"), "Bar");
      await userEvent.click(screen.getByTestId("add-station-no-printer-ack"));
      await userEvent.click(screen.getByTestId("stations-add-station-submit"));

      await screen.findByTestId("toast-error");
      expect(screen.getByTestId("add-station-name")).toHaveProperty("value", "Bar");
    });
  });

  describe("Add printer", () => {
    it("creates a printer and appends it", async () => {
      const created: PrinterView = { id: "printer-3", name: "KOT Printer", renderMode: "bitmap" };
      createPrinter.mockResolvedValue(created);
      const { onPrinterCreated } = renderPanel();

      await userEvent.click(screen.getByTestId("stations-add-printer-button"));
      await userEvent.type(screen.getByTestId("add-printer-name"), "KOT Printer");
      await userEvent.selectOptions(screen.getByTestId("add-printer-render-mode"), "bitmap");
      await userEvent.click(screen.getByTestId("stations-add-printer-submit"));

      await waitFor(() => expect(createPrinter).toHaveBeenCalledWith("outlet-1", { name: "KOT Printer", renderMode: "bitmap" }));
      await waitFor(() => expect(onPrinterCreated).toHaveBeenCalledWith(created));
      expect(screen.queryByTestId("stations-add-printer-form")).toBeNull();
    });

    it("toasts and keeps the form open when the create request fails", async () => {
      createPrinter.mockRejectedValue(new Error("boom"));
      renderPanel();

      await userEvent.click(screen.getByTestId("stations-add-printer-button"));
      await userEvent.type(screen.getByTestId("add-printer-name"), "KOT Printer");
      await userEvent.click(screen.getByTestId("stations-add-printer-submit"));

      await screen.findByTestId("toast-error");
      expect(screen.getByTestId("add-printer-name")).toHaveProperty("value", "KOT Printer");
    });
  });
});
