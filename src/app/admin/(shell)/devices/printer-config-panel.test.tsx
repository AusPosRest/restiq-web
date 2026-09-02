import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../toast";
import { PrinterConfigPanel } from "./printer-config-panel";
import type { PrinterView, StationView } from "../floor-plan/floor-plan-state";

const PRINTERS: PrinterView[] = [
  { id: "printer-1", name: "Billing Counter", renderMode: "text" },
  { id: "printer-2", name: "Kitchen Main", renderMode: "bitmap" },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function renderPanel(stations: StationView[], opts: { patchStatus?: number } = {}) {
  const onPrinterUpdated = vi.fn();
  const onStationUpdated = vi.fn();
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (opts.patchStatus && opts.patchStatus !== 200 && method === "PATCH") {
      return Promise.resolve(jsonResponse({ error: { code: "server_error", message: "Save failed" } }, opts.patchStatus));
    }
    if (url.includes("/floor-plan/printers/") && method === "PATCH") {
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const printer = PRINTERS.find((p) => url.includes(p.id))!;
      return Promise.resolve(jsonResponse({ ...printer, ...sent }));
    }
    if (url.includes("/stations/") && method === "PATCH") {
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const station = stations.find((s) => url.includes(s.id))!;
      return Promise.resolve(jsonResponse({ ...station, ...sent }));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <ToastProvider>
      <PrinterConfigPanel outletId="outlet-1" printers={PRINTERS} stations={stations} onPrinterUpdated={onPrinterUpdated} onStationUpdated={onStationUpdated} />
    </ToastProvider>,
  );
  return { fetchMock, onPrinterUpdated, onStationUpdated };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PrinterConfigPanel", () => {
  it("shows each printer's assigned station and the printer as fallback target", () => {
    const stations: StationView[] = [
      { id: "s1", name: "Billing", ageingThresholdMinutes: 5, primaryPrinterId: "printer-1", fallbackPrinterId: "printer-2" },
    ];
    renderPanel(stations);

    expect(screen.getByTestId("printer-assigned-printer-1").textContent).toContain("Billing");
    expect(screen.getByTestId("printer-assigned-printer-2").textContent).toContain("Unassigned");
  });

  it("saves a render-mode change", async () => {
    const { fetchMock, onPrinterUpdated } = renderPanel([]);

    await userEvent.selectOptions(screen.getByTestId("printer-render-mode-printer-1"), "bitmap");

    await waitFor(() => expect(onPrinterUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: "printer-1", renderMode: "bitmap" })));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/outlets/outlet-1/floor-plan/printers/printer-1"),
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ renderMode: "bitmap" }) }),
    );
  });

  it("reverts and toasts on a failed render-mode save", async () => {
    renderPanel([], { patchStatus: 500 });

    const select = screen.getByTestId("printer-render-mode-printer-1") as HTMLSelectElement;
    await userEvent.selectOptions(select, "bitmap");

    await screen.findByTestId("toast-error");
    await waitFor(() => expect(select.value).toBe("text"));
  });

  it("disables the fallback selector when a printer isn't the sole primary for any station", () => {
    renderPanel([]);
    const select = screen.getByTestId("printer-fallback-select-printer-1") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByTestId("printer-fallback-note-printer-1")).toBeTruthy();
  });

  it("enables and saves a fallback change for a printer assigned to exactly one station", async () => {
    const stations: StationView[] = [
      { id: "s1", name: "Billing", ageingThresholdMinutes: 5, primaryPrinterId: "printer-1", fallbackPrinterId: null },
    ];
    const { fetchMock, onStationUpdated } = renderPanel(stations);

    const select = screen.getByTestId("printer-fallback-select-printer-1") as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    await userEvent.selectOptions(select, "printer-2");

    await waitFor(() => expect(onStationUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: "s1", fallbackPrinterId: "printer-2" })));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/outlets/outlet-1/floor-plan/stations/s1"),
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ fallbackPrinterId: "printer-2" }) }),
    );
  });

  it("shows an empty state with no printers", () => {
    const onPrinterUpdated = vi.fn();
    const onStationUpdated = vi.fn();
    render(
      <ToastProvider>
        <PrinterConfigPanel outletId="outlet-1" printers={[]} stations={[]} onPrinterUpdated={onPrinterUpdated} onStationUpdated={onStationUpdated} />
      </ToastProvider>,
    );
    expect(screen.getByTestId("printers-empty")).toBeTruthy();
  });
});
