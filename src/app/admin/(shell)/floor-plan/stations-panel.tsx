"use client";

// Kitchen Routing panel (CAP-5, EXPERIENCE.md: "stations panel alongside
// with ageing-threshold inputs and printer assignment (dropdown + 'no
// printer' explicit option, never silently unset)"). Auto-saves per field,
// same optimistic pattern as CapabilityToggle/EightySixToggle - but the
// printer field gates the save on validateStationPrinter first: an empty
// selection with the acknowledgement box unchecked never reaches the
// network, so the checkbox is a real gate, not decoration.
//
// "Add station" and "Add printer" forms below the list so a
// brand-new outlet can reach a first station/printer through the console -
// the printer-required gate on add-station reuses validateStationPrinter
// verbatim, same as StationRow above.
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { applyStarterSetup, createPrinter, createStation, deleteStation, updateStation } from "../../api";
import { useToast } from "../toast";
import {
  validateAgeingThresholdMinutes,
  validateStationPrinter,
  type PrinterRenderMode,
  type PrinterView,
  type StationView,
} from "./floor-plan-state";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const LABEL_CLASS = "font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const NO_PRINTER = "";
const DEFAULT_AGEING_THRESHOLD = "10";

export interface StationsPanelProps {
  outletId: string;
  stations: readonly StationView[];
  printers: readonly PrinterView[];
  onStationUpdated: (station: StationView) => void;
  onStationCreated: (station: StationView) => void;
  onStationDeleted: (stationId: string) => void;
  /** The outlet type's starter setup landed: reload the whole plan (it adds tables and switches too). */
  onStarterApplied: () => void;
  onPrinterCreated: (printer: PrinterView) => void;
}

export function StationsPanel({ outletId, stations, printers, onStationUpdated, onStationCreated, onStationDeleted, onStarterApplied, onPrinterCreated }: Readonly<StationsPanelProps>) {
  return (
    <div data-testid="stations-panel" className="flex flex-col gap-4">
      <h2 className="font-headline text-sm font-semibold uppercase tracking-wider text-muted-foreground">Kitchen Routing</h2>
      {stations.length === 0 ? (
        <div data-testid="stations-empty" className="flex flex-col gap-3 rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          <p>No stations set up for this outlet yet.</p>
          <StarterSetupButton outletId={outletId} onApplied={onStarterApplied} />
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {stations.map((station) => (
            <StationRow key={station.id} outletId={outletId} station={station} printers={printers} onUpdated={onStationUpdated} onDeleted={onStationDeleted} />
          ))}
        </ul>
      )}
      <AddStationForm outletId={outletId} printers={printers} onCreated={onStationCreated} />
      <AddPrinterForm outletId={outletId} onCreated={onPrinterCreated} />
    </div>
  );
}

// Creates the stations, tables and switches that suit this outlet's type (restaurant, counter,
// cloud kitchen, food-court stall). Everything it makes is editable and removable below.
function StarterSetupButton({ outletId, onApplied }: Readonly<{ outletId: string; onApplied: () => void }>) {
  const pushToast = useToast();
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    try {
      const result = await applyStarterSetup(outletId);
      const parts = [
        result.stationsCreated.length > 0 ? `${result.stationsCreated.length} station${result.stationsCreated.length === 1 ? "" : "s"}` : null,
        result.tablesCreated > 0 ? `${result.tablesCreated} tables` : null,
      ].filter(Boolean);
      pushToast({ kind: "success", message: parts.length > 0 ? `Added ${parts.join(" and ")}. Edit or remove anything you don't need.` : "Everything for this outlet type is already set up." });
      onApplied();
    } catch {
      pushToast({ kind: "error", message: "Couldn't set up this outlet. Try again." });
      setBusy(false);
    }
  }

  return (
    <Button size="sm" data-testid="stations-starter-setup" disabled={busy} onClick={() => void apply()}>
      {busy ? "Setting up…" : "Set up for my outlet type"}
    </Button>
  );
}

function StationRow({
  outletId,
  station,
  printers,
  onUpdated,
  onDeleted,
}: Readonly<{ outletId: string; station: StationView; printers: readonly PrinterView[]; onUpdated: (station: StationView) => void; onDeleted: (stationId: string) => void }>) {
  const pushToast = useToast();
  const [ageingDraft, setAgeingDraft] = useState(String(station.ageingThresholdMinutes));
  const [ageingError, setAgeingError] = useState<string | undefined>();
  const [printerId, setPrinterId] = useState(station.primaryPrinterId ?? NO_PRINTER);
  const [noPrinterAck, setNoPrinterAck] = useState(station.primaryPrinterId === null);
  const [saving, setSaving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

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

  async function remove() {
    setSaving(true);
    try {
      await deleteStation(outletId, station.id);
      onDeleted(station.id);
    } catch {
      pushToast({ kind: "error", message: `Couldn't remove ${station.name}. Try again.` });
      setSaving(false);
      setConfirmingRemove(false);
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{station.name}</p>
        {confirmingRemove ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Menu items on it go back to no station.</span>
            <Button type="button" size="sm" variant="destructive" data-testid={`station-remove-confirm-${station.id}`} disabled={saving} onClick={() => void remove()}>
              Remove
            </Button>
            <Button type="button" size="sm" variant="ghost" data-testid={`station-remove-cancel-${station.id}`} disabled={saving} onClick={() => setConfirmingRemove(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="ghost" data-testid={`station-remove-${station.id}`} disabled={saving} onClick={() => setConfirmingRemove(true)}>
            Remove
          </Button>
        )}
      </div>

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

// --- Add station. Same printer-required-or-acknowledge gate as
// StationRow above, applied verbatim: the error is shown unconditionally
// (not gated behind a "touched" flag) and the submit button stays disabled
// while it holds, so the 400 printer_required the backend would otherwise
// return is never actually reached.
function AddStationForm({
  outletId,
  printers,
  onCreated,
}: Readonly<{ outletId: string; printers: readonly PrinterView[]; onCreated: (station: StationView) => void }>) {
  const pushToast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ageingDraft, setAgeingDraft] = useState(DEFAULT_AGEING_THRESHOLD);
  const [printerId, setPrinterId] = useState(NO_PRINTER);
  const [noPrinterAck, setNoPrinterAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const parsedAgeing = Number.parseInt(ageingDraft, 10);
  const ageingError = validateAgeingThresholdMinutes(parsedAgeing);
  const printerErrors = validateStationPrinter({ primaryPrinterId: printerId || null, noPrinterAcknowledged: noPrinterAck });
  const invalid = !name.trim() || Boolean(ageingError) || Boolean(printerErrors.printer);

  function handlePrinterChange(value: string) {
    setPrinterId(value);
    if (value) setNoPrinterAck(false);
  }

  function handleNoPrinterAckChange(checked: boolean) {
    setNoPrinterAck(checked);
    if (checked) setPrinterId(NO_PRINTER);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (invalid || submitting) return;
    setSubmitting(true);
    try {
      const station = await createStation(outletId, {
        name: name.trim(),
        ageingThresholdMinutes: parsedAgeing,
        primaryPrinterId: printerId || null,
        noPrinterAcknowledged: noPrinterAck,
      });
      setName("");
      setAgeingDraft(DEFAULT_AGEING_THRESHOLD);
      setPrinterId(NO_PRINTER);
      setNoPrinterAck(false);
      setOpen(false);
      onCreated(station);
    } catch {
      pushToast({ kind: "error", message: `Couldn't add ${name.trim()}. Try again.` });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" data-testid="stations-add-station-button" onClick={() => setOpen(true)}>
        Add station
      </Button>
    );
  }

  return (
    <form onSubmit={submit} data-testid="stations-add-station-form" className="flex flex-col gap-3 rounded-lg border border-border/40 bg-card px-4 py-3">
      <div>
        <label htmlFor="add-station-name" className={LABEL_CLASS}>
          Name
        </label>
        <input
          id="add-station-name"
          data-testid="add-station-name"
          autoFocus
          required
          value={name}
          disabled={submitting}
          onChange={(event) => setName(event.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="add-station-ageing" className={LABEL_CLASS}>
            Ageing threshold (min)
          </label>
          <input
            id="add-station-ageing"
            type="number"
            min={1}
            data-testid="add-station-ageing"
            value={ageingDraft}
            disabled={submitting}
            onChange={(event) => setAgeingDraft(event.target.value)}
            className={FIELD_CLASS}
          />
          {ageingError && (
            <p data-testid="add-station-ageing-error" className="mt-1 text-xs text-status-error">
              {ageingError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="add-station-printer" className={LABEL_CLASS}>
            Printer
          </label>
          <select
            id="add-station-printer"
            data-testid="add-station-printer"
            value={printerId}
            disabled={submitting}
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
          data-testid="add-station-no-printer-ack"
          checked={noPrinterAck}
          disabled={submitting || printerId !== NO_PRINTER}
          onChange={(event) => handleNoPrinterAckChange(event.target.checked)}
          className="size-4 rounded border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        This station has no printer, on purpose.
      </label>
      {printerErrors.printer && (
        <p data-testid="add-station-printer-error" className="text-xs text-status-error">
          {printerErrors.printer}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" data-testid="stations-add-station-cancel" disabled={submitting} onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" data-testid="stations-add-station-submit" disabled={submitting || invalid}>
          {submitting ? "Adding…" : "Add station"}
        </Button>
      </div>
    </form>
  );
}

// --- Add printer. name + renderMode only - fallback routing is a
// per-station field (fallbackPrinterId), not something a printer owns.
function AddPrinterForm({ outletId, onCreated }: Readonly<{ outletId: string; onCreated: (printer: PrinterView) => void }>) {
  const pushToast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [renderMode, setRenderMode] = useState<PrinterRenderMode>("text");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const printer = await createPrinter(outletId, { name: trimmed, renderMode });
      setName("");
      setRenderMode("text");
      setOpen(false);
      onCreated(printer);
    } catch {
      pushToast({ kind: "error", message: `Couldn't add "${trimmed}". Try again.` });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" data-testid="stations-add-printer-button" onClick={() => setOpen(true)}>
        Add printer
      </Button>
    );
  }

  return (
    <form onSubmit={submit} data-testid="stations-add-printer-form" className="flex flex-col gap-3 rounded-lg border border-border/40 bg-card px-4 py-3">
      <div>
        <label htmlFor="add-printer-name" className={LABEL_CLASS}>
          Name
        </label>
        <input
          id="add-printer-name"
          data-testid="add-printer-name"
          autoFocus
          required
          value={name}
          disabled={submitting}
          onChange={(event) => setName(event.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label htmlFor="add-printer-render-mode" className={LABEL_CLASS}>
          Render mode
        </label>
        <select
          id="add-printer-render-mode"
          data-testid="add-printer-render-mode"
          value={renderMode}
          disabled={submitting}
          onChange={(event) => setRenderMode(event.target.value as PrinterRenderMode)}
          className={FIELD_CLASS}
        >
          <option value="text">Text</option>
          <option value="bitmap">Bitmap</option>
        </select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" data-testid="stations-add-printer-cancel" disabled={submitting} onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" data-testid="stations-add-printer-submit" disabled={submitting || !name.trim()}>
          {submitting ? "Adding…" : "Add printer"}
        </Button>
      </div>
    </form>
  );
}
