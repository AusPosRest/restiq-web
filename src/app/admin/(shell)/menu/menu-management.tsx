"use client";

// T4/T4a Menu Management (CAP-4): category sidebar + item DataTable + item
// editor drawer, all on one screen so the list never loses context
// (EXPERIENCE.md: "item editor as a drawer, not a full-page navigation").
// Currency defaults to INR (same convention as CAP-3's menu import) - the
// backend's menu endpoints carry no tenant-currency field to read instead.
import { Plus, Search, Soup, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchAllergens, fetchCategories, fetchCombos, fetchItems, fetchModifierGroups } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useOutlets } from "../outlet-context";
import { CategorySidebar } from "./category-sidebar";
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

  const effectiveItems = useMemo(() => items ?? data?.items ?? [], [items, data]);
  const effectiveCategories = categories ?? data?.categories ?? [];
  const effectiveModifierGroups = modifierGroups ?? data?.modifierGroups ?? [];
  const effectiveAllergens = allergens ?? data?.allergens ?? [];
  const effectiveCombos = combos ?? data?.combos ?? [];
  const filtered = useMemo(() => visibleItems(effectiveItems, { category, q: search }), [effectiveItems, category, search]);
  const filteredOrSearched = category !== ALL_CATEGORY || search.trim() !== "";

  const upsertItem = useCallback(
    (updated: ItemView) => {
      setItems((current) => {
        const base = current ?? effectiveItems;
        const exists = base.some((item) => item.id === updated.id);
        return exists ? base.map((item) => (item.id === updated.id ? updated : item)) : [...base, updated];
      });
    },
    [effectiveItems],
  );

  function handleAvailabilityChanged(itemId: string, available: boolean) {
    setItems((current) => (current ?? effectiveItems).map((item) => (item.id === itemId ? { ...item, available } : item)));
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Menu</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="menu-summary">
            {effectiveItems.length} item{effectiveItems.length === 1 ? "" : "s"} in {effectiveCategories.length} categor
            {effectiveCategories.length === 1 ? "y" : "ies"}
            {outlets.length > 0 ? `, synced to ${outlets.length} outlet${outlets.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" data-testid="menu-import-link">
            <Link href="/admin/menu/import">
              <Upload aria-hidden="true" /> Import
            </Link>
          </Button>
          <Button data-testid="menu-add-item" onClick={() => setDrawerItem(null)}>
            <Plus aria-hidden="true" /> Add Item
          </Button>
        </div>
      </div>

      <div className="relative mt-4 w-72">
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

      <div className="mt-4 flex flex-1 gap-6">
        <CategorySidebar
          categories={effectiveCategories}
          totalItems={effectiveItems.length}
          selected={category}
          onSelect={setCategory}
          onCategoryCreated={(created) => setCategories([...effectiveCategories, created])}
        />

        <div className="flex-1 overflow-x-auto rounded-lg border border-border/40 bg-card">
          {filtered.length === 0 ? (
            <EmptyState filtered={filteredOrSearched} onClearFilters={() => { setCategory(ALL_CATEGORY); setSearch(""); }} onAddItem={() => setDrawerItem(null)} />
          ) : (
            <MenuTable items={filtered} currency={CURRENCY} onSelect={setDrawerItem} onAvailabilityChanged={handleAvailabilityChanged} />
          )}
        </div>
      </div>

      <ItemDrawer
        open={drawerItem !== "closed"}
        item={drawerItem === "closed" ? null : drawerItem}
        allItems={effectiveItems}
        categories={effectiveCategories}
        modifierGroupCatalog={effectiveModifierGroups}
        allergenCatalog={effectiveAllergens}
        comboCatalog={effectiveCombos}
        outlets={outlets}
        selectedOutletId={selectedOutletId}
        defaultCategoryId={category !== ALL_CATEGORY ? category : (effectiveCategories[0]?.id ?? "")}
        currency={CURRENCY}
        onClose={() => setDrawerItem("closed")}
        onSaved={(saved) => {
          upsertItem(saved);
          setDrawerItem("closed");
        }}
        onModifierGroupCreated={(group) => setModifierGroups([...effectiveModifierGroups, group])}
        onAllergenCreated={(allergen) => setAllergens([...effectiveAllergens, allergen])}
        onComboCreated={(combo) => setCombos([...effectiveCombos, combo])}
      />
    </div>
  );
}

function EmptyState({ filtered, onClearFilters, onAddItem }: Readonly<{ filtered: boolean; onClearFilters: () => void; onAddItem: () => void }>) {
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
          <p className="mt-1 text-sm text-muted-foreground">Import a menu or add your first item to get started.</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button asChild variant="secondary" size="sm" data-testid="menu-empty-import">
              <Link href="/admin/menu/import">Import menu</Link>
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
