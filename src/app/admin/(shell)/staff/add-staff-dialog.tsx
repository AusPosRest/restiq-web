"use client";

// "Add staff" (T7): name, email and a role dropdown constrained to the
// tenant's seeded roles - the closed set is enforced by construction (the
// <select> only ever has the fetched roles as options, never free text).
// Routine, not security-relevant on its own (SPEC only calls out role
// *change* and PIN revoke as audit-reason actions) - optimistic-style single
// submit, no reason prompt, matching EXPERIENCE.md's "routine content edits"
// bucket.
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EMPTY_ADD_STAFF_FORM, validateAddStaffForm, type AddStaffForm, type RoleView } from "./staff-state";

const INPUT_CLASSES =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const SELECT_CLASSES = `${INPUT_CLASSES} h-10`;

export interface AddStaffDialogProps {
  open: boolean;
  roles: readonly RoleView[];
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (form: AddStaffForm) => void;
}

export function AddStaffDialog(props: Readonly<AddStaffDialogProps>) {
  return props.open ? <DialogBody key="open" {...props} /> : null;
}

function DialogBody({ roles, busy, error, onCancel, onSubmit }: Readonly<AddStaffDialogProps>) {
  const [form, setForm] = useState<AddStaffForm>(EMPTY_ADD_STAFF_FORM);
  const [touched, setTouched] = useState(false);
  const errors = validateAddStaffForm(form, roles);

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="add-staff-dialog"
          className="admin-theme fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <Dialog.Title className="font-headline text-lg font-semibold">Add staff</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            They&apos;ll get access to the till once you issue them a PIN.
          </Dialog.Description>

          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setTouched(true);
              if (Object.keys(errors).length === 0 && !busy) onSubmit(form);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="add-staff-first-name" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  First name
                </label>
                <input
                  id="add-staff-first-name"
                  data-testid="add-staff-first-name"
                  value={form.firstName}
                  onChange={(event) => setForm((f) => ({ ...f, firstName: event.target.value }))}
                  className={INPUT_CLASSES}
                />
                {touched && errors.firstName && (
                  <p data-testid="add-staff-first-name-error" className="mt-1 text-xs text-status-error">
                    {errors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="add-staff-last-name" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Last name
                </label>
                <input
                  id="add-staff-last-name"
                  data-testid="add-staff-last-name"
                  value={form.lastName}
                  onChange={(event) => setForm((f) => ({ ...f, lastName: event.target.value }))}
                  className={INPUT_CLASSES}
                />
                {touched && errors.lastName && (
                  <p data-testid="add-staff-last-name-error" className="mt-1 text-xs text-status-error">
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="add-staff-email" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <input
                id="add-staff-email"
                type="email"
                data-testid="add-staff-email"
                value={form.email}
                onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
                className={INPUT_CLASSES}
              />
              {touched && errors.email && (
                <p data-testid="add-staff-email-error" className="mt-1 text-xs text-status-error">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="add-staff-role" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                System Role
              </label>
              <select
                id="add-staff-role"
                data-testid="add-staff-role"
                value={form.roleId}
                onChange={(event) => setForm((f) => ({ ...f, roleId: event.target.value }))}
                className={SELECT_CLASSES}
              >
                <option value="">Choose a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {touched && errors.roleId && (
                <p data-testid="add-staff-role-error" className="mt-1 text-xs text-status-error">
                  {errors.roleId}
                </p>
              )}
            </div>

            {error && (
              <p role="alert" data-testid="add-staff-error" className="text-sm text-status-error">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" data-testid="add-staff-cancel" disabled={busy} onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" data-testid="add-staff-submit" disabled={busy}>
                {busy ? "Adding..." : "Add staff"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
