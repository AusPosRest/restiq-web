"use client";

// Item editor drawer (EXPERIENCE.md Menu Management pattern): a drawer, not a
// full-page navigation, so the list stays visible behind it. Handles both
// create and edit. Field-by-field API shape verified against
// restiq-backend's actual admin/v1/menu working tree (see menu-state.ts's
// file header and api.ts's CAP-4 comment for what that means and its limits).
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  addVariant as apiAddVariant,
  createAllergen,
  createCombo,
  createItemPrice,
  createMenuItem,
  createModifierGroup,
  CreateItemInput,
  fetchCurrentPrice,
  removeVariant as apiRemoveVariant,
  replaceItemAllergens,
  replaceItemModifierGroups,
  setOutletAvailability,
  clearOutletAvailability,
  updateMenuItem,
} from "../../api";
import { itemDraftFromView, ItemDraft, toggleId, validateItemDraft } from "./item-drawer-state";
import {
  AllergenView,
  CategoryView,
  ComboView,
  combosForItem,
  CHANNEL_LABEL,
  formatEffectiveDate,
  formatPriceMinor,
  ItemView,
  majorStringToPriceMinor,
  ModifierGroupView,
  OutletView,
  PendingPriceInfo,
  pendingChangeFor,
  validateModifierGroup,
} from "./menu-state";
import { PriceChangeDialog } from "./price-change-dialog";
import type { PriceScheduleForm } from "./price-schedule-state";
import { priceScheduleEffectiveAt } from "./price-schedule-state";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const LABEL_CLASS = "font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

interface PriceLine {
  variantId: string | null;
  label: string;
}

export interface ItemDrawerProps {
  open: boolean;
  item: ItemView | null;
  allItems: ItemView[];
  categories: CategoryView[];
  modifierGroupCatalog: ModifierGroupView[];
  allergenCatalog: AllergenView[];
  comboCatalog: ComboView[];
  outlets: OutletView[];
  selectedOutletId: string | null;
  defaultCategoryId: string;
  currency: string;
  onClose: () => void;
  onSaved: (item: ItemView) => void;
  onModifierGroupCreated: (group: ModifierGroupView) => void;
  onAllergenCreated: (allergen: AllergenView) => void;
  onComboCreated: (combo: ComboView) => void;
}

export function ItemDrawer(props: Readonly<ItemDrawerProps>) {
  return props.open ? <DrawerBody key={props.item?.id ?? "new"} {...props} /> : null;
}

function DrawerBody({
  item,
  allItems,
  categories,
  modifierGroupCatalog,
  allergenCatalog,
  comboCatalog,
  outlets,
  selectedOutletId,
  defaultCategoryId,
  currency,
  onClose,
  onSaved,
  onModifierGroupCreated,
  onAllergenCreated,
  onComboCreated,
}: Readonly<ItemDrawerProps>) {
  const isCreate = item === null;
  const [draft, setDraft] = useState<ItemDraft>(() => itemDraftFromView(item, defaultCategoryId || categories[0]?.id || ""));
  const [liveItem, setLiveItem] = useState<ItemView | null>(item);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(item?.modifierGroups.map((g) => g.id) ?? []);
  const [selectedAllergenIds, setSelectedAllergenIds] = useState<string[]>(item?.allergens.map((a) => a.id) ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [priceLine, setPriceLine] = useState<PriceLine | null>(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPriceInfo[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, { dineInPriceMinor: number; deliveryPriceMinor: number }>>({});

  const errors = validateItemDraft(draft);
  const canSave = Object.keys(errors).length === 0;

  useEffect(() => {
    if (!liveItem) return;
    let cancelled = false;
    const lines: Array<string | null> = [null, ...liveItem.variants.map((v) => v.id)];
    Promise.all(
      lines.map(async (variantId) => {
        const [dineIn, delivery] = await Promise.all([
          fetchCurrentPrice(liveItem.id, { channel: "dine_in", variantId: variantId ?? undefined }),
          fetchCurrentPrice(liveItem.id, { channel: "delivery", variantId: variantId ?? undefined }),
        ]);
        return [variantId, dineIn, delivery] as const;
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, { dineInPriceMinor: number; deliveryPriceMinor: number }> = {};
        for (const [variantId, dineIn, delivery] of results) {
          map[variantId ?? "base"] = { dineInPriceMinor: dineIn?.priceMinor ?? 0, deliveryPriceMinor: delivery?.priceMinor ?? 0 };
        }
        setCurrentPrices(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveItem?.id, liveItem?.variants.length]);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (isCreate) {
        const input: CreateItemInput = {
          categoryId: draft.categoryId,
          name: draft.name,
          shortName: draft.shortName,
          modifierGroupIds: selectedGroupIds,
          allergenIds: selectedAllergenIds,
        };
        const created = await createMenuItem(input);
        onSaved(created);
      } else {
        const updated = await updateMenuItem(item!.id, { name: draft.name, shortName: draft.shortName, categoryId: draft.categoryId });
        setLiveItem(updated);
        onSaved(updated);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVariant(name: string) {
    if (!liveItem || !name.trim()) return;
    try {
      const updated = await apiAddVariant(liveItem.id, name.trim());
      setLiveItem(updated);
      onSaved(updated);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "That variant didn't save. Try again.");
    }
  }

  async function handleRemoveVariant(variantId: string) {
    if (!liveItem) return;
    try {
      const updated = await apiRemoveVariant(liveItem.id, variantId);
      setLiveItem(updated);
      onSaved(updated);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "That variant couldn't be removed. Try again.");
    }
  }

  async function handleToggleModifierGroup(groupId: string) {
    const next = toggleId(selectedGroupIds, groupId);
    setSelectedGroupIds(next);
    if (!liveItem) return;
    try {
      const updated = await replaceItemModifierGroups(liveItem.id, next);
      setLiveItem(updated);
      onSaved(updated);
    } catch (error) {
      setSelectedGroupIds(selectedGroupIds);
      setSaveError(error instanceof Error ? error.message : "That didn't save. Try again.");
    }
  }

  async function handleToggleAllergen(allergenId: string) {
    const next = toggleId(selectedAllergenIds, allergenId);
    setSelectedAllergenIds(next);
    if (!liveItem) return;
    try {
      const updated = await replaceItemAllergens(liveItem.id, next);
      setLiveItem(updated);
      onSaved(updated);
    } catch (error) {
      setSelectedAllergenIds(selectedAllergenIds);
      setSaveError(error instanceof Error ? error.message : "That didn't save. Try again.");
    }
  }

  async function handlePriceSubmit(form: PriceScheduleForm) {
    if (!liveItem || !priceLine) return;
    setPriceBusy(true);
    setPriceError(null);
    const effectiveAt = priceScheduleEffectiveAt(form) ?? undefined;
    const reason = form.reason.trim();
    try {
      for (const [channel, value] of [
        ["dine_in", form.dineIn],
        ["delivery", form.delivery],
      ] as const) {
        const priceMinor = majorStringToPriceMinor(value) ?? 0;
        await createItemPrice(liveItem.id, {
          variantId: priceLine.variantId ?? undefined,
          channel,
          priceMinor,
          currency,
          effectiveAt,
          reason,
        });
        if (effectiveAt) {
          setPending((current) => [
            ...current.filter((p) => !(p.variantId === priceLine.variantId && p.channel === channel)),
            { variantId: priceLine.variantId, channel, priceMinor, currency, effectiveAt },
          ]);
        } else {
          setCurrentPrices((current) => ({
            ...current,
            [priceLine.variantId ?? "base"]: {
              ...(current[priceLine.variantId ?? "base"] ?? { dineInPriceMinor: 0, deliveryPriceMinor: 0 }),
              ...(channel === "dine_in" ? { dineInPriceMinor: priceMinor } : { deliveryPriceMinor: priceMinor }),
            },
          }));
        }
      }
      setPriceLine(null);
    } catch (error) {
      setPriceError(error instanceof Error ? error.message : "That price change didn't save. Try again.");
    } finally {
      setPriceBusy(false);
    }
  }

  const outlet = outlets.find((o) => o.id === selectedOutletId);

  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/60" />
        <Dialog.Content
          data-testid="item-drawer"
          className="admin-theme fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col overflow-y-auto border-l border-border/60 bg-card text-foreground shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
            <Dialog.Title className="font-headline text-lg font-semibold">{isCreate ? "Add Item" : "Edit Item"}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                data-testid="item-drawer-close"
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 space-y-6 px-6 py-5">
            <div>
              <label htmlFor="item-name" className={LABEL_CLASS}>
                Name *
              </label>
              <input
                id="item-name"
                data-testid="item-name-input"
                value={draft.name}
                onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
                className={FIELD_CLASS}
              />
              {errors.name && (
                <p data-testid="item-name-error" className="mt-1 text-xs text-status-error">
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="item-short-name" className={LABEL_CLASS}>
                Kitchen ticket name *
              </label>
              <input
                id="item-short-name"
                data-testid="item-short-name-input"
                value={draft.shortName}
                onChange={(event) => setDraft((d) => ({ ...d, shortName: event.target.value }))}
                className={FIELD_CLASS}
              />
              {errors.shortName && (
                <p data-testid="item-short-name-error" className="mt-1 text-xs text-status-error">
                  {errors.shortName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="item-category" className={LABEL_CLASS}>
                Category
              </label>
              <select
                id="item-category"
                data-testid="item-category-select"
                value={draft.categoryId}
                onChange={(event) => setDraft((d) => ({ ...d, categoryId: event.target.value }))}
                className={FIELD_CLASS}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {!isCreate && liveItem && (
              <VariantsSection
                item={liveItem}
                currency={currency}
                currentPrices={currentPrices}
                pending={pending}
                onAddVariant={(name) => void handleAddVariant(name)}
                onRemoveVariant={(id) => void handleRemoveVariant(id)}
                onOpenPriceChange={setPriceLine}
              />
            )}

            <ModifierGroupsSection
              catalog={modifierGroupCatalog}
              selectedIds={selectedGroupIds}
              onToggle={(id) => void handleToggleModifierGroup(id)}
              onCreate={async (input) => {
                const created = await createModifierGroup(input);
                onModifierGroupCreated(created);
                await handleToggleModifierGroup(created.id);
              }}
            />

            <AllergensSection
              catalog={allergenCatalog}
              selectedIds={selectedAllergenIds}
              onToggle={(id) => void handleToggleAllergen(id)}
              onCreated={onAllergenCreated}
            />

            {!isCreate && liveItem && (
              <ComboSection
                item={liveItem}
                allItems={allItems}
                currency={currency}
                comboCatalog={comboCatalog}
                onComboCreated={onComboCreated}
              />
            )}

            {!isCreate && liveItem && outlet && (
              <OutletAvailabilitySection itemId={liveItem.id} outlet={outlet} />
            )}
          </div>

          <div className="border-t border-border/40 px-6 py-4">
            {saveError && (
              <p role="alert" data-testid="item-save-error" className="mb-3 text-sm text-status-error">
                {saveError}
              </p>
            )}
            <div className="flex justify-end">
              <Button data-testid="item-save" disabled={!canSave || saving} onClick={() => void handleSave()}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      {priceLine && liveItem && (
        <PriceChangeDialog
          open
          itemLabel={priceLine.label}
          currency={currency}
          current={currentPrices[priceLine.variantId ?? "base"] ?? { dineInPriceMinor: 0, deliveryPriceMinor: 0 }}
          busy={priceBusy}
          error={priceError}
          onCancel={() => {
            setPriceLine(null);
            setPriceError(null);
          }}
          onSubmit={(form) => void handlePriceSubmit(form)}
        />
      )}
    </Dialog.Root>
  );
}

function VariantsSection({
  item,
  currency,
  currentPrices,
  pending,
  onAddVariant,
  onRemoveVariant,
  onOpenPriceChange,
}: Readonly<{
  item: ItemView;
  currency: string;
  currentPrices: Record<string, { dineInPriceMinor: number; deliveryPriceMinor: number }>;
  pending: PendingPriceInfo[];
  onAddVariant: (name: string) => void;
  onRemoveVariant: (id: string) => void;
  onOpenPriceChange: (line: PriceLine) => void;
}>) {
  const [newVariantName, setNewVariantName] = useState("");

  return (
    <div data-testid="item-variants-section">
      <p className={LABEL_CLASS}>Variants &amp; Pricing</p>

      <PriceRow
        label={item.variants.length === 0 ? "Base price" : undefined}
        testId="item-base-price"
        currency={currency}
        current={currentPrices.base ?? { dineInPriceMinor: 0, deliveryPriceMinor: 0 }}
        pending={{
          dineIn: pendingChangeFor(pending, null, "dine_in"),
          delivery: pendingChangeFor(pending, null, "delivery"),
        }}
        onChange={() => onOpenPriceChange({ variantId: null, label: item.name })}
      />

      <ul className="mt-3 space-y-3">
        {item.variants.map((variant) => (
          <li key={variant.id} data-testid={`item-variant-${variant.id}`} className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{variant.name}</p>
              <button
                type="button"
                data-testid={`item-variant-${variant.id}-remove`}
                aria-label={`Remove ${variant.name}`}
                onClick={() => onRemoveVariant(variant.id)}
                className="rounded-md p-1 text-muted-foreground hover:text-status-error focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                ✕
              </button>
            </div>
            <PriceRow
              testId={`item-variant-${variant.id}-price`}
              currency={currency}
              current={currentPrices[variant.id] ?? { dineInPriceMinor: 0, deliveryPriceMinor: 0 }}
              pending={{
                dineIn: pendingChangeFor(pending, variant.id, "dine_in"),
                delivery: pendingChangeFor(pending, variant.id, "delivery"),
              }}
              onChange={() => onOpenPriceChange({ variantId: variant.id, label: variant.name })}
            />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <input
          data-testid="item-new-variant-name"
          value={newVariantName}
          placeholder="e.g. Half, Full"
          onChange={(event) => setNewVariantName(event.target.value)}
          className={`${FIELD_CLASS} flex-1`}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="item-add-variant"
          disabled={!newVariantName.trim()}
          onClick={() => {
            onAddVariant(newVariantName);
            setNewVariantName("");
          }}
        >
          + Add Variant
        </Button>
      </div>
    </div>
  );
}

function PriceRow({
  label,
  testId,
  currency,
  current,
  pending,
  onChange,
}: Readonly<{
  label?: string;
  testId: string;
  currency: string;
  current: { dineInPriceMinor: number; deliveryPriceMinor: number };
  pending: { dineIn: PendingPriceInfo | null; delivery: PendingPriceInfo | null };
  onChange: () => void;
}>) {
  return (
    <div className="mt-2">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <div className="flex items-center justify-between gap-2">
        <p data-testid={`${testId}-current`} className="text-sm tabular-nums">
          {CHANNEL_LABEL.dine_in} {formatPriceMinor(current.dineInPriceMinor, currency)} / {CHANNEL_LABEL.delivery}{" "}
          {formatPriceMinor(current.deliveryPriceMinor, currency)}
        </p>
        <button type="button" data-testid={`${testId}-change`} onClick={onChange} className="text-xs font-medium text-primary hover:underline">
          Change price
        </button>
      </div>
      {(pending.dineIn || pending.delivery) && (
        <p data-testid={`${testId}-pending`} className="text-xs text-status-scheduled">
          {pending.dineIn && `Dine-in changes to ${formatPriceMinor(pending.dineIn.priceMinor, currency)} on ${formatEffectiveDate(pending.dineIn.effectiveAt)}. `}
          {pending.delivery && `Delivery changes to ${formatPriceMinor(pending.delivery.priceMinor, currency)} on ${formatEffectiveDate(pending.delivery.effectiveAt)}.`}
        </p>
      )}
    </div>
  );
}

function ModifierGroupsSection({
  catalog,
  selectedIds,
  onToggle,
  onCreate,
}: Readonly<{
  catalog: ModifierGroupView[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onCreate: (input: { name: string; minSelections: number; maxSelections: number; modifiers: Array<{ name: string; priceMinor: number }> }) => Promise<void>;
}>) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(1);
  const [optionName, setOptionName] = useState("");
  const [options, setOptions] = useState<Array<{ name: string; priceMinor: number }>>([]);
  const draftGroup = { name, minSelections: min, maxSelections: max, modifiers: options.map((o, i) => ({ id: String(i), ...o })) };
  const draftErrors = validateModifierGroup(draftGroup);

  return (
    <div data-testid="item-modifier-groups-section">
      <div className="flex items-center justify-between">
        <p className={LABEL_CLASS}>Modifier Groups</p>
        {!creating && (
          <button type="button" data-testid="item-add-modifier-group" onClick={() => setCreating(true)} className="text-sm font-medium text-primary hover:underline">
            + Add modifier group
          </button>
        )}
      </div>

      <ul className="mt-2 space-y-1.5">
        {catalog.map((group) => {
          const active = selectedIds.includes(group.id);
          return (
            <li key={group.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid={`item-modifier-group-${group.id}-toggle`}
                  checked={active}
                  onChange={() => onToggle(group.id)}
                  className="accent-primary"
                />
                {group.name} <span className="text-xs text-muted-foreground">(pick {group.minSelections}-{group.maxSelections})</span>
              </label>
            </li>
          );
        })}
      </ul>

      {creating && (
        <div className="mt-2 space-y-2 rounded-lg border border-border/60 p-3">
          <input data-testid="new-modifier-group-name" value={name} placeholder="Group name (e.g. Spice Level)" onChange={(event) => setName(event.target.value)} className={FIELD_CLASS} />
          {draftErrors.name && <p className="text-xs text-status-error">{draftErrors.name}</p>}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">
              Minimum
              <input type="number" min="0" data-testid="new-modifier-group-min" value={min} onChange={(event) => setMin(Number(event.target.value))} className={`${FIELD_CLASS} mt-1`} />
              {draftErrors.min && (
                <span data-testid="new-modifier-group-min-error" className="mt-1 block text-status-error">
                  {draftErrors.min}
                </span>
              )}
            </label>
            <label className="text-xs text-muted-foreground">
              Maximum
              <input type="number" min="1" data-testid="new-modifier-group-max" value={max} onChange={(event) => setMax(Number(event.target.value))} className={`${FIELD_CLASS} mt-1`} />
              {draftErrors.max && (
                <span data-testid="new-modifier-group-max-error" className="mt-1 block text-status-error">
                  {draftErrors.max}
                </span>
              )}
            </label>
          </div>
          <div className="space-y-1">
            {options.map((option, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span>{option.name}</span>
                <button type="button" onClick={() => setOptions((current) => current.filter((_, i) => i !== index))} className="text-muted-foreground hover:text-status-error">
                  ✕
                </button>
              </div>
            ))}
            {draftErrors.options && (
              <p data-testid="new-modifier-group-options-error" className="text-xs text-status-error">
                {draftErrors.options}
              </p>
            )}
            <div className="flex gap-2">
              <input
                data-testid="new-modifier-group-option-name"
                value={optionName}
                placeholder="Option name"
                onChange={(event) => setOptionName(event.target.value)}
                className={`${FIELD_CLASS} flex-1`}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="new-modifier-group-add-option"
                disabled={!optionName.trim()}
                onClick={() => {
                  setOptions((current) => [...current, { name: optionName.trim(), priceMinor: 0 }]);
                  setOptionName("");
                }}
              >
                + Add option
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              data-testid="new-modifier-group-save"
              disabled={Object.keys(draftErrors).length > 0}
              onClick={() => {
                void onCreate({ name: name.trim(), minSelections: min, maxSelections: max, modifiers: options }).then(() => {
                  setCreating(false);
                  setName("");
                  setMin(0);
                  setMax(1);
                  setOptions([]);
                });
              }}
            >
              Create &amp; attach
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AllergensSection({
  catalog,
  selectedIds,
  onToggle,
  onCreated,
}: Readonly<{ catalog: AllergenView[]; selectedIds: string[]; onToggle: (id: string) => void; onCreated: (allergen: AllergenView) => void }>) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  return (
    <div data-testid="item-allergens-section">
      <p className={LABEL_CLASS}>Allergen &amp; dietary tags</p>
      <div className="flex flex-wrap gap-1.5">
        {catalog.map((allergen) => {
          const active = selectedIds.includes(allergen.id);
          return (
            <button
              key={allergen.id}
              type="button"
              data-testid={`item-allergen-${allergen.id}`}
              aria-pressed={active}
              onClick={() => onToggle(allergen.id)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                active ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {allergen.name}
            </button>
          );
        })}
      </div>
      {adding ? (
        <div className="mt-2 flex gap-2">
          <input data-testid="new-allergen-name" value={name} placeholder="e.g. Contains Peanuts" onChange={(event) => setName(event.target.value)} className={`${FIELD_CLASS} flex-1`} />
          <Button
            type="button"
            size="sm"
            data-testid="new-allergen-save"
            disabled={!name.trim()}
            onClick={async () => {
              const created = await createAllergen(name.trim());
              onCreated(created);
              setName("");
              setAdding(false);
            }}
          >
            Add
          </Button>
        </div>
      ) : (
        <button type="button" data-testid="item-add-allergen" onClick={() => setAdding(true)} className="mt-2 text-xs font-medium text-primary hover:underline">
          + New tag
        </button>
      )}
    </div>
  );
}

function ComboSection({
  item,
  allItems,
  currency,
  comboCatalog,
  onComboCreated,
}: Readonly<{ item: ItemView; allItems: ItemView[]; currency: string; comboCatalog: ComboView[]; onComboCreated: (combo: ComboView) => void }>) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([item.id]);
  const pickable = allItems.filter((candidate) => candidate.id !== item.id);
  const combos = combosForItem(comboCatalog, item.id);

  async function handleAdd() {
    if (!name.trim() || selectedItemIds.length === 0) return;
    const created = await createCombo({
      name: name.trim(),
      priceMinor: majorStringToPriceMinor(price) ?? 0,
      currency,
      components: selectedItemIds.map((itemId) => ({ itemId })),
    });
    onComboCreated(created);
    setName("");
    setPrice("");
    setSelectedItemIds([item.id]);
    setAdding(false);
  }

  return (
    <div data-testid="item-combos-section">
      <div className="flex items-center justify-between">
        <p className={LABEL_CLASS}>Combos</p>
        {!adding && (
          <button type="button" data-testid="item-add-combo" onClick={() => setAdding(true)} className="text-sm font-medium text-primary hover:underline">
            + Add combo
          </button>
        )}
      </div>

      <ul className="mt-2 space-y-2">
        {combos.map((combo) => (
          <li key={combo.id} data-testid={`item-combo-${combo.id}`} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
            {combo.name} - {formatPriceMinor(combo.priceMinor, combo.currency)} - {combo.components.length} item{combo.components.length === 1 ? "" : "s"}
          </li>
        ))}
      </ul>

      {adding && (
        <div className="mt-2 space-y-2 rounded-lg border border-border/60 p-3">
          <input data-testid="item-combo-name-input" value={name} placeholder="Combo name (e.g. Thali Combo)" onChange={(event) => setName(event.target.value)} className={FIELD_CLASS} />
          <input
            type="number"
            step="0.01"
            min="0"
            data-testid="item-combo-price-input"
            placeholder={`Combo price (${currency})`}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className={FIELD_CLASS}
          />
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {pickable.map((candidate) => (
              <label key={candidate.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  data-testid={`item-combo-pick-${candidate.id}`}
                  checked={selectedItemIds.includes(candidate.id)}
                  onChange={(event) =>
                    setSelectedItemIds((current) => (event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id)))
                  }
                />
                {candidate.name}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" data-testid="item-combo-cancel" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" data-testid="item-combo-confirm" disabled={!name.trim()} onClick={() => void handleAdd()}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OutletAvailabilitySection({ itemId, outlet }: Readonly<{ itemId: string; outlet: OutletView }>) {
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function set(available: boolean) {
    setStatus("saving");
    try {
      await setOutletAvailability(itemId, outlet.id, available);
      setMessage(available ? `Marked available at ${outlet.name}.` : `Marked unavailable at ${outlet.name}.`);
    } finally {
      setStatus("idle");
    }
  }

  async function clear() {
    setStatus("saving");
    try {
      await clearOutletAvailability(itemId, outlet.id);
      setMessage(`Override cleared - ${outlet.name} now follows the tenant-wide setting.`);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div data-testid="item-outlet-override-section" className="rounded-lg border border-border/60 p-3 text-sm">
      <p className="text-muted-foreground">Availability override for {outlet.name}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" data-testid="item-outlet-mark-available" disabled={status === "saving"} onClick={() => void set(true)}>
          Available here
        </Button>
        <Button type="button" variant="secondary" size="sm" data-testid="item-outlet-mark-unavailable" disabled={status === "saving"} onClick={() => void set(false)}>
          Unavailable here
        </Button>
        <Button type="button" variant="secondary" size="sm" data-testid="item-outlet-clear-override" disabled={status === "saving"} onClick={() => void clear()}>
          Clear override
        </Button>
      </div>
      {message && (
        <p data-testid="item-outlet-override-message" className="mt-2 text-xs text-status-active">
          {message}
        </p>
      )}
    </div>
  );
}
