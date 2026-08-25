"use client";

// P4 Modifier Selection (CAP-3). DESIGN.md's ModifierSheet: "bottom sheet,
// chip groups per modifier group, a visible min/max badge"; EXPERIENCE.md's
// Component Patterns: "the sheet's confirm button is disabled, not hidden,
// while a required group is unsatisfied, so the constraint is always
// visible." All selection/validation math lives in order-taking-state.ts
// (unit-tested there) - this component only renders it and reports the
// final selection back to the caller on confirm.
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  canConfirmSelection,
  computeUnitTotalMinor,
  emptyModifierSelection,
  formatPriceMinor,
  modifierGroupBadgeLabel,
  resolveSelectedModifiers,
  resolveUnitPriceMinor,
  toggleModifier,
  variantSatisfied,
  type ModifierSelection,
  type PosMenuItemView,
} from "./order-taking-state";

export interface ModifierSheetConfirmValue {
  variantId: string | null;
  modifierIds: string[];
  quantity: number;
  specialInstructions: string;
}

export interface ModifierSheetProps {
  item: PosMenuItemView;
  currency: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (value: ModifierSheetConfirmValue) => void;
}

export function ModifierSheet(props: Readonly<ModifierSheetProps>) {
  // Remount per item so a prior item's selection never leaks into the next.
  return <SheetBody key={props.item.id} {...props} />;
}

function SheetBody({ item, currency, busy, onCancel, onConfirm }: Readonly<ModifierSheetProps>) {
  const [variantId, setVariantId] = useState<string | null>(item.variants.length === 1 ? item.variants[0].id : null);
  const [selection, setSelection] = useState<ModifierSelection>(() => emptyModifierSelection(item));
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");

  const unitPriceMinor = resolveUnitPriceMinor(item, variantId);
  const selectedModifiers = resolveSelectedModifiers(item, selection);
  const unitTotalMinor = computeUnitTotalMinor(unitPriceMinor, selectedModifiers);
  const canConfirm = !busy && canConfirmSelection(item, selection, variantId);

  function setGroupSelection(groupId: string, ids: string[]) {
    setSelection((prev) => ({ ...prev, [groupId]: ids }));
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="modifier-sheet"
          className="pos-theme fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title data-testid="modifier-sheet-title" className="font-headline text-lg font-semibold">
              {item.name}
              {variantSatisfied(item, variantId) && (
                <span className="ml-2 font-normal text-muted-foreground">· {formatPriceMinor(unitPriceMinor, currency)}</span>
              )}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                data-testid="modifier-sheet-close"
                aria-label="Close"
                disabled={busy}
                onClick={onCancel}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 flex flex-col gap-6">
            {item.variants.length > 0 && (
              <div data-testid="modifier-sheet-variants" className="flex gap-2">
                {item.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    data-testid={`variant-chip-${variant.id}`}
                    aria-pressed={variantId === variant.id}
                    disabled={busy}
                    onClick={() => setVariantId(variant.id)}
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                      variantId === variant.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-transparent text-foreground hover:bg-accent"
                    }`}
                  >
                    {variant.name} {formatPriceMinor(variant.priceMinor, currency)}
                  </button>
                ))}
              </div>
            )}

            {item.modifierGroups.map((group) => {
              const selected = selection[group.id] ?? [];
              return (
                <fieldset key={group.id} data-testid={`modifier-group-${group.id}`} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <legend className="font-label text-sm font-semibold text-foreground">{group.name}</legend>
                    <span
                      data-testid={`modifier-group-badge-${group.id}`}
                      className={`font-label text-xs font-semibold uppercase tracking-wider ${
                        group.minSelections > 0 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {modifierGroupBadgeLabel(group)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.modifiers.map((modifier) => {
                      const isSelected = selected.includes(modifier.id);
                      return (
                        <button
                          key={modifier.id}
                          type="button"
                          data-testid={`modifier-chip-${modifier.id}`}
                          aria-pressed={isSelected}
                          disabled={busy}
                          onClick={() => setGroupSelection(group.id, toggleModifier(selected, modifier.id, group.maxSelections))}
                          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-transparent text-foreground hover:bg-accent"
                          }`}
                        >
                          {modifier.name}
                          {modifier.priceMinor > 0 && <span className="ml-1 opacity-80">+{formatPriceMinor(modifier.priceMinor, currency)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}

            <div>
              <label htmlFor="modifier-sheet-instructions" className="font-label mb-1.5 block text-sm font-semibold text-foreground">
                Special Instructions
              </label>
              <textarea
                id="modifier-sheet-instructions"
                data-testid="modifier-sheet-instructions"
                value={specialInstructions}
                rows={2}
                maxLength={500}
                disabled={busy}
                placeholder="e.g. less oil, extra crispy..."
                onChange={(event) => setSpecialInstructions(event.target.value)}
                className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <Button type="button" variant="outline" data-testid="modifier-sheet-cancel" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                <button
                  type="button"
                  data-testid="modifier-sheet-qty-decrement"
                  aria-label="Decrease quantity"
                  disabled={busy || quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="size-8 rounded-md text-lg font-semibold text-foreground hover:bg-accent disabled:opacity-40"
                >
                  −
                </button>
                <span data-testid="modifier-sheet-qty" className="w-6 text-center text-sm font-semibold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  data-testid="modifier-sheet-qty-increment"
                  aria-label="Increase quantity"
                  disabled={busy}
                  onClick={() => setQuantity((q) => q + 1)}
                  className="size-8 rounded-md text-lg font-semibold text-foreground hover:bg-accent"
                >
                  +
                </button>
              </div>
              <Button
                type="button"
                data-testid="modifier-sheet-confirm"
                disabled={!canConfirm}
                onClick={() =>
                  onConfirm({
                    variantId,
                    modifierIds: selectedModifiers.map((modifier) => modifier.id),
                    quantity,
                    specialInstructions: specialInstructions.trim(),
                  })
                }
              >
                {busy ? "Adding…" : `Add ${quantity} to Order · ${formatPriceMinor(unitTotalMinor * quantity, currency)}`}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
