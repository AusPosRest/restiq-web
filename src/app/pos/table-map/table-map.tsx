"use client";

// P2 Table Map View (CAP-2). EXPERIENCE.md IA: "Table Map -> P2 - tap an
// empty table to start an order, tap an occupied one to open it". Empty-shift
// state renders the floor as-is, no promotional empty state (EXPERIENCE.md
// State Patterns).
//
// Also links to /pos/open-orders (CAP-5, story 6): the table map still isn't
// nested under src/app/pos/(shell)/ (a known gap - see
// wiki/features/pos-cashier-waiter.md's Integration points), so it doesn't
// get the shell's persistent shift-bar nav. Without this link, Open & Held
// Orders would only be reachable from the shell's other pages, not from the
// table map itself - EXPERIENCE.md's IA calls it reachable "from anywhere".
//
// Also links to /pos/counter (CAP-6, story 7): EXPERIENCE.md's real IA picks
// Table Map vs. QSR Counter at login by outlet capability, but nothing in
// this prototype's session model carries that capability yet (a pre-existing
// gap - src/app/pos/(shell)/page.tsx's placeholder still notes it). Same
// precedent as the Open Orders link above: a direct nav link is the concrete
// way to actually reach the counter screen today, rather than shipping a
// route nothing links to.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { startOrder, transferOrder, PosApiError } from "../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { usePosLoad } from "../use-pos-load";
import {
  deriveTapAction,
  groupTablesByFloor,
  TABLE_STATUS_LABEL,
  toTableMapEntry,
  type RawTableMapEntry,
  type TableMapEntry,
} from "./table-map-state";
import { TableTile } from "./table-shape";
import { TransferOwnershipDialog } from "./transfer-ownership-dialog";

const LEGEND_STATUSES = ["empty", "occupied"] as const;

export function TableMap({
  outletId,
  currentStaffId,
  currentStaffName,
}: Readonly<{ outletId: string; currentStaffId: string; currentStaffName: string }>) {
  const { loading, failed, data, retry } = usePosLoad<RawTableMapEntry[]>(`outlets/${outletId}/table-map`);

  if (loading) return <LoadingShell />;
  if (failed || !data) {
    return <LoadErrorPanel testId="table-map-error" message="Couldn't load the table map." onRetry={retry} />;
  }
  return (
    <TableMapLoaded
      initial={data.map(toTableMapEntry)}
      outletId={outletId}
      currentStaffId={currentStaffId}
      currentStaffName={currentStaffName}
      onReload={retry}
    />
  );
}

function TableMapLoaded({
  initial,
  outletId,
  currentStaffId,
  currentStaffName,
  onReload,
}: Readonly<{ initial: TableMapEntry[]; outletId: string; currentStaffId: string; currentStaffName: string; onReload: () => void }>) {
  const router = useRouter();
  const [tables, setTables] = useState(initial);
  const [pendingTransfer, setPendingTransfer] = useState<{ tableId: string; orderId: string; tableLabel: string; ownerId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const groups = groupTablesByFloor(tables);

  function handleTap(tableId: string) {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    setActionError(null);
    const action = deriveTapAction(table, currentStaffId);

    if (action.type === "start_order") {
      setBusy(true);
      startOrder(outletId, tableId)
        .then((order) => {
          setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status: "occupied", order: { id: order.id, ownerStaffId: order.ownerId } } : t)));
          router.push(`/pos/orders/${order.id}`);
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
    setPendingTransfer({ tableId, orderId: action.orderId, tableLabel: table.label, ownerId: action.ownerId });
  }

  function handleTransferConfirm(reason: string) {
    if (!pendingTransfer) return;
    setBusy(true);
    transferOrder(pendingTransfer.orderId, currentStaffId, reason || undefined)
      .then((order) => {
        setTables((prev) => prev.map((t) => (t.id === pendingTransfer.tableId ? { ...t, order: { id: order.id, ownerStaffId: order.ownerId } } : t)));
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
            Signed in as <span className="font-semibold text-foreground">{currentStaffName}</span>
          </p>
          <Link
            href="/pos/open-orders"
            data-testid="table-map-open-orders-link"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Open orders
          </Link>
          <Link
            href="/pos/counter"
            data-testid="table-map-counter-link"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Switch to Counter Mode
          </Link>
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
        <section key={group.floorId} data-testid={`floor-group-${group.floorId}`} className="flex flex-col gap-3">
          <h2 className="font-label text-sm font-semibold uppercase tracking-wider text-muted-foreground">{group.floorName}</h2>
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
          originLabel={`Table ${pendingTransfer.tableLabel}`}
          ownerName={pendingTransfer.ownerId}
          busy={busy}
          onCancel={() => setPendingTransfer(null)}
          onConfirm={handleTransferConfirm}
        />
      )}
    </div>
  );
}

function LegendItem({ status }: Readonly<{ status: (typeof LEGEND_STATUSES)[number] }>) {
  const dotClass = status === "empty" ? "border-2 border-status-available" : "bg-status-occupied";
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
