"use client";

// P7 QSR Counter (CAP-6, story 7). Composes the real, already-merged
// order-taking screen's grid (POSItemTile/ModifierSheet/order-taking-state.ts,
// story 4/#51) and the real, already-merged bill & settle screen's
// BillSummary/TenderKeypad (story 8/#55) into one continuous ring-up-and-
// settle flow - SPEC CAP-6's success criterion: "Completing a counter order
// issues a sequential token number and finalises the bill in the same
// action - no separate waiter hop." Neither reused component's own tested
// behavior changes here: BillSummary's line-edit steppers are new, additive,
// opt-in props (see bill-summary.tsx's header) that story 8's own caller
// (bill-settle-view.tsx) never passes, and TenderKeypad/ModifierSheet/
// PosItemTile are used completely unmodified. This file is composition glue
// plus the one genuinely new action CAP-6 needs: starting a table-less order
// that carries a token number (`startCounterOrder`, `../api.ts`).
//
// No separate `/settle` navigation hop, unlike the dine-in flow
// (order-taking-view.tsx's OrderPanel links out to orders/[id]/settle):
// ringing up and charging both happen right here, on `/pos/counter`, for the
// whole life of one counter order. Once a bill finalises, "Start next order"
// swaps in a brand new counter order (a fresh token number) without ever
// leaving this route - EXPERIENCE.md's "the next customer is already at the
// counter before Ravi looks up."
//
// SELF-AUTHORED CONTRACT, not yet verified against a real backend -
// restiq-backend#62 ("QSR counter and token mode") had no branch or commits
// as of this build (confirmed via `gh issue view 62` / `gh api .../branches`
// against AusPosRest/restiq-backend - only dev/main/feature/15-device-fleet
// exist). See `../api.ts`'s `startCounterOrder` header for the full
// reasoning, including what the real, merged backend `dev` branch's
// `OrderView`/`Bill` shapes actually look like (read directly while
// researching this story) and why this story deliberately keeps building
// against restiq-web's own already-shipped self-authored contract
// (order-taking-state.ts/bill-state.ts) rather than the real backend shapes -
// reconciling CAP-3/CAP-4/CAP-7 against those is a separate, much larger
// undertaking outside this story's scope, already flagged in
// wiki/features/pos-cashier-waiter.md's Integration points for CAP-2/CAP-3.
// `tokenNumber` (order-taking-state.ts) and `startCounterOrder` (api.ts) are
// this story's own additions on top of that existing contract.
//
// Discount is deliberately not offered here (YAGNI) - the P7 mock has no
// discount affordance and this story's own brief never asks for one;
// BillSummary's `onAddDiscount` prop is optional precisely so omitting it
// here doesn't render a non-functional button.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addOrderLine,
  addBillTender,
  fetchBill,
  finalizeBill,
  PosApiError,
  removeOrderLine,
  startCounterOrder,
  updateOrderLineQuantity,
  type BillTenderMethod,
  type BillView,
  type OrderLineView,
  type OrderView,
  type PosMenuItemView,
  type PosMenuView,
} from "../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { usePosLoad } from "../use-pos-load";
import { ModifierSheet, type ModifierSheetConfirmValue } from "../orders/[orderId]/modifier-sheet";
import { PosItemTile } from "../orders/[orderId]/pos-item-tile";
import { filterMenuItems, itemNeedsModifierSheet } from "../orders/[orderId]/order-taking-state";
import { BillSummary } from "../orders/[orderId]/settle/bill-summary";
import { TenderKeypad } from "../orders/[orderId]/settle/tender-keypad";
import { canFinalizeBill, isBillReadOnly } from "../orders/[orderId]/settle/bill-state";
import { TokenBadge } from "./token-badge";

export function CounterView() {
  const menuLoad = usePosLoad<PosMenuView>("menu");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [orderStarting, setOrderStarting] = useState(true);
  const [orderError, setOrderError] = useState(false);
  const startedRef = useRef(false);

  function beginNewOrder() {
    setOrderStarting(true);
    setOrderError(false);
    setOrder(null);
    startCounterOrder()
      .then(setOrder)
      .catch(() => setOrderError(true))
      .finally(() => setOrderStarting(false));
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    beginNewOrder();
  }, []);

  if (menuLoad.loading || orderStarting) return <LoadingShell />;
  if (menuLoad.failed || !menuLoad.data) {
    return <LoadErrorPanel testId="counter-menu-error" message="Couldn't load the menu." onRetry={menuLoad.retry} />;
  }
  if (orderError || !order) {
    return <LoadErrorPanel testId="counter-order-error" message="Couldn't start a counter order." onRetry={beginNewOrder} />;
  }

  // Keyed on the order id: finalizing and starting the next counter order
  // swaps in a brand new id, remounting CounterLoaded fresh rather than
  // hand-resetting every piece of its ring-up-in-progress state.
  return <CounterLoaded key={order.id} menu={menuLoad.data} initialOrder={order} onStartNextOrder={beginNewOrder} />;
}

function CounterLoaded({
  menu,
  initialOrder,
  onStartNextOrder,
}: Readonly<{ menu: PosMenuView; initialOrder: OrderView; onStartNextOrder: () => void }>) {
  const [order, setOrder] = useState(initialOrder);
  const [bill, setBill] = useState<BillView | null>(null);
  const [billLoading, setBillLoading] = useState(true);
  const [billError, setBillError] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeItem, setActiveItem] = useState<PosMenuItemView | null>(null);
  const [addingLine, setAddingLine] = useState(false);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tenderBusy, setTenderBusy] = useState(false);
  const [tenderError, setTenderError] = useState<string | null>(null);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  function loadBill() {
    setBillLoading(true);
    setBillError(false);
    fetchBill(order.id)
      .then(setBill)
      .catch(() => setBillError(true))
      .finally(() => setBillLoading(false));
  }

  // Runs once per mounted counter order (this component remounts wholesale -
  // see the `key={order.id}` above - rather than re-running for the same
  // order), same "no optimistic local patch, always replace from the
  // server's response" convention order-taking-view.tsx/bill-settle-view.tsx
  // already use. Fetches directly (mirroring use-pos-load.ts's own effect)
  // rather than calling the `loadBill` helper above, so the effect's own
  // synchronous body never calls setState itself - only the async
  // then/catch/finally callbacks do, same react-hooks/set-state-in-effect
  // shape use-pos-load.ts's hook already satisfies.
  useEffect(() => {
    let cancelled = false;
    // No synchronous setState here (billLoading/billError already start at
    // their correct mount-time values) - only the async callbacks below set
    // state, same shape use-pos-load.ts's hook already satisfies.
    fetchBill(initialOrder.id)
      .then((value) => {
        if (!cancelled) setBill(value);
      })
      .catch(() => {
        if (!cancelled) setBillError(true);
      })
      .finally(() => {
        if (!cancelled) setBillLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedCategories = useMemo(() => [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder), [menu.categories]);
  const effectiveCategoryId = selectedCategoryId ?? sortedCategories[0]?.id ?? null;
  const visibleItems = useMemo(() => filterMenuItems(menu.items, effectiveCategoryId, query), [menu.items, effectiveCategoryId, query]);
  const activeCategory = sortedCategories.find((category) => category.id === effectiveCategoryId) ?? null;

  function submitLine(itemId: string, value: ModifierSheetConfirmValue, onSettled: () => void) {
    setAddingLine(true);
    setActionError(null);
    addOrderLine(order.id, {
      itemId,
      variantId: value.variantId ?? undefined,
      quantity: value.quantity,
      modifierIds: value.modifierIds,
      specialInstructions: value.specialInstructions || undefined,
    })
      .then((updated) => {
        setOrder(updated);
        loadBill();
        onSettled();
      })
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't add that item to the order.")))
      .finally(() => setAddingLine(false));
  }

  function handleTapItem(item: PosMenuItemView) {
    if (addingLine) return;
    if (itemNeedsModifierSheet(item)) {
      setActiveItem(item);
      return;
    }
    submitLine(item.id, { variantId: null, modifierIds: [], quantity: 1, specialInstructions: "" }, () => undefined);
  }

  function handleConfirmModifiers(value: ModifierSheetConfirmValue) {
    if (!activeItem) return;
    submitLine(activeItem.id, value, () => setActiveItem(null));
  }

  function handleIncrement(line: OrderLineView) {
    setBusyLineId(line.id);
    setActionError(null);
    updateOrderLineQuantity(order.id, line.id, line.quantity + 1)
      .then((updated) => {
        setOrder(updated);
        loadBill();
      })
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't update that line.")))
      .finally(() => setBusyLineId(null));
  }

  function handleDecrement(line: OrderLineView) {
    setBusyLineId(line.id);
    setActionError(null);
    const request = line.quantity <= 1 ? removeOrderLine(order.id, line.id) : updateOrderLineQuantity(order.id, line.id, line.quantity - 1);
    request
      .then((updated) => {
        setOrder(updated);
        loadBill();
      })
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't update that line.")))
      .finally(() => setBusyLineId(null));
  }

  function handleRemove(line: OrderLineView) {
    setBusyLineId(line.id);
    setActionError(null);
    removeOrderLine(order.id, line.id)
      .then((updated) => {
        setOrder(updated);
        loadBill();
      })
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't remove that line.")))
      .finally(() => setBusyLineId(null));
  }

  function handleAddTender(method: BillTenderMethod, amountMinor: number) {
    setTenderBusy(true);
    setTenderError(null);
    addBillTender(order.id, { method, amountMinor })
      .then(setBill)
      .catch((error: unknown) => setTenderError(errorMessage(error, "Couldn't add that tender.")))
      .finally(() => setTenderBusy(false));
  }

  function handleFinalize() {
    setFinalizeBusy(true);
    setFinalizeError(null);
    finalizeBill(order.id)
      .then(setBill)
      .catch((error: unknown) => setFinalizeError(errorMessage(error, "Couldn't finalise this bill.")))
      .finally(() => setFinalizeBusy(false));
  }

  if (billError) {
    return <LoadErrorPanel testId="counter-bill-error" message="Couldn't load the bill." onRetry={loadBill} />;
  }
  if (billLoading || !bill) return <LoadingShell />;

  const readOnly = isBillReadOnly(bill);

  return (
    <div data-testid="counter-view" className="flex flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border/60 px-6 py-3">
        <div>
          <p className="font-headline text-lg font-bold text-primary">RESTIQ POS</p>
          <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">QSR Counter</p>
        </div>
        <Link href="/pos/table-map" data-testid="switch-to-table-mode" className="text-sm text-primary underline-offset-4 hover:underline">
          Switch to Table Mode
        </Link>
        {!readOnly && (
          <div className="relative ml-auto w-80 max-w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              data-testid="menu-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search menu"
              className="w-full rounded-lg border border-border bg-input py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}
        <div className={`flex items-center gap-3 ${readOnly ? "ml-auto" : ""}`}>
          <p data-testid="counter-cashier" className="text-sm text-muted-foreground">
            Cashier <span className="font-semibold text-foreground">{order.ownerStaffName}</span>
          </p>
          {typeof order.tokenNumber === "number" && <TokenBadge tokenNumber={order.tokenNumber} />}
        </div>
      </header>

      {actionError && (
        <div role="alert" data-testid="counter-action-error" className="mx-6 mt-4 rounded-lg border border-status-alert/40 bg-card px-4 py-3 text-sm text-status-alert">
          {actionError}{" "}
          <button type="button" className="underline" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {!readOnly && (
          <>
            <nav data-testid="category-tabs" className="flex w-36 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border/60 p-3">
              {sortedCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  data-testid={`category-tab-${category.id}`}
                  aria-pressed={category.id === effectiveCategoryId}
                  onClick={() => {
                    setSelectedCategoryId(category.id);
                    setQuery("");
                  }}
                  className={`rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors ${
                    category.id === effectiveCategoryId ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </nav>

            <main className="flex-1 overflow-y-auto p-4">
              <h2 className="mb-3 font-headline text-base font-semibold text-foreground">
                {query.trim() ? "Search results" : activeCategory?.name} <span className="font-normal text-muted-foreground">· {visibleItems.length} items</span>
              </h2>
              {visibleItems.length === 0 ? (
                <p data-testid="menu-empty" className="text-sm text-muted-foreground">
                  No items match.
                </p>
              ) : (
                <div data-testid="item-grid" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {visibleItems.map((item) => (
                    <PosItemTile key={item.id} item={item} currency={menu.currency} onTap={() => item.available && handleTapItem(item)} />
                  ))}
                </div>
              )}
            </main>
          </>
        )}

        <BillSummary
          bill={bill}
          busyLineId={busyLineId}
          onIncrement={readOnly ? undefined : handleIncrement}
          onDecrement={readOnly ? undefined : handleDecrement}
          onRemove={readOnly ? undefined : handleRemove}
        />

        {readOnly ? (
          <section data-testid="counter-settled-panel" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="font-headline text-xl font-semibold text-status-available">Order settled</p>
            <p className="text-sm text-muted-foreground">
              {bill.tenders.length} tender{bill.tenders.length === 1 ? "" : "s"} captured · no further changes are possible.
            </p>
            <Button size="lg" data-testid="counter-start-next-order" onClick={onStartNextOrder}>
              Start next order
            </Button>
          </section>
        ) : (
          <div className="flex flex-1 flex-col">
            <TenderKeypad
              currency={bill.currency}
              remainingMinor={bill.remainingMinor}
              tenders={bill.tenders}
              busy={tenderBusy}
              error={tenderError}
              onAddTender={handleAddTender}
            />
            <footer className="border-t border-border/60 p-4">
              {finalizeError && (
                <p role="alert" data-testid="finalize-error" className="mb-2 text-sm text-status-alert">
                  {finalizeError}
                </p>
              )}
              <Button size="lg" className="w-full" data-testid="finalize-bill" disabled={!canFinalizeBill(bill) || finalizeBusy} onClick={handleFinalize}>
                {finalizeBusy ? "Charging…" : "Charge"}
              </Button>
            </footer>
          </div>
        )}
      </div>

      {activeItem && (
        <ModifierSheet item={activeItem} currency={menu.currency} busy={addingLine} onCancel={() => setActiveItem(null)} onConfirm={handleConfirmModifiers} />
      )}
    </div>
  );
}

function LoadingShell() {
  return (
    <div data-testid="counter-loading" className="flex flex-1 flex-col gap-4 p-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof PosApiError ? error.message : fallback;
}
