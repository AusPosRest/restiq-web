"use client";

// Combo picker sheet (restiq-web#264), shared by the POS order / counter
// screens and the guest QR / kiosk menu. One section per slot: fixed slots
// show as "Included", choice slots take taps (a pick-1 slot swaps, a pick-N
// slot counts up), and a picked item with modifier groups shows its chips.
// The Add button stays disabled until every slot is filled.
import { Check, Minus } from "lucide-react";
import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  canAddCombo,
  changePick,
  type ComboItemInfo,
  type ComboMenuView,
  type ComboSelection,
  comboUnitPriceMinor,
  initialPicks,
  isFixedSlot,
  slotCount,
  toggleGroupModifier,
  toSelections,
} from "@/lib/combo";

export interface ComboPickerConfirmValue {
  selections: ComboSelection[];
  quantity: number;
}

export function ComboPicker({
  combo,
  itemsById,
  formatPrice,
  themeClass,
  busy,
  confirmLabel = "Add to order",
  onCancel,
  onConfirm,
}: Readonly<{
  combo: ComboMenuView;
  itemsById: ReadonlyMap<string, ComboItemInfo>;
  formatPrice: (minor: number) => string;
  /** The realm's theme class (pos-theme, qr-theme): the sheet portals outside the page wrapper. */
  themeClass: string;
  busy: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: ComboPickerConfirmValue) => void;
}>) {
  const [picks, setPicks] = useState(() => initialPicks(combo));
  const [quantity, setQuantity] = useState(1);
  const choiceSlots = combo.slots.filter((s) => !isFixedSlot(s));
  const ready = canAddCombo(combo, picks, itemsById);
  const unitMinor = useMemo(() => comboUnitPriceMinor(combo, picks, itemsById), [combo, picks, itemsById]);

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="combo-picker"
          aria-describedby={undefined}
          className={`${themeClass} fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90vh] max-w-2xl flex-col rounded-t-2xl border-t border-border/60 bg-popover text-foreground shadow-xl`}
        >
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6">
            <div>
              <Dialog.Title data-testid="combo-picker-title" className="font-headline text-lg font-semibold">
                {combo.name} <span className="font-normal text-muted-foreground">· {formatPrice(combo.priceMinor)}</span>
              </Dialog.Title>
              {choiceSlots.length > 0 && (
                <div className="mt-2 flex gap-1" aria-hidden="true">
                  {choiceSlots.map((slot) => (
                    <span key={slot.id} className={`h-1 w-10 rounded-full ${slotCount(slot, picks) === slot.pickCount ? "bg-primary" : "bg-border"}`} />
                  ))}
                </div>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                data-testid="combo-picker-close"
                aria-label="Close"
                disabled={busy}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-4 sm:px-6">
            {combo.slots.map((slot) => {
              const count = slotCount(slot, picks);
              if (isFixedSlot(slot)) {
                const option = slot.options[0];
                return (
                  <section key={slot.id} data-testid={`combo-picker-slot-${slot.id}`} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-label font-semibold">{slot.name}</span>
                    <span className="text-muted-foreground">
                      Included: {slot.pickCount > 1 ? `${slot.pickCount}× ` : ""}
                      {option.itemName}
                    </span>
                  </section>
                );
              }
              return (
                <section key={slot.id} data-testid={`combo-picker-slot-${slot.id}`} aria-label={slot.name}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h3 className="font-label text-sm font-semibold">{slot.name}</h3>
                    <span className={`font-label text-xs font-semibold uppercase tracking-wider ${count === slot.pickCount ? "text-primary" : "text-muted-foreground"}`}>
                      {count === slot.pickCount ? (
                        <>
                          <Check className="-mt-0.5 mr-1 inline size-3.5" aria-hidden="true" />
                          Done
                        </>
                      ) : (
                        `Choose ${slot.pickCount}${slot.pickCount > 1 ? ` · ${count} picked` : ""}`
                      )}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {slot.options.map((option) => {
                      const picked = picks[option.id]?.quantity ?? 0;
                      return (
                        <span key={option.id} className="inline-flex">
                          <button
                            type="button"
                            data-testid={`combo-option-${option.id}`}
                            aria-pressed={picked > 0}
                            disabled={busy || !option.available}
                            onClick={() => setPicks((p) => changePick(slot, p, option.id, 1))}
                            className={`border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${picked > 0 && slot.pickCount > 1 ? "rounded-l-full" : "rounded-full"} ${
                              picked > 0 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-transparent text-foreground hover:bg-accent"
                            }`}
                          >
                            {slot.pickCount > 1 && picked > 0 && <span className="mr-1 tabular-nums">{picked}×</span>}
                            {option.itemName}
                            {option.variantName && <span className="opacity-80"> ({option.variantName})</span>}
                            {option.upchargeMinor > 0 && <span className="ml-1 opacity-80">+{formatPrice(option.upchargeMinor)}</span>}
                            {!option.available && <span className="ml-1">· Sold out</span>}
                          </button>
                          {slot.pickCount > 1 && picked > 0 && (
                            <button
                              type="button"
                              aria-label={`One less ${option.itemName}`}
                              data-testid={`combo-option-less-${option.id}`}
                              disabled={busy}
                              onClick={() => setPicks((p) => changePick(slot, p, option.id, -1))}
                              className="rounded-r-full border border-l-0 border-primary bg-primary px-2 text-primary-foreground hover:opacity-90"
                            >
                              <Minus className="size-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  {slot.options
                    .filter((o) => (picks[o.id]?.quantity ?? 0) > 0)
                    .flatMap((option) =>
                      (itemsById.get(option.itemId)?.modifierGroups ?? []).map((group) => (
                        <fieldset key={`${option.id}-${group.id}`} className="mt-3 rounded-lg border border-border/60 p-3" data-testid={`combo-modifiers-${option.id}-${group.id}`}>
                          <legend className="px-1 text-xs font-semibold text-muted-foreground">
                            {option.itemName}: {group.name}
                            {group.minSelections > 0 ? " · required" : ""}
                          </legend>
                          <div className="flex flex-wrap gap-2">
                            {group.modifiers.map((modifier) => {
                              const on = picks[option.id]?.modifierIds.includes(modifier.id) ?? false;
                              return (
                                <button
                                  key={modifier.id}
                                  type="button"
                                  data-testid={`combo-modifier-${option.id}-${modifier.id}`}
                                  aria-pressed={on}
                                  disabled={busy}
                                  onClick={() => setPicks((p) => toggleGroupModifier(p, option.id, group, modifier.id))}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`}
                                >
                                  {modifier.name}
                                  {modifier.priceMinor > 0 && <span className="ml-1 opacity-80">+{formatPrice(modifier.priceMinor)}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      )),
                    )}
                </section>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
              <button
                type="button"
                data-testid="combo-picker-qty-decrement"
                aria-label="Decrease quantity"
                disabled={busy || quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="size-8 rounded-md text-lg font-semibold hover:bg-accent disabled:opacity-40"
              >
                −
              </button>
              <span data-testid="combo-picker-qty" className="w-6 text-center text-sm font-semibold tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                data-testid="combo-picker-qty-increment"
                aria-label="Increase quantity"
                disabled={busy}
                onClick={() => setQuantity((q) => q + 1)}
                className="size-8 rounded-md text-lg font-semibold hover:bg-accent"
              >
                +
              </button>
            </div>
            <Button
              type="button"
              data-testid="combo-picker-confirm"
              disabled={!ready || busy}
              onClick={() => onConfirm({ selections: toSelections(combo, picks), quantity })}
            >
              {busy ? "Adding…" : ready ? `${confirmLabel} · ${formatPrice(unitMinor * quantity)}` : "Choose every item"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
