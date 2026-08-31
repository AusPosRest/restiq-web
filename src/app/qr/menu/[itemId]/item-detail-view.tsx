"use client";

// Q4 Item Detail (CAP-2). Variant chips + modifier groups with visible
// min/max badges (same discipline as POS's ModifierSheet - EXPERIENCE.md's
// Component Patterns), quantity stepper, and a sticky bottom-bar "Add to
// Cart" that posts the real `POST /guest/v1/cart/lines` (restiq-backend
// PR #74) through the /qr proxy. Confirm is disabled, never hidden, until
// every required group is satisfied and, when the item has variants, one is
// picked - see menu-state.ts's canAddToCart for the exact gate.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CartPill } from "../../cart-pill";
import { SessionEndedView } from "../../session-ended-view";
import {
  canAddToCart,
  computeUnitTotalMinor,
  emptyModifierSelection,
  formatPriceMinor,
  initialLetterTile,
  modifierGroupBadgeLabel,
  resolveSelectedModifiers,
  resolveUnitPriceMinor,
  toggleModifier,
  type MenuItemView,
  type ModifierSelection,
} from "../menu-state";
import { useCartSummary } from "../../cart-summary";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "session-ended" } | { kind: "loaded"; item: MenuItemView };

export function ItemDetailView({ itemId }: Readonly<{ itemId: string }>) {
  const router = useRouter();
  const { refresh: refreshCart } = useCartSummary();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [variantId, setVariantId] = useState<string | null>(null);
  const [selection, setSelection] = useState<ModifierSelection>({});
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const menuHref = "/qr/menu";

  useEffect(() => {
    let active = true;
    (async () => {
      let response: Response;
      try {
        response = await fetch(`/qr/api/menu/items/${itemId}`, { cache: "no-store" });
      } catch {
        if (active) setState({ kind: "error", message: "Couldn't reach the restaurant - check your connection and try again" });
        return;
      }
      if (!active) return;
      if (response.status === 410) {
        setState({ kind: "session-ended" });
        return;
      }
      if (response.status === 404) {
        setState({ kind: "error", message: "This dish is no longer on the menu" });
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
        setState({ kind: "error", message: body.error?.message ?? "Couldn't load this dish - please try again" });
        return;
      }
      const item = (await response.json()) as MenuItemView;
      setState({ kind: "loaded", item });
      setSelection(emptyModifierSelection(item));
      setVariantId(item.variants.length === 1 ? item.variants[0].id : null);
    })();
    return () => {
      active = false;
    };
  }, [itemId]);

  async function addToCart() {
    if (state.kind !== "loaded") return;
    setAdding(true);
    setAddError(null);
    const modifiers = resolveSelectedModifiers(state.item, selection);
    let response: Response;
    try {
      response = await fetch("/qr/api/cart/lines", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: state.item.id, variantId: variantId ?? undefined, quantity, modifierIds: modifiers.map((modifier) => modifier.id) }),
      });
    } catch {
      setAdding(false);
      setAddError("Couldn't reach the restaurant - check your connection and try again");
      return;
    }
    if (response.status === 410) {
      setState({ kind: "session-ended" });
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
      setAdding(false);
      setAddError(
        body.error?.code === "item_unavailable"
          ? "This item just became unavailable"
          : (body.error?.message ?? "Couldn't add this to your cart - please try again"),
      );
      return;
    }
    await refreshCart();
    router.push(menuHref);
  }

  if (state.kind === "session-ended") return <SessionEndedView />;

  if (state.kind === "loading") {
    return (
      <main data-testid="qr-item-detail-loading" className="flex min-h-screen flex-1 flex-col gap-3 px-4 pt-6">
        <p className="sr-only" role="status">
          Loading dish…
        </p>
        <div aria-hidden="true" className="h-48 animate-pulse rounded-xl bg-card" />
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main data-testid="qr-item-detail-error" className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p role="alert" className="text-sm text-error-soft">
          {state.message}
        </p>
        <button
          type="button"
          data-testid="qr-item-detail-back-to-menu"
          onClick={() => router.push(menuHref)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Back to menu
        </button>
      </main>
    );
  }

  const item = state.item;
  const price = resolveUnitPriceMinor(item, variantId);
  const modifiers = resolveSelectedModifiers(item, selection);
  const unitTotalMinor = price ? computeUnitTotalMinor(price.priceMinor, modifiers) : null;
  const canConfirm = !adding && canAddToCart(item, selection, variantId);

  return (
    <main data-testid="qr-item-detail" className="relative flex min-h-screen flex-1 flex-col pb-36">
      <div className="relative flex h-40 shrink-0 items-center justify-center bg-muted" aria-hidden="true">
        <span className="font-headline text-5xl font-bold text-muted-foreground">{initialLetterTile(item.name)}</span>
      </div>
      <button
        type="button"
        data-testid="qr-item-detail-close"
        aria-label="Close"
        onClick={() => router.push(menuHref)}
        className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        ✕
      </button>

      <div className="flex flex-col gap-6 px-5 pt-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-headline text-xl font-semibold text-foreground">{item.name}</h1>
            {price && (
              <span className="shrink-0 text-lg font-semibold tabular-nums text-foreground">{formatPriceMinor(price.priceMinor, price.currency)}</span>
            )}
          </div>
          {!item.available && (
            <p data-testid="qr-item-detail-unavailable" className="mt-2 text-sm font-medium text-muted-foreground">
              Unavailable today
            </p>
          )}
          {item.allergens.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">Contains: {item.allergens.map((allergen) => allergen.name).join(", ")}</p>
          )}
        </div>

        {item.variants.length > 0 && (
          <fieldset data-testid="qr-item-variants">
            <div className="flex items-baseline justify-between">
              <legend className="font-label text-sm font-semibold text-foreground">Portion</legend>
              <span className="font-label text-xs font-semibold uppercase tracking-wider text-primary">Required</span>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {item.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  data-testid={`qr-variant-${variant.id}`}
                  aria-pressed={variantId === variant.id}
                  disabled={adding}
                  onClick={() => setVariantId(variant.id)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    variantId === variant.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-foreground hover:bg-accent"
                  }`}
                >
                  <span>{variant.name}</span>
                  <span className="tabular-nums">{variant.priceMinor !== null && variant.currency !== null ? formatPriceMinor(variant.priceMinor, variant.currency) : "—"}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {item.modifierGroups.map((group) => {
          const selected = selection[group.id] ?? [];
          return (
            <fieldset key={group.id} data-testid={`qr-modifier-group-${group.id}`}>
              <div className="flex items-baseline justify-between">
                <legend className="font-label text-sm font-semibold text-foreground">{group.name}</legend>
                <span
                  data-testid={`qr-modifier-group-badge-${group.id}`}
                  className={`font-label text-xs font-semibold uppercase tracking-wider ${group.minSelections > 0 ? "text-primary" : "text-muted-foreground"}`}
                >
                  {modifierGroupBadgeLabel(group)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.modifiers.map((modifier) => {
                  const isSelected = selected.includes(modifier.id);
                  return (
                    <button
                      key={modifier.id}
                      type="button"
                      data-testid={`qr-modifier-${modifier.id}`}
                      aria-pressed={isSelected}
                      disabled={adding}
                      onClick={() => setSelection((prev) => ({ ...prev, [group.id]: toggleModifier(selected, modifier.id, group.maxSelections) }))}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent"
                      }`}
                    >
                      {modifier.name}
                      {modifier.priceMinor > 0 && <span className="ml-1 opacity-80">+{formatPriceMinor(modifier.priceMinor, price?.currency ?? "INR")}</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <CartPill stackAboveActionBar />

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
        {addError && (
          <p role="alert" data-testid="qr-item-detail-add-error" className="mb-2 text-sm text-error-soft">
            {addError}
          </p>
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
            <button
              type="button"
              data-testid="qr-qty-decrement"
              aria-label="Decrease quantity"
              disabled={adding || quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="size-9 rounded-md text-lg font-semibold text-foreground disabled:opacity-40"
            >
              −
            </button>
            <span data-testid="qr-qty" className="w-6 text-center text-sm font-semibold tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              data-testid="qr-qty-increment"
              aria-label="Increase quantity"
              disabled={adding}
              onClick={() => setQuantity((q) => q + 1)}
              className="size-9 rounded-md text-lg font-semibold text-foreground"
            >
              +
            </button>
          </div>
          <button
            type="button"
            data-testid="qr-add-to-cart"
            disabled={!canConfirm}
            onClick={addToCart}
            className="flex-1 rounded-xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            {adding ? "Adding…" : unitTotalMinor !== null && price ? `Add to Cart · ${formatPriceMinor(unitTotalMinor * quantity, price.currency)}` : "Add to Cart"}
          </button>
        </div>
      </div>
    </main>
  );
}
