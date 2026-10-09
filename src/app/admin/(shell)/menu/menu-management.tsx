"use client";

// T4/T4a Menu Management (CAP-4): category sidebar + item DataTable + item
// editor drawer, all on one screen so the list never loses context
// (EXPERIENCE.md: "item editor as a drawer, not a full-page navigation").
// Currency defaults to INR (same convention as CAP-3's menu import) - the
// backend's menu endpoints carry no tenant-currency field to read instead.
import { LibraryBig, Plus, Search, Soup, Upload } from "lucide-react";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchAllergens, fetchCategories, fetchCombos, fetchItems, fetchModifierGroups } from "../../api";
import { MenuImport } from "../../menu-import";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useOutlets } from "../outlet-context";
import { useToast } from "../toast";
import { CategorySidebar } from "./category-sidebar";
import { CombosPanel } from "./combos-panel";
import { DirectoryDialog } from "./directory-dialog";
import { ItemDrawer } from "./item-drawer";
import { AllergenView, ALL_CATEGORY, CategoryView, ComboView, ItemView, ModifierGroupView, visibleItems } from "./menu-state";
import { MenuTable } from "./menu-table";

const CURRENCY = "INR";

interface MenuData {
  items: ItemView[];
  categories: CategoryView[];
  modifierGroups: ModifierGroupView[];
  allergens: AllergenView[];
  combos: ComboView[];
}

interface Landed {
  attempt: number;
  data: MenuData | null;
  failed: boolean;
}

// Same landed/attempt shape as use-admin-load.ts, extended to a Promise.all
// of the several catalog fetches this screen needs together (items,
// categories, modifier-group catalog, allergen catalog, combos catalog).
function useMenuData() {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<Landed | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchItems(), fetchCategories(), fetchModifierGroups(), fetchAllergens(), fetchCombos()])
      .then(([items, categories, modifierGroups, allergens, combos]) => {
        if (!cancelled) setLanded({ attempt, failed: false, data: { items, categories, modifierGroups, allergens, combos } });
      })
      .catch(() => {
        if (!cancelled) setLanded({ attempt, failed: true, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const current = landed !== null && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    data: current?.data ?? null,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function MenuManagement() {
  const { loading, failed, data, retry } = useMenuData();
  const { outlets, selectedOutletId } = useOutlets();

  const [items, setItems] = useState<ItemView[] | null>(null);
  const [categories, setCategories] = useState<CategoryView[] | null>(null);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupView[] | null>(null);
  const [allergens, setAllergens] = useState<AllergenView[] | null>(null);
  const [combos, setCombos] = useState<ComboView[] | null>(null);
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [search, setSearch] = useState("");
  const [drawerItem, setDrawerItem] = useState<ItemView | null | "closed">("closed");
  const [tab, setTab] = useState<"items" | "combos">("items");
  const [importOpen, setImportOpen] = useState(false);
  const pushToast = useToast();
  const [directoryOpen, setDirectoryOpen] = useState(false);
  // Issue #330: the list only ever fetches an item's price once, on mount - an
  // override here keeps the row in sync right after the drawer changes it.
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});

  const effectiveItems = useMemo(() => items ?? data?.items ?? [], [items, data]);
  const effectiveCategories = useMemo(() => categories ?? data?.categories ?? [], [categories, data]);
  const effectiveModifierGroups = modifierGroups ?? data?.modifierGroups ?? [];
  const effectiveAllergens = allergens ?? data?.allergens ?? [];
  const effectiveCombos = combos ?? data?.combos ?? [];
  const filtered = useMemo(() => visibleItems(effectiveItems, { category, q: search }), [effectiveItems, category, search]);
  const filteredOrSearched = category !== ALL_CATEGORY || search.trim() !== "";

  const upsertItem = useCallback(
    (updated: ItemView) => {
      const previous = effectiveItems.find((item) => item.id === updated.id);
      setItems((current) => {
        const base = current ?? effectiveItems;
        const exists = base.some((item) => item.id === updated.id);
        return exists ? base.map((item) => (item.id === updated.id ? updated : item)) : [...base, updated];
      });
      if (!previous) {
        // A new item: its category's count was never incremented for it.
        setCategories(effectiveCategories.map((c) => (c.id === updated.categoryId ? { ...c, itemCount: c.itemCount + 1 } : c)));
      } else if (previous.categoryId !== updated.categoryId) {
        setCategories(
          effectiveCategories.map((c) => {
            if (c.id === previous.categoryId) return { ...c, itemCount: Math.max(0, c.itemCount - 1) };
            if (c.id === updated.categoryId) return { ...c, itemCount: c.itemCount + 1 };
            return c;
          }),
        );
      }
    },
    [effectiveItems, effectiveCategories],
  );

  function handleAvailabilityChanged(itemId: string, available: boolean) {
    setItems((current) => (current ?? effectiveItems).map((item) => (item.id === itemId ? { ...item, available } : item)));
  }

  // An import can add categories as well as items, so refetch rather than merge.
  function handleImported(itemCount: number) {
    setImportOpen(false);
    setDirectoryOpen(false);
    setItems(null);
    setCategories(null);
    retry();
    pushToast({ kind: "success", message: `${itemCount} item${itemCount === 1 ? "" : "s"} added to your menu.` });
  }

  if (loading) {
    return (
      <div className="space-y-4" data-testid="menu-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (failed) {
    return <LoadErrorPanel testId="menu-load-error" message="Your menu couldn't be loaded." onRetry={retry} />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Menu</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="menu-summary">
            {effectiveItems.length} item{effectiveItems.length === 1 ? "" : "s"} in {effectiveCategories.length} categor
            {effectiveCategories.length === 1 ? "y" : "ies"}
            {effectiveCombos.length > 0 ? `, ${effectiveCombos.length} combo${effectiveCombos.length === 1 ? "" : "s"}` : ""}
            {outlets.length > 0 ? `, synced to ${outlets.length} outlet${outlets.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className={`flex flex-wrap gap-2 ${tab === "combos" ? "hidden" : ""}`}>
          <Button variant="secondary" data-testid="menu-browse-directory" onClick={() => setDirectoryOpen(true)}>
            <LibraryBig aria-hidden="true" /> Browse directory
          </Button>
          <Button variant="secondary" data-testid="menu-import-link" onClick={() => setImportOpen(true)}>
            <Upload aria-hidden="true" /> Import
          </Button>
          <Button data-testid="menu-add-item" onClick={() => setDrawerItem(null)}>
            <Plus aria-hidden="true" /> Add Item
          </Button>
        </div>
      </div>

      {/* restiq-web#264: combos live beside items, not inside one item's drawer. */}
      <div role="tablist" aria-label="Menu" className="mt-4 flex gap-1 border-b border-border/40">
        {(["items", "combos"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            data-testid={`menu-tab-${key}`}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {key === "items" ? "Items" : `Combos${effectiveCombos.length ? ` (${effectiveCombos.length})` : ""}`}
          </button>
        ))}
      </div>

      {tab === "combos" ? (
        <div className="mt-4 flex flex-1">
          <CombosPanel combos={effectiveCombos} items={effectiveItems} categories={effectiveCategories} currency={CURRENCY} onChanged={setCombos} />
        </div>
      ) : (
        <>
          <div className="relative mt-4 w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              data-testid="menu-search"
              aria-label="Search menu items"
              placeholder="Search items..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-input py-1 pl-8 pr-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Categories stack above the item table below md (issue #228). */}
          <div className="mt-4 flex flex-1 flex-col gap-4 md:flex-row md:gap-6">
            <CategorySidebar
              categories={effectiveCategories}
              totalItems={effectiveItems.length}
              selected={category}
              onSelect={setCategory}
              onCategoryCreated={(created) => setCategories([...effectiveCategories, created])}
            />

            <div data-testid="menu-list-scroll" className="flex-1 overflow-auto rounded-lg border border-border/40 bg-card md:max-h-[max(20rem,calc(100dvh-17rem))]">
              {filtered.length === 0 ? (
                <EmptyState filtered={filteredOrSearched} onClearFilters={() => { setCategory(ALL_CATEGORY); setSearch(""); }} onImport={() => setImportOpen(true)} onAddItem={() => setDrawerItem(null)} onBrowseDirectory={() => setDirectoryOpen(true)} />
              ) : (
                <MenuTable
                  items={filtered}
                  currency={CURRENCY}
                  filterKey={`${category}|${search}`}
                  priceOverrides={priceOverrides}
                  onSelect={setDrawerItem}
                  onAvailabilityChanged={handleAvailabilityChanged}
                />
              )}
            </div>
          </div>
        </>
      )}

      <DirectoryDialog open={directoryOpen} onClose={() => setDirectoryOpen(false)} onImported={handleImported} />

      <ItemDrawer
        open={drawerItem !== "closed"}
        item={drawerItem === "closed" ? null : drawerItem}
        categories={effectiveCategories}
        modifierGroupCatalog={effectiveModifierGroups}
        allergenCatalog={effectiveAllergens}
        outlets={outlets}
        selectedOutletId={selectedOutletId}
        defaultCategoryId={category !== ALL_CATEGORY ? category : (effectiveCategories[0]?.id ?? "")}
        currency={CURRENCY}
        onClose={() => setDrawerItem("closed")}
        onSaved={(saved) => {
          upsertItem(saved);
          setDrawerItem("closed");
        }}
        onDeleted={(deleted) => {
          setItems((current) => (current ?? effectiveItems).filter((i) => i.id !== deleted.id));
          setCategories(effectiveCategories.map((c) => (c.id === deleted.categoryId ? { ...c, itemCount: Math.max(0, c.itemCount - 1) } : c)));
          setDrawerItem("closed");
          pushToast({ kind: "success", message: `${deleted.name} was deleted from your menu.` });
        }}
        onModifierGroupCreated={(group) => setModifierGroups([...effectiveModifierGroups, group])}
        onAllergenCreated={(allergen) => setAllergens([...effectiveAllergens, allergen])}
        onPriceChanged={(itemId, priceMinor) => setPriceOverrides((current) => ({ ...current, [itemId]: priceMinor }))}
      />

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onCommitted={handleImported} />
    </div>
  );
}

// Import as a dialog over the menu (issue #239). /admin/menu/import stays for
// the onboarding checklist's link.
function ImportDialog({ open, onClose, onCommitted }: Readonly<{ open: boolean; onClose: () => void; onCommitted: (itemCount: number) => void }>) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="menu-import-dialog"
          aria-describedby={undefined}
          className="admin-theme fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border/60 bg-popover p-4 text-foreground shadow-xl sm:p-6"
        >
          <Dialog.Title className="sr-only">Import menu</Dialog.Title>
          <Dialog.Close asChild>
            <button
              type="button"
              data-testid="menu-import-dialog-close"
              aria-label="Close"
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ✕
            </button>
          </Dialog.Close>
          <MenuImport onCommitted={onCommitted} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EmptyState({
  filtered,
  onClearFilters,
  onImport,
  onAddItem,
  onBrowseDirectory,
}: Readonly<{ filtered: boolean; onClearFilters: () => void; onImport: () => void; onAddItem: () => void; onBrowseDirectory: () => void }>) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
      <Soup className="size-8 text-muted-foreground" aria-hidden="true" />
      {filtered ? (
        <div data-testid="menu-filtered-empty">
          <p className="font-headline text-lg font-medium">No items match these filters</p>
          <Button variant="secondary" size="sm" className="mt-3" data-testid="menu-filtered-empty-clear" onClick={onClearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div data-testid="menu-empty">
          <p className="font-headline text-lg font-medium">Your menu is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">Pick items from the product directory, import a menu, or add your first item.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" size="sm" data-testid="menu-empty-directory" onClick={onBrowseDirectory}>
              Browse directory
            </Button>
            <Button variant="secondary" size="sm" data-testid="menu-empty-import" onClick={onImport}>
              Import menu
            </Button>
            <Button size="sm" data-testid="menu-empty-add" onClick={onAddItem}>
              Add item
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
