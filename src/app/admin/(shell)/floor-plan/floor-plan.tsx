"use client";

// T5 Floor Plan (CAP-5): per-outlet, scoped by the shell's outlet switcher
// (EXPERIENCE.md IA: "Floor Plan → T5 (per-outlet; outlet switcher scopes
// it)") - same key={selectedOutletId} remount shape as Settings/Capabilities
// so an edit in flight for outlet A can never bleed into outlet B.
//
// Story 10 adds create affordances (empty state + add-floor/add-table
// toolbar) so a brand-new outlet with zero floors can reach the Go-Live
// Checklist's floor_plan step through the console - see floor-plan-state.ts
// and api.ts's file headers for the create-endpoint contract this reuses.
import { LayoutGrid, Table2, TableProperties } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AdminApiError, createFloor, createTable, fetchFloorPlan, updateTable } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useOutlets } from "../outlet-context";
import { useToast } from "../toast";
import { CANVAS_HEIGHT, CANVAS_WIDTH, FloorPlanCanvas } from "./floor-plan-canvas";
import { computeNextTablePosition, findOverlap, SHAPE_SIZES } from "./floor-plan-state";
import type { DiningTableView, FloorPlanView, FloorView, PrinterView, StationView, TableShape } from "./floor-plan-state";
import { FloorPlanListView, type EditableTableField } from "./floor-plan-list-view";
import { StationsPanel } from "./stations-panel";

type ViewMode = "canvas" | "list";

const TOOLBAR_INPUT_CLASS =
  "rounded-md border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TOOLBAR_LABEL_CLASS = "font-label mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";

let tempTableSeq = 0;
function nextTempTableId(): string {
  tempTableSeq += 1;
  return `temp-table-${tempTableSeq}`;
}

export function FloorPlan() {
  const { outlets, loading: outletsLoading, selectedOutletId } = useOutlets();

  if (outletsLoading) return <LoadingShell />;

  if (outlets.length === 0) {
    return (
      <div data-testid="floor-plan-no-outlets" className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center">
        <Table2 className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-headline text-lg font-medium">No outlets yet</p>
        <p className="max-w-md text-sm text-muted-foreground">Once your outlets are set up, you can lay out their floor plan here.</p>
      </div>
    );
  }

  if (!selectedOutletId) return <LoadingShell />;

  return <OutletFloorPlan key={selectedOutletId} outletId={selectedOutletId} />;
}

function LoadingShell() {
  return (
    <div className="space-y-4" data-testid="floor-plan-loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[420px]" />
    </div>
  );
}

// Same landed/attempt loading shape as use-admin-load.ts, just fetching by
// outletId instead of a fixed path (mirrors capabilities-editor.tsx's
// useOutletCapabilitiesLoad). One call: the backend's GET already returns
// floors, stations and printers together (see api.ts's file header).
function useFloorPlanData(outletId: string) {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<{ attempt: number; data: FloorPlanView | null; failed: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFloorPlan(outletId)
      .then((data) => {
        if (!cancelled) setLanded({ attempt, failed: false, data });
      })
      .catch(() => {
        if (!cancelled) setLanded({ attempt, failed: true, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [outletId, attempt]);

  const current = landed && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    data: current?.data ?? null,
    retry: () => setAttempt((n) => n + 1),
  };
}

function OutletFloorPlan({ outletId }: Readonly<{ outletId: string }>) {
  const { loading, failed, data, retry } = useFloorPlanData(outletId);

  if (loading) return <LoadingShell />;
  if (failed) return <LoadErrorPanel testId="floor-plan-load-error" message="The floor plan couldn't be loaded." onRetry={retry} />;
  if (!data) return null;

  return <FloorPlanEditor outletId={outletId} initial={data} />;
}

function FloorPlanEditor({ outletId, initial }: Readonly<{ outletId: string; initial: FloorPlanView }>) {
  const pushToast = useToast();
  const [floors, setFloors] = useState<FloorView[]>(initial.floors);
  const [tables, setTables] = useState<DiningTableView[]>(initial.tables);
  const [stations, setStations] = useState<StationView[]>(initial.stations);
  const [printers, setPrinters] = useState<PrinterView[]>(initial.printers);
  const [view, setView] = useState<ViewMode>("canvas");
  const [selectedFloorId, setSelectedFloorId] = useState<string>(initial.floors[0]?.id ?? "");

  // Optimistic write, reconciled against the backend's actual REJECT-with-409
  // overlap policy (see floor-plan-state.ts's file header) - a save either
  // lands exactly where requested or fails outright, so the only recovery
  // this needs is a snap-back-and-toast on failure, never a "position was
  // adjusted" reconciliation.
  async function commitTable(tableId: string, patch: Partial<Pick<DiningTableView, "x" | "y" | "seatCapacity">>, previous: DiningTableView) {
    setTables((current) => current.map((table) => (table.id === tableId ? { ...table, ...patch } : table)));
    try {
      const saved = await updateTable(outletId, tableId, patch);
      setTables((current) => current.map((table) => (table.id === tableId ? saved : table)));
    } catch (error) {
      setTables((current) => current.map((table) => (table.id === tableId ? previous : table)));
      const overlap = error instanceof AdminApiError && error.status === 409;
      pushToast({
        kind: "error",
        message: overlap ? `${previous.label} overlaps another table there. It's been moved back.` : `Couldn't move ${previous.label}. Try again.`,
      });
    }
  }

  function handleTableMoved(tableId: string, next: { x: number; y: number }, previous: { x: number; y: number }) {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    void commitTable(tableId, next, { ...table, ...previous });
  }

  function handleListFieldCommitted(tableId: string, field: EditableTableField, value: number) {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    void commitTable(tableId, { [field]: value }, table);
  }

  function handleFloorCreated(floor: FloorView) {
    setFloors((current) => [...current, floor]);
    setSelectedFloorId(floor.id);
  }

  function handleOptimisticTableAdd(table: DiningTableView) {
    setTables((current) => [...current, table]);
  }

  function handleTableCreateSettled(tempId: string, result: DiningTableView | null) {
    setTables((current) => (result ? current.map((t) => (t.id === tempId ? result : t)) : current.filter((t) => t.id !== tempId)));
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Floor Plan</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="floor-plan-summary">
            {tables.length} table{tables.length === 1 ? "" : "s"} across {floors.length} floor{floors.length === 1 ? "" : "s"}
          </p>
        </div>
        {floors.length > 0 && (
          <div className="flex gap-1 rounded-lg border border-border bg-input p-1" role="tablist" aria-label="Floor plan view" data-testid="floor-plan-view-toggle">
            <ViewToggleButton mode="canvas" current={view} onSelect={setView} icon={LayoutGrid} label="Canvas" />
            <ViewToggleButton mode="list" current={view} onSelect={setView} icon={TableProperties} label="List" />
          </div>
        )}
      </div>

      {floors.length === 0 ? (
        <div data-testid="floor-plan-no-floors" className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center">
          <Table2 className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-headline text-lg font-medium">No floor plan yet</p>
          <p className="max-w-md text-sm text-muted-foreground">Add your first floor to start laying out tables.</p>
          <div className="mt-3">
            <AddFloorControl outletId={outletId} triggerLabel="Add your first floor" triggerTestId="floor-plan-add-first-floor" onCreated={handleFloorCreated} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-2" data-testid="floor-plan-toolbar">
            <AddFloorControl outletId={outletId} triggerLabel="Add floor" triggerTestId="floor-plan-add-floor-button" onCreated={handleFloorCreated} />
            <AddTableControl
              outletId={outletId}
              floorId={selectedFloorId}
              tables={tables}
              onOptimisticAdd={handleOptimisticTableAdd}
              onSettled={handleTableCreateSettled}
            />
          </div>

          <div className="grid flex-1 grid-cols-[1fr_320px] gap-6">
            <div>
              {view === "canvas" ? (
                <FloorPlanCanvas
                  floors={floors}
                  tables={tables}
                  selectedFloorId={selectedFloorId}
                  onSelectFloor={setSelectedFloorId}
                  onTableMoved={handleTableMoved}
                />
              ) : (
                <FloorPlanListView floors={floors} tables={tables} onFieldCommitted={handleListFieldCommitted} />
              )}
            </div>
            <StationsPanel
              outletId={outletId}
              stations={stations}
              printers={printers}
              onStationUpdated={(saved) => setStations((current) => current.map((s) => (s.id === saved.id ? saved : s)))}
              onStationCreated={(created) => setStations((current) => [...current, created])}
              onPrinterCreated={(created) => setPrinters((current) => [...current, created])}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ViewToggleButton({
  mode,
  current,
  onSelect,
  icon: Icon,
  label,
}: Readonly<{ mode: ViewMode; current: ViewMode; onSelect: (mode: ViewMode) => void; icon: typeof LayoutGrid; label: string }>) {
  const active = mode === current;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={`floor-plan-view-${mode}`}
      onClick={() => onSelect(mode)}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" /> {label}
    </button>
  );
}

// --- Add floor (Story 10). Shared by the zero-floors empty state and the
// toolbar - the two never render at once (the empty state is replaced by the
// toolbar the moment floors.length > 0), so both call sites use the same
// data-testids without colliding.
interface AddFloorControlProps {
  outletId: string;
  triggerLabel: string;
  triggerTestId: string;
  onCreated: (floor: FloorView) => void;
}

function AddFloorControl({ outletId, triggerLabel, triggerTestId, onCreated }: Readonly<AddFloorControlProps>) {
  const pushToast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const floor = await createFloor(outletId, { name: trimmed });
      setName("");
      setOpen(false);
      onCreated(floor);
    } catch {
      pushToast({ kind: "error", message: `Couldn't add "${trimmed}". Try again.` });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" data-testid={triggerTestId} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} data-testid="floor-plan-add-floor-form" className="flex items-end gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <div>
        <label htmlFor="floor-plan-add-floor-name" className={TOOLBAR_LABEL_CLASS}>
          Floor name
        </label>
        <input
          id="floor-plan-add-floor-name"
          data-testid="floor-plan-add-floor-name"
          autoFocus
          required
          value={name}
          disabled={submitting}
          onChange={(event) => setName(event.target.value)}
          className={TOOLBAR_INPUT_CLASS}
        />
      </div>
      <Button type="submit" size="sm" data-testid="floor-plan-add-floor-submit" disabled={submitting || !name.trim()}>
        {submitting ? "Adding…" : "Save"}
      </Button>
      <Button type="button" size="sm" variant="ghost" data-testid="floor-plan-add-floor-cancel" disabled={submitting} onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

// --- Add table (Story 10). Click-to-place was rejected (see the story's
// Design Notes) in favour of a compact form with a computed default X/Y -
// computeNextTablePosition scans for the first open spot on the selected
// floor, still adjustable here and still checked live via findOverlap (the
// same helper the canvas uses for its drag-overlap preview), though the
// server's REJECT-with-409 policy remains the actual authority on save.
const TABLE_SHAPES: readonly TableShape[] = ["square", "circle", "rectangle"];
const DEFAULT_CAPACITY = "4";

interface AddTableControlProps {
  outletId: string;
  floorId: string;
  tables: readonly DiningTableView[];
  onOptimisticAdd: (table: DiningTableView) => void;
  onSettled: (tempId: string, result: DiningTableView | null) => void;
}

function AddTableControl({ outletId, floorId, tables, onOptimisticAdd, onSettled }: Readonly<AddTableControlProps>) {
  const pushToast = useToast();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [shape, setShape] = useState<TableShape>("square");
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [positionTouched, setPositionTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const floorTables = tables.filter((table) => table.floorId === floorId && !table.id.startsWith("temp-table-"));
  const size = SHAPE_SIZES[shape];
  const canvasBounds = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

  function openForm() {
    setPosition(computeNextTablePosition(floorTables, size, canvasBounds));
    setPositionTouched(false);
    setOpen(true);
  }

  function handleShapeChange(next: TableShape) {
    setShape(next);
    if (!positionTouched) setPosition(computeNextTablePosition(floorTables, SHAPE_SIZES[next], canvasBounds));
  }

  function handlePositionChange(axis: "x" | "y", value: string) {
    setPositionTouched(true);
    const parsed = Number.parseInt(value, 10);
    setPosition((current) => ({ ...current, [axis]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 }));
  }

  const overlapId = open ? findOverlap({ id: "__draft__", x: position.x, y: position.y, width: size.width, height: size.height }, floorTables) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedLabel = label.trim();
    const parsedCapacity = Number.parseInt(capacity, 10);
    if (!trimmedLabel || !Number.isFinite(parsedCapacity) || parsedCapacity < 1 || submitting) return;

    const input = { floorId, label: trimmedLabel, x: position.x, y: position.y, width: size.width, height: size.height, shape, seatCapacity: parsedCapacity };
    const tempId = nextTempTableId();
    onOptimisticAdd({ id: tempId, ...input });
    setSubmitting(true);
    try {
      const saved = await createTable(outletId, input);
      onSettled(tempId, saved);
      setLabel("");
      setShape("square");
      setCapacity(DEFAULT_CAPACITY);
      setOpen(false);
    } catch (error) {
      onSettled(tempId, null);
      const overlap = error instanceof AdminApiError && error.status === 409;
      pushToast({
        kind: "error",
        message: overlap ? "This spot overlaps another table there. Adjust the position and try again." : `Couldn't add ${trimmedLabel}. Try again.`,
      });
      // Form stays open with the entered values (per the story's I/O matrix)
      // so the user can nudge x/y and retry without retyping everything.
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" data-testid="floor-plan-add-table-button" disabled={!floorId} onClick={openForm}>
        Add table
      </Button>
    );
  }

  return (
    <form onSubmit={submit} data-testid="floor-plan-add-table-form" className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <div>
        <label htmlFor="floor-plan-add-table-label" className={TOOLBAR_LABEL_CLASS}>
          Label
        </label>
        <input
          id="floor-plan-add-table-label"
          data-testid="floor-plan-add-table-label"
          autoFocus
          required
          value={label}
          disabled={submitting}
          onChange={(event) => setLabel(event.target.value)}
          className={`${TOOLBAR_INPUT_CLASS} w-24`}
        />
      </div>
      <div>
        <label htmlFor="floor-plan-add-table-shape" className={TOOLBAR_LABEL_CLASS}>
          Shape
        </label>
        <select
          id="floor-plan-add-table-shape"
          data-testid="floor-plan-add-table-shape"
          value={shape}
          disabled={submitting}
          onChange={(event) => handleShapeChange(event.target.value as TableShape)}
          className={TOOLBAR_INPUT_CLASS}
        >
          {TABLE_SHAPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="floor-plan-add-table-capacity" className={TOOLBAR_LABEL_CLASS}>
          Seats
        </label>
        <input
          id="floor-plan-add-table-capacity"
          type="number"
          min={1}
          data-testid="floor-plan-add-table-capacity"
          value={capacity}
          disabled={submitting}
          onChange={(event) => setCapacity(event.target.value)}
          className={`${TOOLBAR_INPUT_CLASS} w-16`}
        />
      </div>
      <input
        type="number"
        min={0}
        aria-label={`${label || "New table"} X position`}
        data-testid="floor-plan-add-table-x"
        value={position.x}
        disabled={submitting}
        onChange={(event) => handlePositionChange("x", event.target.value)}
        className={`${TOOLBAR_INPUT_CLASS} w-16`}
      />
      <input
        type="number"
        min={0}
        aria-label={`${label || "New table"} Y position`}
        data-testid="floor-plan-add-table-y"
        value={position.y}
        disabled={submitting}
        onChange={(event) => handlePositionChange("y", event.target.value)}
        className={`${TOOLBAR_INPUT_CLASS} w-16`}
      />
      {overlapId && (
        <p data-testid="floor-plan-add-table-overlap-warning" className="w-full text-xs text-status-error">
          This position overlaps another table. Adjust X/Y before saving.
        </p>
      )}
      <Button type="submit" size="sm" data-testid="floor-plan-add-table-submit" disabled={submitting || !label.trim()}>
        {submitting ? "Adding…" : "Save"}
      </Button>
      <Button type="button" size="sm" variant="ghost" data-testid="floor-plan-add-table-cancel" disabled={submitting} onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
