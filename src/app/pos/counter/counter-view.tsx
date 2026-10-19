"use client";

// P7 QSR Counter (CAP-6, story 7). Composes the real, already-merged
// order-taking screen's grid (POSItemTile/ModifierSheet/order-taking-state.ts,
// story 4/#51) and the real, already-merged bill & settle screen's
// BillSummary/TenderKeypad (story 8/#55) into one continuous ring-up-and-
// settle flow - SPEC CAP-6's success criterion: "Completing a counter order
// issues a sequential token number and finalises the bill in the same
// action - no separate waiter hop." No separate `/settle` navigation hop,
// unlike the dine-in flow: ringing up and charging both happen right here,
// on `/pos/counter`, for the whole life of one counter order. Once a bill
// finalizes, "Start next order" swaps in a brand new counter order (a fresh
// token number) without ever leaving this route.
//
// RECONCILED (2026-09-02, restiq-web#98) against the real, merged
// restiq-backend contract:
//  - `startCounterOrder` is outlet-scoped (`POST
//    outlets/:outletId/counter-orders`, `orders.controller.ts`'s
//    `createCounterOrder`, read directly) and returns the same raw wire
//    shape (`RawOrder`) every other order mutation does - `outletId` now
//    comes from `page.tsx` (server-resolved from the session cookie, same
//    pattern as table-map/shift), and the raw order is mapped through
//    `toOrderView` exactly like order-taking-view.tsx.
//  - the Bill is created-or-fetched (`fetchOrCreateBill`), not GET-and-render
//    - see settle/bill-state.ts's file header for why there's no per-order
//    GET. A Bill carries no lines of its own, but this screen already has
//    the Order's real lines in state, so BillSummary reads `order.lines`
//    directly rather than a second fetch.
//  - tenders accumulate locally and only ever submit together with Finalize
//    (`FinalizeBillDto` has no per-tender endpoint) - discount stays
//    deliberately unoffered here (YAGNI, unchanged from the original story).
//
// restiq-web#343 (PE-16/SE-27/CU-13): the counter order - and its token - is
// created lazily on the FIRST item, never on page open, and the order in
// progress is remembered for this tab (counter-session.ts) so a reload
// resumes it instead of orphaning it. An order emptied again can be
// discarded.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComboPicker, type ComboPickerConfirmValue } from "@/components/combo-picker";
import { combosFor, type ComboMenuView } from "@/lib/combo";
import { PrintBillButton } from "../bills/print-bill-button";
import {
  addComboLine,
  addOrderLine,
  discardOrder,
  fetchOrCreateBill,
  fetchOrder,
  finalizeBill,
  getBill,
  PosApiError,
  removeOrderLine,
  startCounterOrder,
  updateOrderLineQuantity,
  type PostableTenderMethod,
  type BillView,
  type PendingTender,
} from "../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { usePosLoad } from "../use-pos-load";
import { ModifierSheet, type ModifierSheetConfirmValue } from "../orders/[orderId]/modifier-sheet";
import { PosComboTile } from "../orders/[orderId]/pos-combo-tile";
import { PosItemTile } from "../orders/[orderId]/pos-item-tile";
import {
  filterMenuItems,
  formatPriceMinor,
  itemNeedsModifierSheet,
  orderOriginLabel,
  toOrderView,
  type OrderLineView,
  type OrderView,
  type PosMenuItemView,
  type PosMenuView,
} from "../orders/[orderId]/order-taking-state";
import { BillSummary } from "../orders/[orderId]/settle/bill-summary";
import { formatMinor } from "../(shell)/shift/shift-state";
import { TenderKeypad } from "../orders/[orderId]/settle/tender-keypad";
import { billTotalMinor, isBillReadOnly } from "../orders/[orderId]/settle/bill-state";
import { canFinalizeWithElectronic, cashChangeMinor, isElectronicMethod, remainingToTenderMinor, tendersForFinalize } from "../orders/[orderId]/settle/electronic-tender-state";
import { TerminalIntentPanel } from "../orders/[orderId]/settle/terminal-intent-panel";
import { useTerminalIntent } from "../orders/[orderId]/settle/use-terminal-intent";
import { PosHeader } from "../components/pos-header";
import { TokenBadge } from "./token-badge";
import { clearCounterOrderId, readCounterOrderId, saveCounterOrderId } from "./counter-session";
import { openDrawerForTenders } from "@/lib/desktop";
import { useShiftOpen } from "../(shell)/shift/use-shift-open";

export function CounterView({
  outletId,
  currentStaffId,
  currentStaffName,
}: Readonly<{ outletId: string; currentStaffId: string; currentStaffName: string }>) {
  const menuLoad = usePosLoad<PosMenuView>("menu");
  const shiftOpen = useShiftOpen(outletId);
  // undefined = still checking this tab for an order in progress; null = none (a fresh, not-yet-created order).
  const [resumed, setResumed] = useState<OrderView | null | undefined>(undefined);
  // Bumped by "Start next order" / discard so CounterLoaded remounts empty.
  const [round, setRound] = useState(0);

  const menu = menuLoad.data;
  useEffect(() => {
    if (!menu) return;
    let cancelled = false;
    const savedId = readCounterOrderId(currentStaffId);
    const lookup: Promise<OrderView | null> = savedId
      ? fetchOrder(savedId, menu).then(
          (order) => (order.status !== "closed" && order.ownerStaffId === currentStaffId ? order : null),
          () => null,
        )
      : Promise.resolve(null);
    void lookup.then((order) => {
      if (cancelled) return;
      if (!order) clearCounterOrderId(currentStaffId);
      setResumed(order);
    });
    return () => {
      cancelled = true;
    };
  }, [menu, currentStaffId]);

  if (menuLoad.failed) {
    return <LoadErrorPanel testId="counter-menu-error" message="Couldn't load the menu." onRetry={menuLoad.retry} />;
  }
  if (!menu || resumed === undefined) return <LoadingShell />;

  function startNextOrder() {
    clearCounterOrderId(currentStaffId);
    setResumed(null);
    setRound((n) => n + 1);
  }

  return (
    <CounterLoaded
      key={`${round}:${resumed?.id ?? "new"}`}
      outletId={outletId}
      menu={menu}
      initialOrder={resumed}
      currentStaffId={currentStaffId}
      currentStaffName={currentStaffName}
      shiftOpen={shiftOpen}
      onStartNextOrder={startNextOrder}
    />
  );
}

function CounterLoaded({
  outletId,
  menu,
  initialOrder,
  currentStaffId,
  currentStaffName,
  shiftOpen,
  onStartNextOrder,
}: Readonly<{
  outletId: string;
  menu: PosMenuView;
  initialOrder: OrderView | null;
  currentStaffId: string;
  currentStaffName: string;
  shiftOpen: boolean | null;
  onStartNextOrder: () => void;
}>) {
  // null until the first item is rung up - opening the screen creates nothing (PE-16).
  const [order, setOrder] = useState<OrderView | null>(initialOrder);
  const [bill, setBill] = useState<BillView | null>(null);
  const [billError, setBillError] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeItem, setActiveItem] = useState<PosMenuItemView | null>(null);
  const [activeCombo, setActiveCombo] = useState<ComboMenuView | null>(null);
  const [addingLine, setAddingLine] = useState(false);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingTenders, setPendingTenders] = useState<PendingTender[]>([]);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [changeGiven, setChangeGiven] = useState(0);
  const [discarding, setDiscarding] = useState(false);

  // Refreshes after add / quantity / remove / tender keep the counter on
  // screen (#269) - no loading shell for a refresh.
  function loadBill(orderId: string) {
    setBillError(false);
    fetchOrCreateBill(orderId)
      .then(setBill)
      .catch(() => setBillError(true));
  }

  // Card terminal (issue #188): a quiet re-read once the terminal approves -
  // the tender is already on the server; no loading shell for a refresh.
  const terminal = useTerminalIntent(
    bill?.id ?? null,
    () => {
      if (!bill) return;
      getBill(bill.id)
        .then(setBill)
        .catch(() => undefined);
    },
    outletId,
  );

  // A resumed order's bill, once (this component remounts per order).
  useEffect(() => {
    if (!initialOrder) return;
    let cancelled = false;
    fetchOrCreateBill(initialOrder.id)
      .then((value) => {
        if (!cancelled) setBill(value);
      })
      .catch(() => {
        if (!cancelled) setBillError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The order in progress, created (with its token) on the first item only. */
  function ensureOrder(): Promise<OrderView> {
    if (order) return Promise.resolve(order);
    return startCounterOrder(outletId).then((raw) => {
      const created = toOrderView(raw, menu);
      saveCounterOrderId(currentStaffId, created.id);
      setOrder(created);
      return created;
    });
  }

  function applyUpdate(updated: OrderView) {
    setOrder(updated);
    loadBill(updated.id);
  }

  const sortedCategories = useMemo(() => [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder), [menu.categories]);
  const effectiveCategoryId = selectedCategoryId ?? sortedCategories[0]?.id ?? null;
  const visibleItems = useMemo(() => filterMenuItems(menu.items, effectiveCategoryId, query), [menu.items, effectiveCategoryId, query]);
  const visibleCombos = useMemo(() => combosFor(menu.combos, effectiveCategoryId, query), [menu.combos, effectiveCategoryId, query]);
  const itemsById = useMemo(() => new Map(menu.items.map((item) => [item.id, item])), [menu.items]);
  const activeCategory = sortedCategories.find((category) => category.id === effectiveCategoryId) ?? null;

  function submitLine(itemId: string, value: ModifierSheetConfirmValue, onSettled: () => void) {
    setAddingLine(true);
    setActionError(null);
    ensureOrder()
      .then((current) =>
        addOrderLine(
          current.id,
          {
            itemId,
            variantId: value.variantId ?? undefined,
            quantity: value.quantity,
            modifierIds: value.modifierIds,
            note: value.specialInstructions || undefined,
          },
          menu,
        ),
      )
      .then((updated) => {
        applyUpdate(updated);
        onSettled();
      })
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't add that item to the order.")))
      .finally(() => setAddingLine(false));
  }

  function handleConfirmCombo(value: ComboPickerConfirmValue) {
    if (!activeCombo) return;
    setAddingLine(true);
    setActionError(null);
    const comboId = activeCombo.id;
    ensureOrder()
      .then((current) => addComboLine(current.id, { comboId, ...value }, menu))
      .then((updated) => {
        applyUpdate(updated);
        setActiveCombo(null);
      })
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't add that combo to the order.")))
      .finally(() => setAddingLine(false));
  }

  function handleTapItem(item: PosMenuItemView) {
    if (addingLine) return;
    if (itemNeedsModifierSheet(item)) {
      setActiveItem(item);
      return;
    }
    // Same rule as table mode (restiq-web#63/#129): a repeat tap on a plain
    // item bumps its existing line instead of adding a duplicate.
    const existingLine = order?.lines.find((line) => line.itemId === item.id && line.variantId === null && line.modifiers.length === 0 && !line.note);
    if (existingLine) {
      handleIncrement(existingLine);
      return;
    }
    submitLine(item.id, { variantId: null, modifierIds: [], quantity: 1, specialInstructions: "" }, () => undefined);
  }

  function handleConfirmModifiers(value: ModifierSheetConfirmValue) {
    if (!activeItem) return;
    submitLine(activeItem.id, value, () => setActiveItem(null));
  }

  function handleIncrement(line: OrderLineView) {
    if (!order) return;
    setBusyLineId(line.id);
    setActionError(null);
    updateOrderLineQuantity(order.id, line.id, line.quantity + 1, menu)
      .then(applyUpdate)
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't update that line.")))
      .finally(() => setBusyLineId(null));
  }

  function handleDecrement(line: OrderLineView) {
    if (!order) return;
    setBusyLineId(line.id);
    setActionError(null);
    const request = line.quantity <= 1 ? removeOrderLine(order.id, line.id, menu) : updateOrderLineQuantity(order.id, line.id, line.quantity - 1, menu);
    request
      .then(applyUpdate)
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't update that line.")))
      .finally(() => setBusyLineId(null));
  }

  function handleRemove(line: OrderLineView) {
    if (!order) return;
    setBusyLineId(line.id);
    setActionError(null);
    removeOrderLine(order.id, line.id, menu)
      .then(applyUpdate)
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't remove that line.")))
      .finally(() => setBusyLineId(null));
  }

  function handleAddTender(method: PostableTenderMethod, amountMinor: number, reference?: string) {
    setPendingTenders((current) => [...current, { method, amountMinor, ...(reference ? { reference } : {}) }]);
  }

  function handleRemoveTender(index: number) {
    setPendingTenders((current) => current.filter((_, i) => i !== index));
  }

  function handleDiscard() {
    if (!order) return;
    setDiscarding(true);
    setActionError(null);
    discardOrder(order.id)
      .then(onStartNextOrder)
      .catch((error: unknown) => {
        setActionError(errorMessage(error, "Couldn't discard this order."));
        setDiscarding(false);
      });
  }

  function handleFinalize() {
    if (!bill || !order) return;
    const change = cashChangeMinor(billTotalMinor(bill), bill, pendingTenders, menu.currency);
    setFinalizeBusy(true);
    setFinalizeError(null);
    // restiq-web#361: no web pre-send. A successful finalize fires the unsent
    // lines to the kitchen in the same transaction (restiq-backend#210), so a
    // failed payment (e.g. shift_not_open) never leaves a ticket for an
    // unpaid order on the KDS.
    finalizeBill(bill.id, { tenders: tendersForFinalize(billTotalMinor(bill), bill, pendingTenders) })
      .then((finalised) => {
        setBill(finalised);
        // Paid: a reload now starts a fresh order rather than resuming this one.
        clearCounterOrderId(currentStaffId);
        setChangeGiven(change);
        openDrawerForTenders(pendingTenders);
      })
      .catch((error: unknown) => setFinalizeError(errorMessage(error, "Couldn't finalise this bill.")))
      .finally(() => setFinalizeBusy(false));
  }

  if (billError && order) {
    return <LoadErrorPanel testId="counter-bill-error" message="Couldn't load the bill." onRetry={() => loadBill(order.id)} />;
  }

  const readOnly = bill !== null && isBillReadOnly(bill);
  const totalMinor = bill ? billTotalMinor(bill) : 0;
  const remainingMinor = bill ? remainingToTenderMinor(totalMinor, bill, pendingTenders) : 0;
  const empty = !order || order.lines.length === 0;
  const intents = terminal.intent ? [terminal.intent] : [];

  return (
    <div data-testid="counter-view" className="flex h-dvh flex-col overflow-hidden">
      <PosHeader subtitle="QSR Counter" mode="counter">
        {!readOnly && (
          <div className="relative w-80 max-w-full">
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
        <div className="flex items-center gap-3">
          <p data-testid="counter-cashier" className="text-sm text-muted-foreground">
            Cashier <span className="font-semibold text-foreground">{order?.ownerName ?? currentStaffName}</span>
          </p>
          {typeof order?.tokenNumber === "number" ? (
            <TokenBadge tokenNumber={order.tokenNumber} />
          ) : (
            <span data-testid="counter-new-order" className="text-sm font-semibold text-muted-foreground">
              New order
            </span>
          )}
        </div>
      </PosHeader>

      {actionError && (
        <div role="alert" data-testid="counter-action-error" className="mx-6 mt-4 rounded-lg border border-status-alert/40 bg-card px-4 py-3 text-sm text-status-alert">
          {actionError}{" "}
          <button type="button" className="underline" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Below lg (issue #229): categories scroll sideways and menu, bill and
          tender column stack, the whole column scrolling; four columns from lg up. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {!readOnly && (
          <>
            <nav
              data-testid="category-tabs"
              className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/60 p-3 lg:w-36 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r"
            >
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
                  title={category.name}
                  className={`shrink-0 max-w-48 truncate rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors lg:max-w-none lg:whitespace-normal lg:line-clamp-2 lg:[overflow-wrap:anywhere] ${
                    category.id === effectiveCategoryId ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </nav>

            <main className="p-4 lg:min-w-0 lg:flex-1 lg:overflow-y-auto">
              <h2 className="mb-3 line-clamp-2 font-headline text-base font-semibold text-foreground [overflow-wrap:anywhere]">
                {query.trim() ? "Search results" : activeCategory?.name} <span className="font-normal text-muted-foreground">· {visibleItems.length} items</span>
              </h2>
              {visibleItems.length === 0 && visibleCombos.length === 0 ? (
                <p data-testid="menu-empty" className="text-sm text-muted-foreground">
                  No items match.
                </p>
              ) : (
                <div data-testid="item-grid" className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
                  {visibleCombos.map((combo) => (
                    <PosComboTile key={combo.id} combo={combo} itemsById={itemsById} currency={menu.currency} onTap={() => !addingLine && setActiveCombo(combo)} />
                  ))}
                  {visibleItems.map((item) => (
                    <PosItemTile key={item.id} item={item} currency={menu.currency} onTap={() => item.available && handleTapItem(item)} />
                  ))}
                </div>
              )}
            </main>
          </>
        )}

        {!bill || !order ? (
          <section data-testid="counter-empty-cart" className="flex w-full shrink-0 flex-col items-center justify-center gap-2 border-b border-border/60 bg-card p-6 text-center lg:w-80 lg:border-b-0 lg:border-r">
            <p className="font-headline text-base font-semibold text-foreground">{order ? "Loading the bill…" : "No items yet"}</p>
            {!order && <p className="text-sm text-muted-foreground">Tap an item to start a new order. The token number is given on the first item.</p>}
          </section>
        ) : (
        <BillSummary
          bill={bill}
          lines={order.lines}
          currency={menu.currency}
          originLabel={orderOriginLabel(order)}
          layoutClassName="w-full border-b lg:w-80 lg:border-b-0 lg:border-r"
          busyLineId={busyLineId}
          onIncrement={readOnly ? undefined : handleIncrement}
          onDecrement={readOnly ? undefined : handleDecrement}
          onRemove={readOnly ? undefined : handleRemove}
        />
        )}

        {!bill ? null : readOnly ? (
          <section data-testid="counter-settled-panel" className="flex w-full shrink-0 flex-col items-center justify-center gap-3 p-6 text-center lg:w-80">
            <p className="font-headline text-xl font-semibold text-status-available">Order settled</p>
            <p className="text-sm text-muted-foreground">
              {bill.tenders.length} tender{bill.tenders.length === 1 ? "" : "s"} captured · no further changes are possible.
            </p>
            {changeGiven > 0 && (
              <p data-testid="counter-change-due" className="font-headline text-2xl font-bold tabular-nums text-foreground">
                Change due {formatMinor(changeGiven, menu.currency)}
              </p>
            )}
            <div className="flex gap-2">
              <Button size="lg" data-testid="counter-start-next-order" onClick={onStartNextOrder}>
                Start next order
              </Button>
              <Button asChild size="lg" variant="outline" data-testid="print-invoice-link">
                <Link href={`/pos/bills/${bill.id}/invoice`}>Print invoice</Link>
              </Button>
            </div>
          </section>
        ) : (
          <div className="flex w-full shrink-0 flex-col lg:w-80">
            <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {terminal.intent ? (
                <TerminalIntentPanel intent={terminal.intent} currency={menu.currency} busy={terminal.busy} onCancel={terminal.cancel} onDismiss={terminal.dismiss} />
              ) : (
                <TenderKeypad
                  currency={menu.currency}
                  remainingMinor={Math.max(0, remainingMinor)}
                  tenders={pendingTenders}
                  capturedTenders={bill.tenders.filter((tender) => isElectronicMethod(tender.method))}
                  onAddTender={handleAddTender}
                  onRemoveTender={handleRemoveTender}
                  onSendToTerminal={terminal.send}
                  terminalBusy={terminal.busy}
                  changeMinor={cashChangeMinor(totalMinor, bill, pendingTenders, menu.currency)}
                  cashLocked={shiftOpen === false}
                />
              )}
            </div>
            <footer className="border-t border-border/60 p-4">
              {terminal.error && (
                <p role="alert" data-testid="intent-error" className="mb-2 text-sm text-status-alert">
                  {terminal.error}
                </p>
              )}
              {finalizeError && (
                <p role="alert" data-testid="finalize-error" className="mb-2 text-sm text-status-alert">
                  {finalizeError}
                </p>
              )}
              {empty && (
                <Button size="lg" variant="outline" className="mb-2 w-full" data-testid="counter-discard-order" disabled={discarding} onClick={handleDiscard}>
                  {discarding ? "Discarding…" : "Discard empty order"}
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  size="lg"
                  className="flex-1"
                  data-testid="finalize-bill"
                  disabled={!canFinalizeWithElectronic(bill, totalMinor, pendingTenders, intents, menu.currency) || finalizeBusy}
                  onClick={handleFinalize}
                >
                  {finalizeBusy ? "Charging…" : "Charge"}
                </Button>
                <PrintBillButton billId={bill.id} label="Print bill" testId="print-bill" size="lg" />
              </div>
            </footer>
          </div>
        )}
      </div>

      {activeCombo && (
        <ComboPicker
          combo={activeCombo}
          itemsById={itemsById}
          formatPrice={(minor) => formatPriceMinor(minor, menu.currency)}
          themeClass="pos-theme"
          busy={addingLine}
          onCancel={() => setActiveCombo(null)}
          onConfirm={handleConfirmCombo}
        />
      )}

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
