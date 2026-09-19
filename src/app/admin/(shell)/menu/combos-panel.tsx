"use client";

// Owner Combos tab (restiq-web#264): the list of combos and the combo editor
// drawer. A combo is built from slots - "pick 1 main from these", "pick 2
// breads", or one fixed item - and saved whole (restiq-backend#160).
import { Layers, Plus, Trash2 } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { archiveCombo, saveCombo } from "../../api";
import { ComboDraft, describeSlots, draftFromCombo, emptySlot, SlotDraft, toSaveComboInput, validateComboDraft } from "./combo-editor-state";
import { CategoryView, ComboView, formatPriceMinor, ItemView } from "./menu-state";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const LABEL_CLASS = "font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function CombosPanel({
  combos,
  items,
  categories,
  currency,
  onChanged,
}: Readonly<{ combos: ComboView[]; items: ItemView[]; categories: CategoryView[]; currency: string; onChanged: (combos: ComboView[]) => void }>) {
  const [editing, setEditing] = useState<ComboView | null | "closed">("closed");
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "No category";

  return (
    <div className="flex-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Bundles at one price. Guests and staff pick an item for each slot.</p>
        <Button data-testid="combo-add" onClick={() => setEditing(null)} disabled={items.length === 0}>
          <Plus aria-hidden="true" /> Add combo
        </Button>
      </div>

      {combos.length === 0 ? (
        <div data-testid="combos-empty" className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-border/40 bg-card px-8 py-16 text-center">
          <Layers className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-headline text-lg font-medium">Create your first combo</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            A thali, a meal deal or a coffee-and-cake offer: set one price and the items guests choose from.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border/40 rounded-lg border border-border/40 bg-card" data-testid="combos-list">
          {combos.map((combo) => (
            <li key={combo.id}>
              <button
                type="button"
                data-testid={`combo-row-${combo.id}`}
                onClick={() => setEditing(combo)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{combo.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{describeSlots(combo)}</span>
                </span>
                <span className="text-xs text-muted-foreground">{categoryName(combo.categoryId)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${combo.available ? "bg-status-healthy/15 text-status-healthy" : "bg-muted text-muted-foreground"}`}>
                  {combo.available ? "On sale" : "Off"}
                </span>
                <span className="w-20 text-right font-semibold tabular-nums">{formatPriceMinor(combo.priceMinor, combo.currency)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing !== "closed" && (
        <ComboEditor
          combo={editing}
          items={items}
          categories={categories}
          currency={currency}
          onClose={() => setEditing("closed")}
          onSaved={(saved) => {
            onChanged(combos.some((c) => c.id === saved.id) ? combos.map((c) => (c.id === saved.id ? saved : c)) : [...combos, saved]);
            setEditing("closed");
          }}
          onDeleted={(id) => {
            onChanged(combos.filter((c) => c.id !== id));
            setEditing("closed");
          }}
        />
      )}
    </div>
  );
}

// "itemId:variantId" - one select value per sellable item or size.
const optionValue = (itemId: string, variantId: string | null) => `${itemId}:${variantId ?? ""}`;

function ComboEditor({
  combo,
  items,
  categories,
  currency,
  onClose,
  onSaved,
  onDeleted,
}: Readonly<{
  combo: ComboView | null;
  items: ItemView[];
  categories: CategoryView[];
  currency: string;
  onClose: () => void;
  onSaved: (combo: ComboView) => void;
  onDeleted: (comboId: string) => void;
}>) {
  const [draft, setDraft] = useState<ComboDraft>(() => draftFromCombo(combo, categories[0]?.id ?? ""));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const errors = validateComboDraft(draft);
  const valid = Object.keys(errors).length === 0;
  const shown = touched ? errors : {};

  const choices = items.flatMap((item) =>
    item.variants.length === 0
      ? [{ value: optionValue(item.id, null), label: item.name }]
      : item.variants.map((v) => ({ value: optionValue(item.id, v.id), label: `${item.name} (${v.name})` })),
  );
  const labelFor = (itemId: string, variantId: string | null) => choices.find((c) => c.value === optionValue(itemId, variantId))?.label ?? "Removed item";

  const setSlot = (key: string, change: (slot: SlotDraft) => SlotDraft) => setDraft((d) => ({ ...d, slots: d.slots.map((s) => (s.key === key ? change(s) : s)) }));

  async function handleSave() {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveCombo(combo?.id ?? null, toSaveComboInput(draft, currency)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The combo couldn't be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!combo) return;
    setSaving(true);
    try {
      await archiveCombo(combo.id);
      onDeleted(combo.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The combo couldn't be deleted. Try again.");
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/60" />
        <Dialog.Content
          data-testid="combo-editor"
          aria-describedby={undefined}
          className="admin-theme fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col overflow-y-auto border-l border-border/60 bg-card text-foreground shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
            <Dialog.Title className="font-headline text-lg font-semibold">{combo ? "Edit combo" : "Add combo"}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                data-testid="combo-editor-close"
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 space-y-5 px-6 py-5">
            <div>
              <label htmlFor="combo-name" className={LABEL_CLASS}>
                Name *
              </label>
              <input
                id="combo-name"
                data-testid="combo-name-input"
                value={draft.name}
                placeholder="Thali meal"
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className={FIELD_CLASS}
              />
              {shown.name && <p className="mt-1 text-xs text-status-error">{shown.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="combo-price" className={LABEL_CLASS}>
                  Price ({currency}) *
                </label>
                <input
                  id="combo-price"
                  data-testid="combo-price-input"
                  inputMode="decimal"
                  value={draft.price}
                  placeholder="349"
                  onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                  className={FIELD_CLASS}
                />
                {shown.price && <p className="mt-1 text-xs text-status-error">{shown.price}</p>}
              </div>
              <div>
                <label htmlFor="combo-category" className={LABEL_CLASS}>
                  Shows in
                </label>
                <select
                  id="combo-category"
                  data-testid="combo-category-select"
                  value={draft.categoryId}
                  onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
                  className={FIELD_CLASS}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {shown.category && <p className="mt-1 text-xs text-status-error">{shown.category}</p>}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="combo-available-toggle"
                checked={draft.available}
                onChange={(e) => setDraft((d) => ({ ...d, available: e.target.checked }))}
                className="size-4 accent-primary"
              />
              On sale
            </label>

            <div>
              <p className={LABEL_CLASS}>Slots</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Each slot is one step in the order. A slot with one item is always included.
              </p>
              <ol className="space-y-3">
                {draft.slots.map((slot, index) => (
                  <li key={slot.key} data-testid={`combo-slot-${index}`} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-start gap-2">
                      <input
                        aria-label={`Slot ${index + 1} name`}
                        data-testid={`combo-slot-name-${index}`}
                        value={slot.name}
                        placeholder={index === 0 ? "Main" : "Drink"}
                        onChange={(e) => setSlot(slot.key, (s) => ({ ...s, name: e.target.value }))}
                        className={`${FIELD_CLASS} flex-1`}
                      />
                      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        Pick
                        <input
                          aria-label={`Slot ${index + 1} pick count`}
                          data-testid={`combo-slot-pick-${index}`}
                          type="number"
                          min={1}
                          value={slot.pickCount}
                          onChange={(e) => setSlot(slot.key, (s) => ({ ...s, pickCount: e.target.value }))}
                          className={`${FIELD_CLASS} w-16`}
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove slot ${index + 1}`}
                        data-testid={`combo-slot-remove-${index}`}
                        onClick={() => setDraft((d) => ({ ...d, slots: d.slots.filter((s) => s.key !== slot.key) }))}
                        className="rounded-md p-2 text-muted-foreground hover:text-status-error focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>

                    <ul className="mt-2 space-y-1.5">
                      {slot.options.map((option, oi) => (
                        <li key={optionValue(option.itemId, option.variantId)} className="flex items-center gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">{labelFor(option.itemId, option.variantId)}</span>
                          <label className="flex items-center gap-1 text-xs text-muted-foreground">
                            + extra
                            <input
                              aria-label={`Extra charge for ${labelFor(option.itemId, option.variantId)}`}
                              data-testid={`combo-option-upcharge-${index}-${oi}`}
                              inputMode="decimal"
                              value={option.upcharge}
                              placeholder="0"
                              onChange={(e) => setSlot(slot.key, (s) => ({ ...s, options: s.options.map((o, j) => (j === oi ? { ...o, upcharge: e.target.value } : o)) }))}
                              className={`${FIELD_CLASS} w-20 py-1`}
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={`Remove ${labelFor(option.itemId, option.variantId)}`}
                            data-testid={`combo-option-remove-${index}-${oi}`}
                            onClick={() => setSlot(slot.key, (s) => ({ ...s, options: s.options.filter((_, j) => j !== oi) }))}
                            className="rounded-md p-1 text-muted-foreground hover:text-status-error focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>

                    <select
                      aria-label={`Add an item to slot ${index + 1}`}
                      data-testid={`combo-slot-add-item-${index}`}
                      value=""
                      onChange={(e) => {
                        const [itemId, variantId] = e.target.value.split(":");
                        if (!itemId) return;
                        setSlot(slot.key, (s) => ({ ...s, options: [...s.options, { itemId, variantId: variantId || null, upcharge: "" }] }));
                      }}
                      className={`${FIELD_CLASS} mt-2`}
                    >
                      <option value="">+ Add an item…</option>
                      {choices
                        .filter((c) => !slot.options.some((o) => optionValue(o.itemId, o.variantId) === c.value))
                        .map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                    </select>
                    {shown.slotErrors?.[slot.key] && <p className="mt-1 text-xs text-status-error">{shown.slotErrors[slot.key]}</p>}
                  </li>
                ))}
              </ol>
              {shown.slots && <p className="mt-1 text-xs text-status-error">{shown.slots}</p>}
              <Button type="button" variant="secondary" size="sm" className="mt-3" data-testid="combo-add-slot" onClick={() => setDraft((d) => ({ ...d, slots: [...d.slots, emptySlot()] }))}>
                <Plus aria-hidden="true" /> Add slot
              </Button>
            </div>
          </div>

          <div className="border-t border-border/40 px-6 py-4">
            {error && (
              <p role="alert" data-testid="combo-save-error" className="mb-3 text-sm text-status-error">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              {combo ? (
                confirmDelete ? (
                  <span className="flex items-center gap-2 text-sm">
                    Delete {combo.name}?
                    <Button variant="destructive" size="sm" data-testid="combo-delete-confirm" disabled={saving} onClick={() => void handleDelete()}>
                      Delete
                    </Button>
                    <Button variant="ghost" size="sm" data-testid="combo-delete-cancel" onClick={() => setConfirmDelete(false)}>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <Button variant="ghost" size="sm" data-testid="combo-delete" onClick={() => setConfirmDelete(true)}>
                    <Trash2 aria-hidden="true" /> Delete
                  </Button>
                )
              ) : (
                <span />
              )}
              <Button data-testid="combo-save" disabled={saving || (touched && !valid)} onClick={() => void handleSave()}>
                {saving ? "Saving..." : "Save combo"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
