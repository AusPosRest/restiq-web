"use client";

// Item editor drawer (EXPERIENCE.md Menu Management pattern): a drawer, not a
// full-page navigation, so the list stays visible behind it. Handles both
// create and edit. Field-by-field API shape verified against
// restiq-backend's actual admin/v1/menu working tree (see menu-state.ts's
// file header and api.ts's CAP-4 comment for what that means and its limits).
import { Trash2 } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  addVariant as apiAddVariant,
  createAllergen,
  createItemPrice,
  createMenuItem,
  createModifierGroup,
  CreateItemInput,
  deleteMenuItem,
  fetchFloorPlan,
  NewVariantInput,
  removeVariant as apiRemoveVariant,
  replaceItemAllergens,
  replaceItemModifierGroups,
  setItemStation,
  setOutletAvailability,
  clearOutletAvailability,
  updateMenuItem,
} from "../../api";
import type { StationView } from "../floor-plan/floor-plan-state";
import { itemDraftFromView, ItemDraft, priceError as priceInputError, toggleId, validateItemDraft, withName } from "./item-drawer-state";
import {
  AllergenView,
  CategoryView,
  formatEffectiveDate,
  formatPriceMinor,
  ItemView,
  majorStringToPriceMinor,
  ModifierGroupView,
  OutletView,
  PendingPriceInfo,
  pendingChangeFor,
  unsellableNote,
  validateModifierGroup,
  VegMarker,
} from "./menu-state";
import { PriceChangeDialog } from "./price-change-dialog";
import type { PriceScheduleForm } from "./price-schedule-state";
import { priceScheduleEffectiveAt } from "./price-schedule-state";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const LABEL_CLASS = "font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

// Item photo upload (issue #218). No object storage: the photo is shrunk in
// the browser to a small JPEG and stored inline as a data:image URL
// (restiq-backend#142 caps it at PHOTO_MAX_CHARS).
const PHOTO_MAX_PX = 480;
const PHOTO_MAX_CHARS = 280_000;

async function photoToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

interface PriceLine {
  variantId: string | null;
  label: string;
}

export interface ItemDrawerProps {
  open: boolean;
  item: ItemView | null;
  categories: CategoryView[];
  modifierGroupCatalog: ModifierGroupView[];
  allergenCatalog: AllergenView[];
  outlets: OutletView[];
  selectedOutletId: string | null;
  defaultCategoryId: string;
  currency: string;
  onClose: () => void;
  /** Called after the main Save and after every inline edit; the drawer stays open for inline edits. */
  onSaved: (item: ItemView) => void;
  /** Issue #248: called after the item is deleted (archived on the backend). */
  onDeleted?: (item: ItemView) => void;
  onModifierGroupCreated: (group: ModifierGroupView) => void;
  onAllergenCreated: (allergen: AllergenView) => void;
}

interface DraftVariant {
  name: string;
  price: string;
}

// The selected outlet's kitchen stations (PE-21), from the floor plan - the
// item's route; the same-named station is used at every other outlet.
function useStations(outletId: string | null): StationView[] {
  const [stations, setStations] = useState<StationView[]>([]);
  useEffect(() => {
    if (!outletId) return;
    let cancelled = false;
    fetchFloorPlan(outletId)
      .then((plan) => {
        if (!cancelled) setStations(plan.stations);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [outletId]);
  return stations;
}

export function ItemDrawer(props: Readonly<ItemDrawerProps>) {
  return props.open ? <DrawerBody key={props.item?.id ?? "new"} {...props} /> : null;
}

function DrawerBody({
  item,
  categories,
  modifierGroupCatalog,
  allergenCatalog,
  outlets,
  selectedOutletId,
  defaultCategoryId,
  currency,
  onClose,
  onSaved,
  onDeleted,
  onModifierGroupCreated,
  onAllergenCreated,
}: Readonly<ItemDrawerProps>) {
  const isCreate = item === null;
  const [draft, setDraft] = useState<ItemDraft>(() => itemDraftFromView(item, defaultCategoryId || categories[0]?.id || ""));
  const [createPriceMajor, setCreatePriceMajor] = useState("");
  const [liveItem, setLiveItem] = useState<ItemView | null>(item);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(item?.modifierGroups.map((g) => g.id) ?? []);
  const [selectedAllergenIds, setSelectedAllergenIds] = useState<string[]>(item?.allergens.map((a) => a.id) ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [priceLine, setPriceLine] = useState<PriceLine | null>(null);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPriceInfo[]>([]);
  // CU-1: the kitchen ticket name copies the name until edited; PE-13: errors wait until a field was left or Save was tried.
  const [shortNameEdited, setShortNameEdited] = useState(!isCreate);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const show = (field: string) => attempted || touched[field] === true;
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));
  // CU-1: portions (Half/Full) with their prices right on the Add form.
  const [newVariants, setNewVariants] = useState<DraftVariant[]>([]);
  const [stationId, setStationId] = useState(item?.stationId ?? "");
  const stations = useStations(selectedOutletId ?? outlets[0]?.id ?? null);

  const errors = validateItemDraft(draft);
  const createPriceError = isCreate && newVariants.length === 0 ? priceInputError(createPriceMajor) : undefined;
  const variantErrors = newVariants.map((v) => (!v.name.trim() ? "Name this portion." : priceInputError(v.price)));
  const createPriceMinor = isCreate && newVariants.length === 0 ? majorStringToPriceMinor(createPriceMajor) : null;
  const canSave = Object.keys(errors).length === 0 && !createPriceError && variantErrors.every((e) => !e);
  const priceOf = (variantId: string | null): number | null =>
    variantId === null ? (liveItem?.priceMinor ?? null) : (liveItem?.variants.find((v) => v.id === variantId)?.priceMinor ?? null);

  async function handleDelete() {
    if (!liveItem) return;
    setDeleting(true);
    setSaveError(null);
    try {
      await deleteMenuItem(liveItem.id);
      onDeleted?.(liveItem);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "That item couldn't be deleted. Try again.");
      setDeleting(false);
    }
  }

  async function handleSave() {
    setAttempted(true);
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (isCreate) {
        const input: CreateItemInput = {
          categoryId: draft.categoryId,
          name: draft.name,
          shortName: draft.shortName,
          ...(draft.vegMarker ? { vegMarker: draft.vegMarker } : {}),
          ...(stationId ? { stationId } : {}),
          ...(newVariants.length > 0
            ? { variants: newVariants.map((v) => ({ name: v.name.trim(), priceMinor: majorStringToPriceMinor(v.price) ?? 0, currency })) }
            : {}),
          modifierGroupIds: selectedGroupIds,
          allergenIds: selectedAllergenIds,
        };
        const created = await createMenuItem(input);
        if (createPriceMinor === null) {
          onSaved(created);
        } else {
          try {
            // Same client the price-change dialog uses (handlePriceSubmit below): no
            // variantId (base price), no channel (every channel), effective now.
            await createItemPrice(created.id, { priceMinor: createPriceMinor, currency, reason: "Initial price" });
            onSaved({ ...created, priceMinor: createPriceMinor, currency });
          } catch (error) {
            setSaveError(error instanceof Error ? error.message : "The item saved, but its price didn't - set it from the drawer.");
            onSaved(created);
          }
        }
      } else {
        const updated = await updateMenuItem(item!.id, {
          name: draft.name,
          shortName: draft.shortName,
          categoryId: draft.categoryId,
          vegMarker: draft.vegMarker || null,
        });
        setLiveItem(updated);
        onSaved(updated);
      }
      // Issue #333: only the main Save closes the drawer - inline edits (variants,
      // photo, ...) also call onSaved to refresh the list but keep it open.
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(file: File | undefined) {
    if (!liveItem || !file) return;
    setSaveError(null);
    if (!file.type.startsWith("image/")) {
      setSaveError("Choose an image file (JPEG, PNG or WebP).");
      return;
    }
    setPhotoBusy(true);
    try {
      const photoUrl = await photoToDataUrl(file);
      if (photoUrl.length > PHOTO_MAX_CHARS) {
        setSaveError("That photo is too large - try a smaller one.");
        return;
      }
      const updated = await updateMenuItem(liveItem.id, { photoUrl });
      setLiveItem(updated);
      onSaved(updated);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "That photo didn't upload. Try another one.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemovePhoto() {
    if (!liveItem) return;
    setPhotoBusy(true);
    try {
      const updated = await updateMenuItem(liveItem.id, { photoUrl: null });
      setLiveItem(updated);
      onSaved(updated);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "That photo couldn't be removed. Try again.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleAddVariant(input: NewVariantInput): Promise<boolean> {
    if (!liveItem) return false;
    try {
      const updated = await apiAddVariant(liveItem.id, { ...input, currency });
      setLiveItem(updated);
      onSaved(updated);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "That variant didn't save. Try again.");
      return false;
    }
  }

  async function handleStation(next: string) {
    const previous = stationId;
    setStationId(next);
    if (!liveItem) return;
    try {
      const updated = await setItemStation(liveItem.id, next || null);
      setLiveItem(updated);
      onSaved(updated);
    } catch (error) {
      setStationId(previous);
      setSaveError(error instanceof Error ? error.message : "That kitchen station didn't save. Try again.");
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
      const channel = "dine_in";
      const priceMinor = majorStringToPriceMinor(form.dineIn) ?? 0;
      // No channel: one price for dine-in, QR, takeaway and aggregator orders alike.
      await createItemPrice(liveItem.id, {
        variantId: priceLine.variantId ?? undefined,
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
        const variantId = priceLine.variantId;
        const updated: ItemView =
          variantId === null
            ? { ...liveItem, priceMinor, currency }
            : { ...liveItem, variants: liveItem.variants.map((v) => (v.id === variantId ? { ...v, priceMinor } : v)) };
        setLiveItem(updated);
        onSaved(updated);
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
          className="admin-theme fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col border-l border-border/60 bg-card text-foreground shadow-2xl"
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

          <div data-testid="item-drawer-body" className="scrollbar-visible min-h-0 flex-1 space-y-6 px-6 py-5">
            <div>
              <label htmlFor="item-name" className={LABEL_CLASS}>
                Name *
              </label>
              <input
                id="item-name"
                data-testid="item-name-input"
                value={draft.name}
                onChange={(event) => setDraft((d) => withName(d, event.target.value, shortNameEdited))}
                onBlur={() => touch("name")}
                className={FIELD_CLASS}
              />
              {errors.name && show("name") && (
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
                onChange={(event) => {
                  setShortNameEdited(true);
                  setDraft((d) => ({ ...d, shortName: event.target.value }));
                }}
                onBlur={() => touch("shortName")}
                className={FIELD_CLASS}
              />
              <p className="mt-1 text-xs text-muted-foreground">Printed on kitchen tickets. Starts as the item name.</p>
              {errors.shortName && show("shortName") && (
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="item-veg-marker" className={LABEL_CLASS}>
                  Veg / non-veg
                </label>
                <select
                  id="item-veg-marker"
                  data-testid="item-veg-marker-select"
                  value={draft.vegMarker}
                  onChange={(event) => setDraft((d) => ({ ...d, vegMarker: event.target.value as VegMarker | "" }))}
                  className={FIELD_CLASS}
                >
                  <option value="">Not marked</option>
                  <option value="veg">Veg</option>
                  <option value="non_veg">Non-veg</option>
                </select>
              </div>
              {stations.length > 0 && (
                <div>
                  <label htmlFor="item-station" className={LABEL_CLASS}>
                    Kitchen station
                  </label>
                  <select
                    id="item-station"
                    data-testid="item-station-select"
                    value={stationId}
                    onChange={(event) => void handleStation(event.target.value)}
                    className={FIELD_CLASS}
                  >
                    <option value="">{`${stations[0]?.name ?? "First station"} (default)`}</option>
                    {stations.map((station) => (
                      <option key={station.id} value={station.id}>
                        {station.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {isCreate && newVariants.length === 0 && (
              <div>
                <label htmlFor="item-create-price" className={LABEL_CLASS}>
                  Price ({currency}) *
                </label>
                <input
                  id="item-create-price"
                  data-testid="item-create-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={createPriceMajor}
                  onChange={(event) => setCreatePriceMajor(event.target.value)}
                  onBlur={() => touch("price")}
                  className={FIELD_CLASS}
                />
                {createPriceError && show("price") && (
                  <p data-testid="item-create-price-error" className="mt-1 text-xs text-status-error">
                    {createPriceError}
                  </p>
                )}
              </div>
            )}

            {isCreate && (
              <div data-testid="item-create-variants">
                <p className={LABEL_CLASS}>Portions (optional)</p>
                <p className="text-xs text-muted-foreground">Sell it as Half / Full or Small / Large, each with its own price.</p>
                <ul className="mt-2 space-y-2">
                  {newVariants.map((variant, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="flex-1">
                        <input
                          aria-label={`Portion ${index + 1} name`}
                          data-testid={`item-create-variant-${index}-name`}
                          placeholder="e.g. Half"
                          value={variant.name}
                          onChange={(event) => setNewVariants((vs) => vs.map((v, i) => (i === index ? { ...v, name: event.target.value } : v)))}
                          className={FIELD_CLASS}
                        />
                      </div>
                      <div className="w-28">
                        <input
                          aria-label={`Portion ${index + 1} price (${currency})`}
                          data-testid={`item-create-variant-${index}-price`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Price"
                          value={variant.price}
                          onChange={(event) => setNewVariants((vs) => vs.map((v, i) => (i === index ? { ...v, price: event.target.value } : v)))}
                          className={FIELD_CLASS}
                        />
                      </div>
                      <button
                        type="button"
                        data-testid={`item-create-variant-${index}-remove`}
                        aria-label={`Remove portion ${index + 1}`}
                        onClick={() => setNewVariants((vs) => vs.filter((_, i) => i !== index))}
                        className="rounded-md p-2 text-muted-foreground hover:text-status-error focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        ✕
                      </button>
                      {attempted && variantErrors[index] && (
                        <p data-testid={`item-create-variant-${index}-error`} className="sr-only" role="alert">
                          {variantErrors[index]}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                {attempted && variantErrors.some(Boolean) && (
                  <p data-testid="item-create-variants-error" className="mt-1 text-xs text-status-error">
                    Give every portion a name and a price.
                  </p>
                )}
                <button
                  type="button"
                  data-testid="item-create-add-variant"
                  onClick={() => setNewVariants((vs) => [...vs, { name: "", price: vs.length === 0 ? createPriceMajor : "" }])}
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                  + Add portion
                </button>
              </div>
            )}

            {!isCreate && liveItem && (
              <div data-testid="item-photo-section">
                <p className={LABEL_CLASS}>Photo</p>
                <div className="flex items-center gap-4">
                  <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted text-xs text-muted-foreground">
                    {liveItem.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- an https or data: URL, not something next/image's optimizer can handle
                      <img data-testid="item-photo-preview" src={liveItem.photoUrl} alt={`${liveItem.name} photo`} className="size-full object-cover" />
                    ) : (
                      "No photo"
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    <label className="cursor-pointer rounded-md border border-border/60 px-3 py-1.5 text-sm font-medium hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
                      {photoBusy ? "Uploading…" : liveItem.photoUrl ? "Replace photo" : "Upload photo"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        data-testid="item-photo-input"
                        disabled={photoBusy}
                        className="sr-only"
                        onChange={(event) => {
                          void handlePhoto(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {liveItem.photoUrl && (
                      <button
                        type="button"
                        data-testid="item-photo-remove"
                        disabled={photoBusy}
                        onClick={() => void handleRemovePhoto()}
                        className="text-xs font-medium text-muted-foreground hover:text-status-error focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Remove photo
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">Shown on the QR menu and the kiosk.</p>
                  </div>
                </div>
              </div>
            )}

            {!isCreate && liveItem && (
              <VariantsSection
                item={liveItem}
                currency={currency}
                pending={pending}
                onAddVariant={handleAddVariant}
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
            {confirmingDelete && liveItem && (
              <div data-testid="item-delete-confirm" role="alert" className="mb-3 rounded-lg border border-status-error/40 p-3 text-sm">
                <p>
                  Delete <strong>{liveItem.name}</strong>? It disappears from the menu, POS, QR and kiosk. Past bills keep it.
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="secondary" size="sm" data-testid="item-delete-cancel" disabled={deleting} onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" data-testid="item-delete-confirm-button" disabled={deleting} onClick={() => void handleDelete()}>
                    {deleting ? "Deleting..." : "Delete item"}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              {!isCreate && liveItem && !confirmingDelete ? (
                <Button variant="secondary" data-testid="item-delete" className="text-status-error" onClick={() => setConfirmingDelete(true)}>
                  <Trash2 aria-hidden="true" /> Delete
                </Button>
              ) : (
                <span />
              )}
              <Button data-testid="item-save" disabled={saving || deleting} onClick={() => void handleSave()}>
                {saving ? "Saving..." : isCreate ? "Add item" : "Save changes"}
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
          current={priceOf(priceLine.variantId) ?? 0}
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
  pending,
  onAddVariant,
  onRemoveVariant,
  onOpenPriceChange,
}: Readonly<{
  item: ItemView;
  currency: string;
  pending: PendingPriceInfo[];
  onAddVariant: (input: NewVariantInput) => Promise<boolean>;
  onRemoveVariant: (id: string) => void;
  onOpenPriceChange: (line: PriceLine) => void;
}>) {
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState("");
  const [basePortionName, setBasePortionName] = useState("Regular");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasVariants = item.variants.length > 0;
  // PE-15: an item's first variant keeps its current price on sale as a named portion.
  const keepsBase = !hasVariants && item.priceMinor !== null;
  const newPriceError = priceInputError(newVariantPrice);
  const note = unsellableNote(item);

  async function add() {
    setTried(true);
    if (!newVariantName.trim() || newPriceError) return;
    setBusy(true);
    const saved = await onAddVariant({
      name: newVariantName.trim(),
      priceMinor: majorStringToPriceMinor(newVariantPrice) ?? 0,
      ...(keepsBase ? { basePortionName: basePortionName.trim() || "Regular" } : {}),
    });
    setBusy(false);
    if (saved) {
      setNewVariantName("");
      setNewVariantPrice("");
      setTried(false);
    }
  }

  return (
    <div data-testid="item-variants-section">
      <p className={LABEL_CLASS}>{hasVariants ? "Portions & prices" : "Price"}</p>
      {note && (
        <p data-testid="item-unsellable-note" role="status" className="mb-2 text-xs text-status-warning">
          {note}
        </p>
      )}

      {/* CU-1: once an item has portions, only their prices are used - the old base price is not shown. */}
      {!hasVariants && (
        <PriceRow
          testId="item-base-price"
          currency={currency}
          current={item.priceMinor}
          pending={pendingChangeFor(pending, null, "dine_in")}
          onChange={() => onOpenPriceChange({ variantId: null, label: item.name })}
        />
      )}

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
              current={variant.priceMinor}
              pending={pendingChangeFor(pending, variant.id, "dine_in")}
              onChange={() => onOpenPriceChange({ variantId: variant.id, label: variant.name })}
            />
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-lg border border-dashed border-border/60 p-3">
        <p className="text-xs font-medium text-muted-foreground">Add a portion (e.g. Half, Full)</p>
        {keepsBase && (
          <div className="mt-2">
            <label htmlFor="item-base-portion-name" className="text-xs text-muted-foreground">
              Name for the current {formatPriceMinor(item.priceMinor ?? 0, currency)} portion
            </label>
            <input
              id="item-base-portion-name"
              data-testid="item-base-portion-name"
              value={basePortionName}
              onChange={(event) => setBasePortionName(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>
        )}
        <div className="mt-2 flex items-start gap-2">
          <input
            aria-label="New portion name"
            data-testid="item-new-variant-name"
            value={newVariantName}
            placeholder="e.g. Half"
            onChange={(event) => setNewVariantName(event.target.value)}
            className={`${FIELD_CLASS} flex-1`}
          />
          <input
            aria-label={`New portion price (${currency})`}
            data-testid="item-new-variant-price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
            value={newVariantPrice}
            onChange={(event) => setNewVariantPrice(event.target.value)}
            className={`${FIELD_CLASS} w-28`}
          />
          <Button type="button" variant="secondary" size="sm" data-testid="item-add-variant" disabled={!newVariantName.trim() || busy} onClick={() => void add()}>
            + Add
          </Button>
        </div>
        {tried && newPriceError && (
          <p data-testid="item-new-variant-price-error" className="mt-1 text-xs text-status-error">
            {newPriceError}
          </p>
        )}
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
  current: number | null;
  pending: PendingPriceInfo | null;
  onChange: () => void;
}>) {
  return (
    <div className="mt-2">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <div className="flex items-center justify-between gap-2">
        <p data-testid={`${testId}-current`} className={`text-sm tabular-nums ${current === null ? "text-status-warning" : ""}`}>
          {current === null ? "No price yet" : formatPriceMinor(current, currency)}
        </p>
        <button type="button" data-testid={`${testId}-change`} onClick={onChange} className="text-xs font-medium text-primary hover:underline">
          {current === null ? "Set price" : "Change price"}
        </button>
      </div>
      {pending && (
        <p data-testid={`${testId}-pending`} className="text-xs text-status-scheduled">
          Changes to {formatPriceMinor(pending.priceMinor, currency)} on {formatEffectiveDate(pending.effectiveAt)}.
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
