"use client";

// Q3 Menu Browse (CAP-2). Category tabs + search over the real
// `GET /guest/v1/menu` (GuestMenuView, restiq-backend PR #73) via the /qr
// proxy - see menu-state.ts's header for the exact contract. Issue #218:
// items show their photo (letter tile when there is none), and a "+" adds an
// item with nothing to choose straight to the cart; one with variants or a
// required choice opens its detail instead. A kiosk tab gets the kiosk
// layout - a vertical category rail beside a grid of large photo tiles.
// WCAG 2.1 AA floor: labeled search input, `role="tablist"` for categories,
// `aria-live` on the item list, unavailable items carry a text label (never
// color-only), and the "+" is a separate, named button (never nested).
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ComboPicker, type ComboPickerConfirmValue } from "@/components/combo-picker";
import { combosFor, comboSavingsMinor, type ComboItemInfo, type ComboMenuView } from "@/lib/combo";
import { GuestApiError } from "../api-client";
import { addCartCombo } from "../cart/cart-api";
import { useRouter } from "next/navigation";
import { CartPill } from "../cart-pill";
import { isKioskTab } from "../kiosk-session";
import { SessionEndedView } from "../session-ended-view";
import { canQuickAdd, displayPriceInfo, formatPriceMinor, initialLetterTile, nonEmptyCategories, visibleItems, type GuestMenuView, type MenuItemView } from "./menu-state";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "session-ended" } | { kind: "loaded"; menu: GuestMenuView };
type Notice = { kind: "added" | "error"; text: string };

const MENU_HREF = "/qr/menu";
const NOTICE_MS = 2500;

function subscribeNoop(): () => void {
  return () => undefined;
}

/** No setState of its own - the caller (effect or retry click) decides what to do with the result, so neither call site fires setState synchronously from an effect body. */
async function loadMenu(): Promise<LoadState> {
  let response: Response;
  try {
    response = await fetch("/qr/api/menu", { cache: "no-store" });
  } catch {
    return { kind: "error", message: "Couldn't reach the restaurant - check your connection and try again" };
  }
  if (response.status === 410) return { kind: "session-ended" };
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    return { kind: "error", message: body.error?.message ?? "Couldn't load the menu - please try again" };
  }
  const menu = (await response.json()) as GuestMenuView;
  return { kind: "loaded", menu };
}

export function MenuView() {
  const router = useRouter();
  const kiosk = useSyncExternalStore(subscribeNoop, isKioskTab, () => false);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCombo, setActiveCombo] = useState<ComboMenuView | null>(null);
  const [addingCombo, setAddingCombo] = useState(false);
  const [comboError, setComboError] = useState<string | null>(null);
  const itemsById = useMemo<ReadonlyMap<string, ComboItemInfo>>(
    () => new Map(state.kind === "loaded" ? state.menu.categories.flatMap((c) => c.items).map((item) => [item.id, item]) : []),
    [state],
  );

  async function handleConfirmCombo(value: ComboPickerConfirmValue) {
    if (!activeCombo) return;
    setAddingCombo(true);
    setComboError(null);
    try {
      await addCartCombo({ comboId: activeCombo.id, ...value });
      setCartKey((v) => v + 1);
      setActiveCombo(null);
    } catch (error) {
      if (error instanceof GuestApiError && error.status === 410) {
        setState({ kind: "session-ended" });
        return;
      }
      setComboError(error instanceof Error ? error.message : "Couldn't add this combo - please try again");
    } finally {
      setAddingCombo(false);
    }
  }
  const [addingId, setAddingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Bumped after a quick add: remounting the pill makes it re-read the cart now instead of on its next poll.
  const [cartKey, setCartKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const next = await loadMenu();
      if (!active) return;
      setState(next);
      if (next.kind === "loaded") {
        setActiveCategoryId((prev) => prev ?? nonEmptyCategories(next.menu.categories)[0]?.id ?? null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice]);

  async function retry() {
    const next = await loadMenu();
    setState(next);
    if (next.kind === "loaded") {
      setActiveCategoryId((prev) => prev ?? nonEmptyCategories(next.menu.categories)[0]?.id ?? null);
    }
  }

  async function quickAdd(item: MenuItemView) {
    if (!canQuickAdd(item)) {
      router.push(`${MENU_HREF}/${item.id}`);
      return;
    }
    setAddingId(item.id);
    setNotice(null);
    let response: Response;
    try {
      response = await fetch("/qr/api/cart/lines", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id, quantity: 1, modifierIds: [] }),
      });
    } catch {
      setAddingId(null);
      setNotice({ kind: "error", text: "Couldn't reach the restaurant - please try again" });
      return;
    }
    setAddingId(null);
    if (response.status === 410) {
      setState({ kind: "session-ended" });
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
      setNotice({
        kind: "error",
        text: body.error?.code === "item_unavailable" ? `${item.name} just became unavailable` : (body.error?.message ?? "Couldn't add that - please try again"),
      });
      return;
    }
    setNotice({ kind: "added", text: `Added ${item.name}` });
    setCartKey((key) => key + 1);
  }

  if (state.kind === "session-ended") return <SessionEndedView />;

  if (state.kind === "loading") {
    return (
      <main data-testid="qr-menu-loading" className="flex min-h-screen flex-1 flex-col gap-3 px-4 pt-6">
        <p className="sr-only" role="status">
          Loading menu…
        </p>
        <div aria-hidden="true" className="animate-pulse space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-card" />
          ))}
        </div>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main data-testid="qr-menu-error" className="flex min-h-screen flex-1 flex-col items-center justify-center px-6 text-center">
        <p role="alert" className="text-sm text-error-soft">
          {state.message}
        </p>
        <button
          type="button"
          data-testid="qr-menu-retry"
          onClick={retry}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Try again
        </button>
      </main>
    );
  }

  const allCombos = state.menu.combos ?? [];
  // A category holding only combos still gets a tab.
  const categories = state.menu.categories.filter((c) => nonEmptyCategories([c]).length > 0 || allCombos.some((combo) => combo.categoryId === c.id));
  const items = visibleItems(state.menu.categories, activeCategoryId, query);
  const combos = combosFor(allCombos, activeCategoryId, query);
  const currency = allCombos[0]?.currency ?? "INR";
  const showTabs = query.trim() === "" && categories.length > 0;

  const tabs = showTabs && (
    <div
      role="tablist"
      aria-label="Menu categories"
      aria-orientation={kiosk ? "vertical" : "horizontal"}
      className={kiosk ? "flex w-24 shrink-0 flex-col gap-2 border-r border-border bg-card/60 p-2" : "mt-3 flex gap-2 overflow-x-auto"}
    >
      {categories.map((category) => {
        const selected = activeCategoryId === category.id;
        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`qr-menu-tab-${category.id}`}
            onClick={() => setActiveCategoryId(category.id)}
            className={`${kiosk ? "rounded-xl px-1 py-5 text-center text-sm leading-tight" : "shrink-0 rounded-full px-4 py-2 text-sm"} font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
              selected ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-accent"
            }`}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );

  return (
    <main data-testid="qr-menu" data-layout={kiosk ? "kiosk" : "list"} className="flex min-h-screen flex-1 flex-col pb-24">
      <div className="sticky top-0 z-20 bg-background/95 px-4 pb-3 pt-6 backdrop-blur">
        {kiosk && <h1 className="mb-3 font-headline text-2xl font-bold text-foreground">What would you like today?</h1>}
        <label htmlFor="qr-menu-search" className="sr-only">
          Search dishes
        </label>
        <input
          id="qr-menu-search"
          data-testid="qr-menu-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search dishes"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        {!kiosk && tabs}
      </div>

      <div className={kiosk ? "flex flex-1" : "contents"}>
        {kiosk && tabs}
        <div aria-live="polite" className={kiosk ? "grid min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] content-start gap-3 p-3" : "flex flex-col gap-3 px-4 pt-4"}>
          {comboError && (
            <p role="alert" data-testid="qr-combo-error" className="col-span-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-error-soft">
              {comboError}
            </p>
          )}
          {combos.map((combo) => (
            <ComboCard key={combo.id} combo={combo} savingsMinor={comboSavingsMinor(combo, itemsById)} onOpen={() => setActiveCombo(combo)} />
          ))}
          {items.length === 0 && combos.length === 0 ? (
            <p data-testid="qr-menu-empty" className="col-span-full mt-8 text-center text-sm text-muted-foreground">
              {query.trim() !== "" ? "No dishes match your search" : "Nothing here yet"}
            </p>
          ) : (
            items.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                kiosk={kiosk}
                adding={addingId === item.id}
                onOpen={() => router.push(`${MENU_HREF}/${item.id}`)}
                onAdd={() => void quickAdd(item)}
              />
            ))
          )}
        </div>
      </div>

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          data-testid="qr-menu-notice"
          className={`fixed inset-x-4 bottom-20 z-30 rounded-xl px-4 py-2.5 text-center text-sm font-semibold shadow-lg ${
            notice.kind === "error" ? "bg-card text-error-soft ring-1 ring-border" : "bg-foreground text-background"
          }`}
        >
          {notice.text}
        </p>
      )}

      <CartPill key={cartKey} />

      {activeCombo && (
        <ComboPicker
          combo={activeCombo}
          itemsById={itemsById}
          formatPrice={(minor) => formatPriceMinor(minor, currency)}
          themeClass="qr-theme"
          busy={addingCombo}
          confirmLabel="Add to cart"
          onCancel={() => setActiveCombo(null)}
          onConfirm={(value) => void handleConfirmCombo(value)}
        />
      )}
    </main>
  );
}

/** A combo in the guest menu (restiq-web#264): what's in it, its price, and what it saves. */
function ComboCard({ combo, savingsMinor, onOpen }: Readonly<{ combo: ComboMenuView; savingsMinor: number; onOpen: () => void }>) {
  const summary = combo.slots.map((s) => (s.options.length === 1 ? s.options[0].itemName : `${s.pickCount > 1 ? `${s.pickCount} ` : ""}${s.name.toLowerCase()} of your choice`)).join(" + ");
  return (
    <button
      type="button"
      data-testid={`qr-menu-combo-${combo.id}`}
      disabled={!combo.available}
      onClick={onOpen}
      className="flex items-center gap-4 rounded-xl border border-primary/40 bg-card p-4 text-left hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 disabled:grayscale"
    >
      <div aria-hidden="true" className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/15 text-xs font-bold uppercase tracking-wider text-primary">
        {combo.photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- inline data: photo, nothing for next/image to optimise */}
            <img src={combo.photoUrl} alt="" className="size-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-primary py-0.5 text-center text-[9px] text-primary-foreground">Combo</span>
          </>
        ) : (
          "Combo"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-headline text-base font-semibold text-foreground">{combo.name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{summary}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold tabular-nums">
          {combo.available ? (
            <>
              <span className="text-foreground">{formatPriceMinor(combo.priceMinor, combo.currency)}</span>
              {savingsMinor > 0 && <span className="text-xs font-medium text-status-healthy">Save {formatPriceMinor(savingsMinor, combo.currency)}</span>}
            </>
          ) : (
            <span className="text-muted-foreground">Unavailable today</span>
          )}
        </p>
      </div>
    </button>
  );
}

function MenuItemCard({
  item,
  kiosk,
  adding,
  onOpen,
  onAdd,
}: Readonly<{ item: MenuItemView; kiosk: boolean; adding: boolean; onOpen: () => void; onAdd: () => void }>) {
  const price = displayPriceInfo(item);
  const isUnavailable = !item.available;

  return (
    <div className={`relative overflow-hidden border border-border bg-card ${kiosk ? "rounded-2xl" : "rounded-xl"} ${isUnavailable ? "opacity-50 grayscale" : ""}`}>
      <button
        type="button"
        data-testid={`qr-menu-item-${item.id}`}
        disabled={isUnavailable}
        onClick={onOpen}
        className={`flex w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default ${
          kiosk ? "flex-col" : "items-center gap-4 p-3 pr-16"
        } ${isUnavailable ? "" : "hover:bg-accent"}`}
      >
        <span
          aria-hidden="true"
          className={`flex shrink-0 items-center justify-center overflow-hidden bg-muted text-xl font-semibold text-muted-foreground ${
            kiosk ? "aspect-[4/3] w-full" : "size-20 rounded-lg"
          }`}
        >
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- owner-supplied https or data: URLs, not something next/image's optimizer can handle
            <img data-testid={`qr-menu-item-photo-${item.id}`} src={item.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            initialLetterTile(item.name)
          )}
        </span>
        <span className={`block min-w-0 flex-1 ${kiosk ? "w-full p-3" : ""}`}>
          <span className={`block font-headline font-semibold text-foreground ${kiosk ? "line-clamp-2 text-lg leading-tight" : "truncate text-base"}`}>{item.name}</span>
          {item.allergens.length > 0 && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">Contains: {item.allergens.map((allergen) => allergen.name).join(", ")}</span>
          )}
          <span className={`mt-1 block font-semibold tabular-nums ${kiosk ? "text-base" : "text-sm"}`}>
            {isUnavailable ? (
              <span data-testid={`qr-menu-item-unavailable-${item.id}`} className="text-muted-foreground">
                Unavailable today
              </span>
            ) : price ? (
              <span className="text-foreground">
                {item.variants.length > 0 ? "From " : ""}
                {formatPriceMinor(price.priceMinor, price.currency)}
              </span>
            ) : (
              <span className="text-muted-foreground">Price unavailable</span>
            )}
          </span>
        </span>
      </button>
      {!isUnavailable && price && (
        <button
          type="button"
          data-testid={`qr-menu-add-${item.id}`}
          aria-label={canQuickAdd(item) ? `Add ${item.name} to cart` : `Choose options for ${item.name}`}
          disabled={adding}
          onClick={onAdd}
          className={`absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 ${
            kiosk ? "right-2 top-2 size-12 ring-4 ring-card" : "right-3 top-1/2 size-11 -translate-y-1/2"
          }`}
        >
          <Plus className={kiosk ? "size-6" : "size-5"} strokeWidth={2.75} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
