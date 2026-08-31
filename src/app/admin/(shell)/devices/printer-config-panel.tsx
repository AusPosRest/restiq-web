"use client";

// Printer render-mode/fallback config (CAP-6), reading/writing story 5's
// printers and stations. A fallback printer is a per-station field
// (Station.fallbackPrinterId), not a Printer field, so it's only editable
// here when a printer is unambiguously the primary for exactly one station -
// see devices-state.ts's stationForPrinter and this spec's Design Notes on
// why "status" means assignment, not connectivity.
import { Printer as PrinterIcon } from "lucide-react";
import { useState } from "react";
import { updatePrinter, updateStation } from "../../api";
import { useToast } from "../toast";
import { stationForPrinter } from "./devices-state";
import type { PrinterRenderMode, PrinterView, StationView } from "../floor-plan/floor-plan-state";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const LABEL_CLASS = "font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const RENDER_MODE_LABELS: Record<PrinterRenderMode, string> = { text: "Text", bitmap: "Bitmap" };
const NO_FALLBACK = "";

export interface PrinterConfigPanelProps {
  outletId: string;
  printers: readonly PrinterView[];
  stations: readonly StationView[];
  onPrinterUpdated: (printer: PrinterView) => void;
  onStationUpdated: (station: StationView) => void;
}

export function PrinterConfigPanel({ outletId, printers, stations, onPrinterUpdated, onStationUpdated }: Readonly<PrinterConfigPanelProps>) {
  return (
    <div data-testid="printer-config-panel" className="flex flex-col gap-4">
      <h2 className="font-headline text-sm font-semibold uppercase tracking-wider text-muted-foreground">Printers</h2>
      {printers.length === 0 ? (
        <div data-testid="printers-empty" className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-12 text-center">
          <PrinterIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No printers set up for this outlet yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {printers.map((printer) => (
            <PrinterRow
              key={printer.id}
              outletId={outletId}
              printer={printer}
              printers={printers}
              stations={stations}
              onPrinterUpdated={onPrinterUpdated}
              onStationUpdated={onStationUpdated}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PrinterRow({
  outletId,
  printer,
  printers,
  stations,
  onPrinterUpdated,
  onStationUpdated,
}: Readonly<{
  outletId: string;
  printer: PrinterView;
  printers: readonly PrinterView[];
  stations: readonly StationView[];
  onPrinterUpdated: (printer: PrinterView) => void;
  onStationUpdated: (station: StationView) => void;
}>) {
  const pushToast = useToast();
  const [renderMode, setRenderMode] = useState<PrinterRenderMode>(printer.renderMode);
  const [savingMode, setSavingMode] = useState(false);
  const [savingFallback, setSavingFallback] = useState(false);

  const assignedStations = stations.filter((station) => station.primaryPrinterId === printer.id);
  const station = stationForPrinter(printer, stations);
  const assignedLabel = assignedStations.length === 0 ? "Unassigned" : assignedStations.length === 1 ? assignedStations[0].name : "Multiple stations";

  async function handleRenderModeChange(next: PrinterRenderMode) {
    const previous = renderMode;
    setRenderMode(next);
    setSavingMode(true);
    try {
      const saved = await updatePrinter(outletId, printer.id, next);
      onPrinterUpdated(saved);
    } catch {
      setRenderMode(previous);
      pushToast({ kind: "error", message: `Couldn't update ${printer.name}. Try again.` });
    } finally {
      setSavingMode(false);
    }
  }

  async function handleFallbackChange(value: string) {
    if (!station) return;
    setSavingFallback(true);
    try {
      const saved = await updateStation(outletId, station.id, { fallbackPrinterId: value || null });
      onStationUpdated(saved);
    } catch {
      pushToast({ kind: "error", message: `Couldn't update ${station.name}'s fallback printer. Try again.` });
    } finally {
      setSavingFallback(false);
    }
  }

  return (
    <li data-testid={`printer-row-${printer.id}`} className="flex flex-col gap-3 rounded-lg border border-border/40 bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{printer.name}</p>
        <p data-testid={`printer-assigned-${printer.id}`} className="text-xs text-muted-foreground">
          {assignedLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`printer-render-mode-${printer.id}`} className={LABEL_CLASS}>
            Render mode
          </label>
          <select
            id={`printer-render-mode-${printer.id}`}
            data-testid={`printer-render-mode-${printer.id}`}
            value={renderMode}
            disabled={savingMode}
            onChange={(event) => void handleRenderModeChange(event.target.value as PrinterRenderMode)}
            className={FIELD_CLASS}
          >
            {(Object.keys(RENDER_MODE_LABELS) as PrinterRenderMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {RENDER_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`printer-fallback-${printer.id}`} className={LABEL_CLASS}>
            Fallback printer
          </label>
          <select
            id={`printer-fallback-${printer.id}`}
            data-testid={`printer-fallback-select-${printer.id}`}
            value={station?.fallbackPrinterId ?? NO_FALLBACK}
            disabled={!station || savingFallback}
            onChange={(event) => void handleFallbackChange(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value={NO_FALLBACK}>No fallback</option>
            {printers
              .filter((candidate) => candidate.id !== printer.id)
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
          </select>
          {!station && (
            <p data-testid={`printer-fallback-note-${printer.id}`} className="mt-1 text-xs text-muted-foreground">
              Assign this printer to one station on Floor Plan to set its fallback here.
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
