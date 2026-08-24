"use client";

// T5 Floor Plan (CAP-5): per-outlet, scoped by the shell's outlet switcher
// (EXPERIENCE.md IA: "Floor Plan → T5 (per-outlet; outlet switcher scopes
// it)") - same key={selectedOutletId} remount shape as Settings/Capabilities
// so an edit in flight for outlet A can never bleed into outlet B.
import { LayoutGrid, Table2, TableProperties } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminApiError, fetchFloorPlan, updateTable } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useOutlets } from "../outlet-context";
import { useToast } from "../toast";
import { FloorPlanCanvas } from "./floor-plan-canvas";
import type { DiningTableView, FloorPlanView, StationView } from "./floor-plan-state";
import { FloorPlanListView, type EditableTableField } from "./floor-plan-list-view";
import { StationsPanel } from "./stations-panel";

type ViewMode = "canvas" | "list";

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
  const [tables, setTables] = useState<DiningTableView[]>(initial.tables);
  const [stations, setStations] = useState<StationView[]>(initial.stations);
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

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Floor Plan</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="floor-plan-summary">
            {tables.length} table{tables.length === 1 ? "" : "s"} across {initial.floors.length} floor{initial.floors.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-input p-1" role="tablist" aria-label="Floor plan view" data-testid="floor-plan-view-toggle">
          <ViewToggleButton mode="canvas" current={view} onSelect={setView} icon={LayoutGrid} label="Canvas" />
          <ViewToggleButton mode="list" current={view} onSelect={setView} icon={TableProperties} label="List" />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[1fr_320px] gap-6">
        <div>
          {view === "canvas" ? (
            <FloorPlanCanvas
              floors={initial.floors}
              tables={tables}
              selectedFloorId={selectedFloorId}
              onSelectFloor={setSelectedFloorId}
              onTableMoved={handleTableMoved}
            />
          ) : (
            <FloorPlanListView floors={initial.floors} tables={tables} onFieldCommitted={handleListFieldCommitted} />
          )}
        </div>
        <StationsPanel
          outletId={outletId}
          stations={stations}
          printers={initial.printers}
          onStationUpdated={(saved) => setStations((current) => current.map((s) => (s.id === saved.id ? saved : s)))}
        />
      </div>
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
