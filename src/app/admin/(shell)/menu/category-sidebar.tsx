"use client";

// T4a's "Tandoor" filter is this same list with a category selected - one
// route, client-side filter (EXPERIENCE.md: "not a separate screen").
import { useState } from "react";
import { createMenuCategory } from "../../api";
import { useToast } from "../toast";
import { ALL_CATEGORY, CategoryView } from "./menu-state";

export function CategorySidebar({
  categories,
  totalItems,
  selected,
  onSelect,
  onCategoryCreated,
}: Readonly<{
  categories: CategoryView[];
  totalItems: number;
  selected: string;
  onSelect: (category: string) => void;
  onCategoryCreated: (category: CategoryView) => void;
}>) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const pushToast = useToast();

  async function handleAddCategory() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await createMenuCategory(name.trim());
      onCategoryCreated(created);
      setName("");
      setAdding(false);
    } catch {
      pushToast({ kind: "error", message: "That category didn't save. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <nav aria-label="Menu categories" className="w-56 shrink-0" data-testid="menu-category-sidebar">
      <ul className="space-y-1">
        <CategoryRow label="All items" count={totalItems} active={selected === ALL_CATEGORY} onSelect={() => onSelect(ALL_CATEGORY)} testId="menu-category-all" />
        {categories.map((category) => (
          <CategoryRow
            key={category.id}
            label={category.name}
            count={category.itemCount}
            active={selected === category.id}
            onSelect={() => onSelect(category.id)}
            testId={`menu-category-${category.id}`}
          />
        ))}
      </ul>

      {adding ? (
        <div className="mt-2 space-y-2">
          <input
            data-testid="menu-add-category-input"
            autoFocus
            value={name}
            placeholder="Category name"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleAddCategory();
              if (event.key === "Escape") setAdding(false);
            }}
            className="w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex gap-2 text-xs">
            <button type="button" data-testid="menu-add-category-confirm" disabled={busy || !name.trim()} onClick={() => void handleAddCategory()} className="font-medium text-primary hover:underline disabled:opacity-50">
              {busy ? "Adding..." : "Add"}
            </button>
            <button type="button" data-testid="menu-add-category-cancel" onClick={() => setAdding(false)} className="text-muted-foreground hover:underline">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          data-testid="menu-add-category-open"
          onClick={() => setAdding(true)}
          className="mt-2 text-sm font-medium text-primary hover:underline"
        >
          + Add
        </button>
      )}
    </nav>
  );
}

function CategoryRow({
  label,
  count,
  active,
  onSelect,
  testId,
}: Readonly<{ label: string; count: number; active: boolean; onSelect: () => void; testId: string }>) {
  return (
    <li>
      <button
        type="button"
        data-testid={testId}
        aria-current={active ? "page" : undefined}
        onClick={onSelect}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          active ? "bg-primary/15 font-semibold text-primary" : "text-foreground hover:bg-accent"
        }`}
      >
        {label}
        <span className="text-xs text-muted-foreground">{count}</span>
      </button>
    </li>
  );
}
