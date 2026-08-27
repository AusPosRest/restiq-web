"use client";

// P3 Order Taking (CAP-3). Replaces story 3's order-stub.tsx placeholder -
// see that file's former header (and wiki/features/pos-cashier-waiter.md's
// "Integration points") for why this route (/pos/orders/[orderId]) is the
// right place to build into, not a new route. EXPERIENCE.md IA: "Order
// Taking -> P3, with Modifier Selection -> P4 as an in-flow bottom sheet."
//
// Two independent GETs land this screen: the order itself (line items,
// owner, table) and the outlet's menu (categories/items/modifier groups).
// Both use the same five-state pattern (skeleton/error/loaded) as every
// other /pos screen (usePosLoad).
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { addOrderLine, assignSeat, PosApiError, removeOrderLine, sendOrderToKitchen, updateOrderLineQuantity } from "../../api";
import { LoadErrorPanel, Skeleton } from "../../data-states";
import { usePosLoad } from "../../use-pos-load";
import { ModifierSheet, type ModifierSheetConfirmValue } from "./modifier-sheet";
import { OrderPanel } from "./order-panel";
import { PosItemTile } from "./pos-item-tile";
import {
  canSendToKitchen,
  filterMenuItems,
  itemNeedsModifierSheet,
  orderOriginLabel,
  toOrderView,
  type OrderLineView,
  type OrderView,
  type PosMenuItemView,
  type PosMenuView,
  type RawOrder,
} from "./order-taking-state";

export function OrderTakingView({ orderId, currentStaffId }: Readonly<{ orderId: string; currentStaffId: string }>) {
  const orderLoad = usePosLoad<RawOrder>(`orders/${orderId}`);
  const menuLoad = usePosLoad<PosMenuView>("menu");

  if (orderLoad.loading || menuLoad.loading) return <LoadingShell />;

  if (orderLoad.failed || !orderLoad.data) {
    return <LoadErrorPanel testId="order-taking-error" message="Couldn't load this order." onRetry={orderLoad.retry} />;
  }
  if (menuLoad.failed || !menuLoad.data) {
    return <LoadErrorPanel testId="order-taking-menu-error" message="Couldn't load the menu." onRetry={menuLoad.retry} />;
  }

  return (
    <OrderTakingLoaded
      orderId={orderId}
      currentStaffId={currentStaffId}
      initialOrder={toOrderView(orderLoad.data, menuLoad.data)}
      menu={menuLoad.data}
    />
  );
}

function OrderTakingLoaded({
  orderId,
  currentStaffId,
  initialOrder,
  menu,
}: Readonly<{ orderId: string; currentStaffId: string; initialOrder: OrderView; menu: PosMenuView }>) {
  const [order, setOrder] = useState(initialOrder);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeItem, setActiveItem] = useState<PosMenuItemView | null>(null);
  const [addingLine, setAddingLine] = useState(false);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendingToKitchen, setSendingToKitchen] = useState(false);

  const sortedCategories = useMemo(() => [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder), [menu.categories]);
  const effectiveCategoryId = selectedCategoryId ?? sortedCategories[0]?.id ?? null;
  const visibleItems = useMemo(() => filterMenuItems(menu.items, effectiveCategoryId, query), [menu.items, effectiveCategoryId, query]);
  const activeCategory = sortedCategories.find((category) => category.id === effectiveCategoryId) ?? null;

  function submitLine(itemId: string, value: ModifierSheetConfirmValue, onSettled: () => void) {
    setAddingLine(true);
    setActionError(null);
    addOrderLine(
      orderId,
      {
        itemId,
        variantId: value.variantId ?? undefined,
        quantity: value.quantity,
        modifierIds: value.modifierIds,
        specialInstructions: value.specialInstructions || undefined,
      },
      menu,
    )
      .then((updated) => {
        setOrder(updated);
        onSettled();
      })
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't add that item to the order.")))
      .finally(() => setAddingLine(false));
  }

  function handleTapItem(item: PosMenuItemView) {
    if (addingLine || busyLineId !== null) return;
    if (itemNeedsModifierSheet(item)) {
      setActiveItem(item);
      return;
    }
    // A plain item (no variant, no modifiers) already on the order just gets
    // its quantity bumped - the same effect as pressing the line's own "+"
    // stepper - rather than a second, redundant line for the same item
    // (restiq-web#63: repeat taps were always POSTing a brand-new line).
    const existingLine = order.lines.find((line) => line.itemId === item.id && line.variantId === null && line.modifiers.length === 0);
    if (existingLine) {
      handleIncrement(existingLine);
      return;
    }
    // No variant to pick, no modifier group to configure - add it straight
    // to the order, no sheet needed (task framing: "adding an item with no
    // required modifiers works directly").
    submitLine(item.id, { variantId: null, modifierIds: [], quantity: 1, specialInstructions: "" }, () => undefined);
  }

  function handleConfirmModifiers(value: ModifierSheetConfirmValue) {
    if (!activeItem) return;
    submitLine(activeItem.id, value, () => setActiveItem(null));
  }

  function handleIncrement(line: OrderLineView) {
    setBusyLineId(line.id);
    setActionError(null);
    updateOrderLineQuantity(orderId, line.id, line.quantity + 1, menu)
      .then(setOrder)
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't update that line.")))
      .finally(() => setBusyLineId(null));
  }

  function handleDecrement(line: OrderLineView) {
    setBusyLineId(line.id);
    setActionError(null);
    const request = line.quantity <= 1 ? removeOrderLine(orderId, line.id, menu) : updateOrderLineQuantity(orderId, line.id, line.quantity - 1, menu);
    request
      .then(setOrder)
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't update that line.")))
      .finally(() => setBusyLineId(null));
  }

  function handleRemove(line: OrderLineView) {
    setBusyLineId(line.id);
    setActionError(null);
    removeOrderLine(orderId, line.id, menu)
      .then(setOrder)
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't remove that line.")))
      .finally(() => setBusyLineId(null));
  }

  // --- CAP-4 group ordering: seat assignment and the send-to-kitchen gate.
  function handleSeatIncrement(line: OrderLineView) {
    setBusyLineId(line.id);
    setActionError(null);
    assignSeat(orderId, line.id, (line.seatNumber ?? 0) + 1, menu)
      .then(setOrder)
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't assign a seat to that line.")))
      .finally(() => setBusyLineId(null));
  }

  function handleSeatDecrement(line: OrderLineView) {
    if (line.seatNumber == null) return;
    setBusyLineId(line.id);
    setActionError(null);
    assignSeat(orderId, line.id, line.seatNumber <= 1 ? null : line.seatNumber - 1, menu)
      .then(setOrder)
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't update that line's seat.")))
      .finally(() => setBusyLineId(null));
  }

  function handleSendToKitchen() {
    // Defensive re-check mirroring the button's own disabled state - the
    // real backend enforces this with a 400 (SPEC CAP-4), this just keeps
    // the client from ever issuing a call it already knows will be rejected.
    if (!canSendToKitchen(order)) return;
    setSendingToKitchen(true);
    setActionError(null);
    sendOrderToKitchen(orderId, menu)
      .then(setOrder)
      .catch((error: unknown) => setActionError(errorMessage(error, "Couldn't send this order to the kitchen.")))
      .finally(() => setSendingToKitchen(false));
  }

  return (
    <div data-testid="order-taking-view" className="flex flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border/60 px-6 py-3">
        <div>
          <p className="font-headline text-lg font-bold text-primary">RESTIQ POS</p>
          <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">{orderOriginLabel(order)}</p>
        </div>
        <Link href="/pos/table-map" data-testid="back-to-table-map" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Back to table map
        </Link>
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
        <p data-testid="order-owner" className="text-sm text-muted-foreground">
          Owned by <span className="font-semibold text-foreground">{order.ownerStaffName === currentStaffId ? "You" : order.ownerStaffName}</span>
        </p>
      </header>

      {actionError && (
        <div role="alert" data-testid="order-taking-action-error" className="mx-6 mt-4 rounded-lg border border-status-alert/40 bg-card px-4 py-3 text-sm text-status-alert">
          {actionError}{" "}
          <button type="button" className="underline" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
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

        <OrderPanel
          orderId={order.id}
          tableId={order.tableId}
          currency={menu.currency}
          lines={order.lines}
          status={order.status}
          currentStaffId={currentStaffId}
          busyLineId={busyLineId}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onRemove={handleRemove}
          onSeatIncrement={handleSeatIncrement}
          onSeatDecrement={handleSeatDecrement}
          sendingToKitchen={sendingToKitchen}
          onSendToKitchen={handleSendToKitchen}
        />
      </div>

      {activeItem && (
        <ModifierSheet item={activeItem} currency={menu.currency} busy={addingLine} onCancel={() => setActiveItem(null)} onConfirm={handleConfirmModifiers} />
      )}
    </div>
  );
}

function LoadingShell() {
  return (
    <div data-testid="order-taking-loading" className="flex flex-1 flex-col gap-4 p-6">
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
