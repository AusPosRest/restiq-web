"use client";

// Q5 Table Order (CAP-3): the session's shared cart grouped by guest, each
// group carrying a GuestChip + subtotal, with the combined total large in
// the sticky bottom area (DESIGN.md/screens.md). The signed-in guest's own
// lines are the only ones with a quantity stepper/remove - everyone else's
// render read-only text, so a 403 from editing another guest's line is never
// reachable from this UI at all (a friend's phone simply has no button to
// press), matching CAP-3's success criterion.
//
// "Place order" (CAP-4) is the next story (issue #68's sibling scope, not
// this one) - it renders disabled with a quiet "coming next" note rather
// than being omitted outright, so Q5's layout and sticky bar are already in
// their final shape and CAP-4 only has to wire one button up.
import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GuestApiError } from "../api-client";
import { removeCartLine, updateCartLineQuantity, type CartLineView, type TableCartView } from "./cart-api";
import { formatMinor, isCartEmpty } from "./cart-state";
import { CART_POLL_MS, useCartPoll } from "./use-cart-poll";

// Conventional route for Q3 Menu Browse (CAP-2, issue #67 - built
// concurrently by a sibling story, not yet merged as of this build). No
// route exists to link to yet, so this is the documented guess rather than a
// dead link: `/qr/menu` is the flat, session-gated path decideGuestRoute
// already anticipates (src/lib/guest-session.ts's own test literal uses this
// exact path as its "future gated path" example). See
// wiki/features/qr-self-order.md for the reconciliation note once #67 lands.
const MENU_ROUTE = "/qr/menu";

export function CartScreen({ myGuestId }: Readonly<{ myGuestId: string }>) {
  const poll = useCartPoll();

  if (poll.sessionClosed) return <SessionEndedPanel />;
  if (poll.loading) return <LoadingSkeleton />;
  if (poll.failed || !poll.data) {
    return <ErrorPanel onRetry={poll.retry} />;
  }

  return <CartLoaded cart={poll.data} myGuestId={myGuestId} stale={poll.stale} onUpdate={poll.applyUpdate} />;
}

function CartLoaded({
  cart,
  myGuestId,
  stale,
  onUpdate,
}: Readonly<{
  cart: TableCartView;
  myGuestId: string;
  stale: boolean;
  onUpdate: (next: TableCartView) => void;
}>) {
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function runMutation(lineId: string, request: Promise<TableCartView>) {
    setActionError(null);
    setBusyLineId(lineId);
    request
      .then(onUpdate)
      .catch((error: unknown) => setActionError(error instanceof GuestApiError ? error.message : "Couldn't update your order."))
      .finally(() => setBusyLineId(null));
  }

  function decrement(line: CartLineView) {
    runMutation(line.id, line.quantity <= 1 ? removeCartLine(line.id) : updateCartLineQuantity(line.id, line.quantity - 1));
  }

  function increment(line: CartLineView) {
    runMutation(line.id, updateCartLineQuantity(line.id, line.quantity + 1));
  }

  function remove(line: CartLineView) {
    runMutation(line.id, removeCartLine(line.id));
  }

  const empty = isCartEmpty(cart);

  return (
    <main data-testid="cart-screen" className="flex min-h-screen flex-1 flex-col px-6 pb-40 pt-8">
      <h1 className="font-headline text-2xl font-semibold text-foreground">Your table&apos;s order</h1>

      {stale ? (
        <p data-testid="cart-stale-note" className="mt-2 text-xs text-muted-foreground">
          Showing the last update - reconnecting…
        </p>
      ) : null}

      {actionError ? (
        <p role="alert" data-testid="cart-action-error" className="mt-4 text-sm text-error-soft">
          {actionError}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-4" role="region" aria-live="polite" aria-label="Shared table cart">
        {empty ? (
          <EmptyState />
        ) : (
          cart.guests
            .filter((guest) => guest.lines.length > 0)
            .map((guest) => (
              <GuestGroup
                key={guest.guestId}
                guest={guest}
                currency={cart.currency}
                own={guest.guestId === myGuestId}
                busyLineId={busyLineId}
                onIncrement={increment}
                onDecrement={decrement}
                onRemove={remove}
              />
            ))
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-muted-foreground">Table total</span>
          <span data-testid="cart-total" className="font-headline text-2xl font-bold tabular-nums text-foreground">
            {formatMinor(cart.totalMinor, cart.currency)}
          </span>
        </div>
        <button
          type="button"
          data-testid="cart-place-order"
          disabled
          aria-disabled="true"
          title="Coming next"
          className="mt-3 w-full rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground opacity-50"
        >
          Place order
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Placing the order is coming next</p>
      </div>
    </main>
  );
}

function GuestGroup({
  guest,
  currency,
  own,
  busyLineId,
  onIncrement,
  onDecrement,
  onRemove,
}: Readonly<{
  guest: TableCartView["guests"][number];
  currency: string;
  own: boolean;
  busyLineId: string | null;
  onIncrement: (line: CartLineView) => void;
  onDecrement: (line: CartLineView) => void;
  onRemove: (line: CartLineView) => void;
}>) {
  return (
    <section data-testid={`cart-guest-${guest.guestId}`} className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <GuestChip name={guest.guestName} mine={own} />
        <span data-testid={`cart-guest-subtotal-${guest.guestId}`} className="text-sm font-semibold tabular-nums text-foreground">
          {formatMinor(guest.subtotalMinor, currency)}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {guest.lines.map((line) => (
          <CartLineRow
            key={line.id}
            line={line}
            currency={currency}
            editable={own}
            busy={busyLineId === line.id}
            onIncrement={() => onIncrement(line)}
            onDecrement={() => onDecrement(line)}
            onRemove={() => onRemove(line)}
          />
        ))}
      </ul>
    </section>
  );
}

function GuestChip({ name, mine }: Readonly<{ name: string; mine: boolean }>) {
  return (
    <span
      data-testid={mine ? "guest-chip-mine" : "guest-chip"}
      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
    >
      {name}
      {mine ? <span className="text-primary">(you)</span> : null}
    </span>
  );
}

function CartLineRow({
  line,
  currency,
  editable,
  busy,
  onIncrement,
  onDecrement,
  onRemove,
}: Readonly<{
  line: CartLineView;
  currency: string;
  editable: boolean;
  busy: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}>) {
  return (
    <li data-testid={`cart-line-${line.id}`} className="flex items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          {line.itemName}
          {line.variantName ? <span className="text-muted-foreground"> · {line.variantName}</span> : null}
        </p>
        {line.modifiers.length > 0 ? (
          <p className="text-xs text-muted-foreground">{line.modifiers.map((m) => m.name).join(", ")}</p>
        ) : null}
      </div>
      <span data-testid={`cart-line-total-${line.id}`} className="text-sm font-semibold tabular-nums text-foreground">
        {formatMinor(line.lineTotalMinor, currency)}
      </span>
      {editable ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid={`cart-line-decrement-${line.id}`}
            aria-label={`Decrease quantity of ${line.itemName}`}
            disabled={busy}
            onClick={onDecrement}
            className="flex size-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </button>
          <span data-testid={`cart-line-qty-${line.id}`} className="w-5 text-center text-sm font-semibold tabular-nums">
            {line.quantity}
          </span>
          <button
            type="button"
            data-testid={`cart-line-increment-${line.id}`}
            aria-label={`Increase quantity of ${line.itemName}`}
            disabled={busy}
            onClick={onIncrement}
            className="flex size-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid={`cart-line-remove-${line.id}`}
            aria-label={`Remove ${line.itemName}`}
            disabled={busy}
            onClick={onRemove}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-error-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <span data-testid={`cart-line-qty-readonly-${line.id}`} className="w-5 text-center text-sm font-semibold tabular-nums text-muted-foreground">
          ×{line.quantity}
        </span>
      )}
    </li>
  );
}

function EmptyState() {
  return (
    <div data-testid="cart-empty" className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/60 px-6 py-16 text-center">
      <p className="font-headline text-lg font-medium text-foreground">Nothing yet</p>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">Browse the menu and add something for your table.</p>
      <Link
        href={MENU_ROUTE}
        data-testid="cart-empty-browse-menu"
        className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Browse the menu
      </Link>
    </div>
  );
}

function SessionEndedPanel() {
  return (
    <main data-testid="cart-session-ended" className="flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="font-headline text-xl font-semibold text-foreground">This table&apos;s session has ended</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">Scan again to start a new one.</p>
    </main>
  );
}

function ErrorPanel({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <main data-testid="cart-error" role="alert" className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted-foreground">Couldn&apos;t load your table&apos;s order.</p>
      <button
        type="button"
        data-testid="cart-error-retry"
        onClick={onRetry}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Retry
      </button>
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div data-testid="cart-loading" className="flex min-h-screen flex-1 flex-col gap-4 px-6 pt-8">
      <div aria-hidden="true" className="h-8 w-48 animate-pulse rounded-md bg-accent" />
      <div aria-hidden="true" className="h-32 w-full animate-pulse rounded-xl bg-accent" />
      <div aria-hidden="true" className="h-32 w-full animate-pulse rounded-xl bg-accent" />
    </div>
  );
}

// Re-exported purely so tests can assert the surface's poll cadence without
// reaching into use-cart-poll.ts directly.
export { CART_POLL_MS };
