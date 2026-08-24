"use client";

// "Schedule a price change" (EXPERIENCE.md Menu Management pattern): shows
// the current price, and a schedule option that never overwrites it in
// place. Pessimistic with a required reason (SPEC: price changes are
// security-relevant, audited with actor + reason).
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPriceMinor } from "./menu-state";
import {
  initialPriceScheduleForm,
  PriceScheduleForm,
  PriceScheduleMode,
  validatePriceScheduleForm,
} from "./price-schedule-state";

export interface PriceChangeDialogProps {
  open: boolean;
  itemLabel: string;
  currency: string;
  current: { dineInPriceMinor: number; deliveryPriceMinor: number };
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (form: PriceScheduleForm) => void;
}

export function PriceChangeDialog(props: Readonly<PriceChangeDialogProps>) {
  return props.open ? <DialogBody key={props.itemLabel} {...props} /> : null;
}

function DialogBody({ itemLabel, currency, current, busy, error, onCancel, onSubmit }: Readonly<PriceChangeDialogProps>) {
  const [form, setForm] = useState<PriceScheduleForm>(() => initialPriceScheduleForm(current));
  const errors = validatePriceScheduleForm(form, new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="price-change-dialog"
          className="admin-theme fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <Dialog.Title className="font-headline text-lg font-semibold">Change {itemLabel}&apos;s price</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Current: {formatPriceMinor(current.dineInPriceMinor, currency)} dine-in / {formatPriceMinor(current.deliveryPriceMinor, currency)}{" "}
            delivery. This never overwrites that price - it creates a new version.
          </Dialog.Description>

          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (Object.keys(errors).length === 0 && !busy) onSubmit(form);
            }}
          >
            <fieldset className="flex gap-4 text-sm" data-testid="price-change-mode">
              {(["today", "schedule"] as PriceScheduleMode[]).map((mode) => (
                <label key={mode} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="price-change-mode"
                    value={mode}
                    checked={form.mode === mode}
                    onChange={() => setForm((f) => ({ ...f, mode }))}
                    className="accent-primary"
                  />
                  {mode === "today" ? "Effective today" : "Schedule for a date"}
                </label>
              ))}
            </fieldset>

            {form.mode === "schedule" && (
              <div>
                <label htmlFor="price-change-date" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Effective date
                </label>
                <input
                  id="price-change-date"
                  data-testid="price-change-date"
                  type="date"
                  min={minDate}
                  value={form.effectiveDate}
                  onChange={(event) => setForm((f) => ({ ...f, effectiveDate: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {errors.effectiveDate && (
                  <p data-testid="price-change-date-error" className="mt-1 text-xs text-status-error">
                    {errors.effectiveDate}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="price-change-dinein" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Dine-in ({currency})
                </label>
                <input
                  id="price-change-dinein"
                  data-testid="price-change-dinein"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.dineIn}
                  onChange={(event) => setForm((f) => ({ ...f, dineIn: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm tabular-nums text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {errors.dineIn && (
                  <p data-testid="price-change-dinein-error" className="mt-1 text-xs text-status-error">
                    {errors.dineIn}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="price-change-delivery" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Delivery ({currency})
                </label>
                <input
                  id="price-change-delivery"
                  data-testid="price-change-delivery"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.delivery}
                  onChange={(event) => setForm((f) => ({ ...f, delivery: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm tabular-nums text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {errors.delivery && (
                  <p data-testid="price-change-delivery-error" className="mt-1 text-xs text-status-error">
                    {errors.delivery}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="price-change-reason" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Why is this changing? (kept in the audit trail)
              </label>
              <textarea
                id="price-change-reason"
                data-testid="price-change-reason"
                rows={2}
                maxLength={500}
                placeholder="e.g. Supplier cost increase"
                value={form.reason}
                onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))}
                className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {error && (
              <p role="alert" data-testid="price-change-error" className="text-sm text-status-error">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" data-testid="price-change-cancel" disabled={busy} onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" data-testid="price-change-submit" disabled={Object.keys(errors).length > 0 || busy}>
                {busy ? "Saving..." : form.mode === "today" ? "Save new price" : "Schedule price change"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
