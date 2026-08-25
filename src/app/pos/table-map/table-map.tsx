"use client";

// P2 Table Map View (CAP-2). EXPERIENCE.md IA: "Table Map -> P2 - tap an
// empty table to start an order, tap an occupied one to open it". Empty-shift
// state renders the floor as-is, no promotional empty state (EXPERIENCE.md
// State Patterns).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { startOrder, transferOrder, PosApiError } from "../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { usePosLoad } from "../use-pos-load";
import { deriveTapAction, groupTablesByFloor, TABLE_STATUS_LABEL, type TableMapView } from "./table-map-state";
import { TableTile } from "./table-shape";
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";

const LEGEND_STATUSES = ["empty", "occupied", "needs_bill"] as const;

export function TableMap() {
  const { loading, failed, data, retry } = usePosLoad<TableMapView>("table-map");

  if (loading) return <LoadingShell />;
  if (failed || !data) {
    return <LoadErrorPanel testId="table-map-error" message="Couldn't load the table map." onRetry={retry} />;
  }
  return <TableMapLoaded initial={data} onReload={retry} />;
}

function TableMapLoaded({ initial, onReload }: Readonly<{ initial: TableMapView; onReload: () => void }>) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [pendingTransfer, setPendingTransfer] = useState<{ tableId: string; orderId: string; tableLabel: string; ownerName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const groups = groupTablesByFloor(view.floors, view.tables);

  function handleTap(tableId: string) {
    const table = view.tables.find((t) => t.id === tableId);
    if (!table) return;
    setActionError(null);
    const action = deriveTapAction(table, view.currentStaff.id);

    if (action.type === "start_order") {
      setBusy(true);
      startOrder(tableId)
        .then((updated) => {
          setView((prev) => ({ ...prev, tables: prev.tables.map((t) => (t.id === tableId ? updated : t)) }));
          if (updated.order) router.push(`/pos/orders/${updated.order.id}`);
        })
        .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't start an order for this table.")))
        .finally(() => setBusy(false));
      return;
    }

    if (action.type === "open_order") {
      router.push(`/pos/orders/${action.orderId}`);
      return;
    }

    // transfer_required - never a silent open, per SPEC CAP-2 success criterion.
    setPendingTransfer({ tableId, orderId: action.orderId, tableLabel: table.label, ownerName: action.ownerName });
  }

  function handleTransferConfirm(reason: string) {
    if (!pendingTransfer) return;
    setBusy(true);
    transferOrder(pendingTransfer.orderId, reason || undefined)
      .then((updated) => {
        setView((prev) => ({ ...prev, tables: prev.tables.map((t) => (t.id === pendingTransfer.tableId ? updated : t)) }));
        setPendingTransfer(null);
        router.push(`/pos/orders/${pendingTransfer.orderId}`);
      })
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't transfer this table.")))
      .finally(() => setBusy(false));
  }

  return (
    <div data-testid="table-map" className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-headline text-xl font-bold text-primary">RESTIQ POS</p>
          <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Table Map</p>
        </div>
        <div className="flex items-center gap-4">
          <p data-testid="current-staff" className="font-label text-sm text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{view.currentStaff.name}</span>
          </p>
          <button
            type="button"
            data-testid="table-map-refresh"
            onClick={onReload}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Refresh
          </button>
        </div>
      </header>

      <div data-testid="status-legend" className="flex flex-wrap gap-4">
        {LEGEND_STATUSES.map((status) => (
          <LegendItem key={status} status={status} />
        ))}
      </div>

      {actionError && (
        <div role="alert" data-testid="table-map-action-error" className="rounded-lg border border-status-alert/40 bg-card px-4 py-3 text-sm text-status-alert">
          {actionError}{" "}
          <button type="button" className="underline" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.floor.id} data-testid={`floor-group-${group.floor.id}`} className="flex flex-col gap-3">
          <h2 className="font-label text-sm font-semibold uppercase tracking-wider text-muted-foreground">{group.floor.name}</h2>
          {group.tables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tables on this floor.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {group.tables.map((table) => (
                <TableTile key={table.id} table={table} onTap={() => !busy && handleTap(table.id)} />
              ))}
            </div>
          )}
        </section>
      ))}

      {pendingTransfer && (
        <TransferOwnershipDialog
          open
          tableLabel={pendingTransfer.tableLabel}
          ownerName={pendingTransfer.ownerName}
          busy={busy}
          onCancel={() => setPendingTransfer(null)}
          onConfirm={handleTransferConfirm}
        />
      )}
    </div>
  );
}

function LegendItem({ status }: Readonly<{ status: (typeof LEGEND_STATUSES)[number] }>) {
  const dotClass =
    status === "empty" ? "border-2 border-status-available" : status === "occupied" ? "bg-status-occupied" : "bg-status-warning";
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`size-3 rounded-full ${dotClass}`} aria-hidden="true" />
      {TABLE_STATUS_LABEL[status]}
    </span>
  );
}

function LoadingShell() {
  return (
    <div data-testid="table-map-loading" className="flex flex-1 flex-col gap-6 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof PosApiError ? error.message : fallback;
}
