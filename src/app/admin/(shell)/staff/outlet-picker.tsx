"use client";

// restiq-backend#197: which outlets a staff member may sign in at. "Every
// outlet" (an empty list) also covers outlets added later; unticking it
// starts from all of today's outlets so the owner removes the ones they don't work.
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface OutletOption {
  id: string;
  name: string;
}

export function OutletPicker({
  outlets,
  value,
  onChange,
  idPrefix,
}: Readonly<{ outlets: readonly OutletOption[]; value: readonly string[]; onChange: (next: string[]) => void; idPrefix: string }>) {
  const every = value.length === 0;
  return (
    <fieldset className="space-y-2" data-testid={`${idPrefix}-outlets`}>
      <legend className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Works at</legend>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          data-testid={`${idPrefix}-outlets-every`}
          checked={every}
          onChange={(event) => onChange(event.target.checked ? [] : outlets.map((outlet) => outlet.id))}
        />
        Every outlet, including new ones
      </label>
      {!every && (
        <div className="ml-6 space-y-1.5">
          {outlets.map((outlet) => (
            <label key={outlet.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid={`${idPrefix}-outlet-${outlet.id}`}
                checked={value.includes(outlet.id)}
                onChange={(event) => onChange(event.target.checked ? [...value, outlet.id] : value.filter((id) => id !== outlet.id))}
              />
              {outlet.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function StaffOutletsDialog({
  name,
  outlets,
  initial,
  busy,
  onCancel,
  onSave,
}: Readonly<{ name: string; outlets: readonly OutletOption[]; initial: readonly string[]; busy: boolean; onCancel: () => void; onSave: (outletIds: string[]) => void }>) {
  const [value, setValue] = useState<string[]>([...initial]);
  return (
    <Dialog.Root open onOpenChange={(next) => !next && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="staff-outlets-dialog"
          className="admin-theme fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <Dialog.Title className="font-headline text-lg font-semibold">Where does {name} work?</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Their PIN only works at these outlets. Saving signs them out of any till they&apos;re on.
          </Dialog.Description>
          <div className="mt-4">
            <OutletPicker outlets={outlets} value={value} onChange={setValue} idPrefix="staff-outlets-dialog" />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" data-testid="staff-outlets-cancel" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" data-testid="staff-outlets-save" disabled={busy} onClick={() => onSave(value)}>
              {busy ? "Saving..." : "Save"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
