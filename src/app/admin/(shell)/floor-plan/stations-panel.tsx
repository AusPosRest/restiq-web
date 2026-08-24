"use client";

// Kitchen Routing panel (CAP-5, EXPERIENCE.md: "stations panel alongside
// with ageing-threshold inputs and printer assignment (dropdown + 'no
// printer' explicit option, never silently unset)"). Auto-saves per field,
// same optimistic pattern as CapabilityToggle/EightySixToggle - but the
// printer field gates the save on validateStationPrinter first: an empty
// selection with the acknowledgement box unchecked never reaches the
// network, so the checkbox is a real gate, not decoration.
import { useState } from "react";
import { updateStation } from "../../api";
import { useToast } from "../toast";
import { validateAgeingThresholdMinutes, validateStationPrinter, type PrinterView, type StationView } from "./floor-plan-state";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const LABEL_CLASS = "font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const NO_PRINTER = "";

export interface StationsPanelProps {
  outletId: string;
  stations: readonly StationView[];
  printers: readonly PrinterView[];
  onStationUpdated: (station: StationView) => void;
}

export function StationsPanel({ outletId, stations, printers, onStationUpdated }: Readonly<StationsPanelProps>) {
  return (
    <div data-testid="stations-panel" className="flex flex-col gap-4">
      <h2 className="font-headline text-sm font-semibold uppercase tracking-wider text-muted-foreground">Kitchen Routing</h2>
      {stations.length === 0 ? (
        <p data-testid="stations-empty" className="text-sm text-muted-foreground">
          No stations set up for this outlet yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {stations.map((station) => (
            <StationRow key={station.id} outletId={outletId} station={station} printers={printers} onUpdated={onStationUpdated} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StationRow({
  outletId,
  station,
  printers,
  onUpdated,
}: Readonly<{ outletId: string; station: StationView; printers: readonly PrinterView[]; onUpdated: (station: StationView) => void }>) {
  const pushToast = useToast();
  const [ageingDraft, setAgeingDraft] = useState(String(station.ageingThresholdMinutes));
  const [ageingError, setAgeingError] = useState<string | undefined>();
  const [printerId, setPrinterId] = useState(station.primaryPrinterId ?? NO_PRINTER);
  const [noPrinterAck, setNoPrinterAck] = useState(station.primaryPrinterId === null);
  const [saving, setSaving] = useState(false);

  const printerErrors = validateStationPrinter({ primaryPrinterId: printerId || null, noPrinterAcknowledged: noPrinterAck });

  async function persist(input: Parameters<typeof updateStation>[2], onFail: () => void) {
    setSaving(true);
    try {
      const saved = await updateStation(outletId, station.id, input);
      onUpdated(saved);
    } catch {
      onFail();
      pushToast({ kind: "error", message: `Couldn't update ${station.name}. Try again.` });
    } finally {
      setSaving(false);
    }
  }

  function commitAgeing() {
    const parsed = Number.parseInt(ageingDraft, 10);
    const error = validateAgeingThresholdMinutes(parsed);
    setAgeingError(error);
    if (error || parsed === station.ageingThresholdMinutes) return;
    void persist({ ageingThresholdMinutes: parsed }, () => setAgeingDraft(String(station.ageingThresholdMinutes)));
  }

  function handlePrinterChange(value: string) {
    setPrinterId(value);
    if (!value) return; // waiting on the acknowledgement checkbox before saving "no printer"
    setNoPrinterAck(false);
    void persist({ primaryPrinterId: value, noPrinterAcknowledged: false }, () => setPrinterId(station.primaryPrinterId ?? NO_PRINTER));
  }

  function handleNoPrinterAckChange(checked: boolean) {
    setNoPrinterAck(checked);
    if (!checked) return;
    setPrinterId(NO_PRINTER);
    void persist({ primaryPrinterId: null, noPrinterAcknowledged: true }, () => setNoPrinterAck(false));
  }

  return (
    <li data-testid={`station-row-${station.id}`} className="flex flex-col gap-3 rounded-lg border border-border/40 bg-card px-4 py-3">
      <p className="text-sm font-medium">{station.name}</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`station-ageing-${station.id}`} className={LABEL_CLASS}>
            Ageing threshold (min)
          </label>
          <input
            id={`station-ageing-${station.id}`}
            type="number"
            min={1}
            data-testid={`station-ageing-input-${station.id}`}
            value={ageingDraft}
            disabled={saving}
            onChange={(event) => setAgeingDraft(event.target.value)}
            onBlur={commitAgeing}
            className={FIELD_CLASS}
          />
          {ageingError && (
            <p data-testid={`station-ageing-error-${station.id}`} className="mt-1 text-xs text-status-error">
              {ageingError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`station-printer-${station.id}`} className={LABEL_CLASS}>
            Printer
          </label>
          <select
            id={`station-printer-${station.id}`}
            data-testid={`station-printer-select-${station.id}`}
            value={printerId}
            disabled={saving}
            onChange={(event) => handlePrinterChange(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value={NO_PRINTER}>No printer selected</option>
            {printers.map((printer) => (
              <option key={printer.id} value={printer.id}>
                {printer.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          data-testid={`station-no-printer-ack-${station.id}`}
          checked={noPrinterAck}
          disabled={saving || printerId !== NO_PRINTER}
          onChange={(event) => handleNoPrinterAckChange(event.target.checked)}
          className="size-4 rounded border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        This station has no printer, on purpose.
      </label>
      {printerErrors.printer && (
        <p data-testid={`station-printer-error-${station.id}`} className="text-xs text-status-error">
          {printerErrors.printer}
        </p>
      )}
    </li>
  );
}
