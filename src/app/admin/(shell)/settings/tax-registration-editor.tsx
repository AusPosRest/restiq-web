"use client";

// Tax Registration settings screen (issue #140): country/registrationType
// are read-only (set at provisioning), registrationNumber/legalEntityName/
// taxProfile/fssaiLicense/compositionScheme are editable via a merge-PUT,
// same GET-then-PUT-merge form pattern as branding-editor.tsx. A 409 on Save
// means restiq-backend#108 found the new registrationNumber already used by
// another tenant - that's surfaced as a specific inline error on that field,
// not the generic error toast the rest of Save's failures use.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AdminApiError, updateTaxRegistration } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useToast } from "../toast";
import { useAdminLoad } from "../use-admin-load";
import {
  buildTaxRegistrationPatch,
  isRegistrationNumberValid,
  normalizeTaxRegistration,
  registrationTypeLabel,
  TaxRegistrationDraft,
  taxRegistrationEqual,
  TaxRegistrationView,
} from "./tax-registration-state";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const READONLY_FIELD_CLASS = "w-full rounded-lg border border-border/40 bg-accent/40 px-3 py-2 text-sm text-muted-foreground";

export function TaxRegistrationEditor() {
  const { loading, failed, data, retry } = useAdminLoad<TaxRegistrationView>("tax-registration");

  if (loading) {
    return (
      <div className="space-y-6 rounded-lg border border-border/40 bg-card p-6" data-testid="tax-registration-loading">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (failed) {
    return <LoadErrorPanel testId="tax-registration-load-error" message="Your tax registration couldn't be loaded." onRetry={retry} />;
  }

  // data is only ever null while loading/failed (see useAdminLoad) - both
  // handled above, so this mount always has a real response.
  return <TaxRegistrationForm initial={normalizeTaxRegistration(data)} />;
}

// Owns the editable draft, seeded once from the load that's already landed
// by the time this mounts - same "no effect needed" reasoning as
// branding-editor.tsx's BrandingForm.
function TaxRegistrationForm({ initial }: Readonly<{ initial: TaxRegistrationDraft }>) {
  const [draft, setDraft] = useState<TaxRegistrationDraft>(initial);
  const [saved, setSaved] = useState<TaxRegistrationDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [registrationNumberConflict, setRegistrationNumberConflict] = useState<string | null>(null);
  const pushToast = useToast();

  const dirty = !taxRegistrationEqual(draft, saved);
  const registrationNumberValid = isRegistrationNumberValid(draft);

  function updateField(patch: Partial<TaxRegistrationDraft>) {
    setRegistrationNumberConflict(null);
    setDraft((d) => ({ ...d, ...patch }));
  }

  async function handleSave() {
    setSaving(true);
    setRegistrationNumberConflict(null);
    try {
      const result = await updateTaxRegistration(buildTaxRegistrationPatch(draft));
      const normalized = normalizeTaxRegistration(result);
      setDraft(normalized);
      setSaved(normalized);
      pushToast({ kind: "success", message: "Tax registration saved." });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 409) {
        setRegistrationNumberConflict("Already used by another tenant");
      } else {
        pushToast({ kind: "error", message: "Couldn't save your tax registration. Try again.", onRetry: () => void handleSave() });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6 rounded-lg border border-border/40 bg-card p-6" data-testid="tax-registration-form">
      <h2 className="font-headline text-lg font-semibold">Tax Registration</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Country</span>
          <p data-testid="tax-registration-country" className={READONLY_FIELD_CLASS}>
            {draft.country}
          </p>
        </div>
        <div>
          <span className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registration Type</span>
          <p data-testid="tax-registration-type" className={READONLY_FIELD_CLASS}>
            {registrationTypeLabel(draft.registrationType)}
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="tax-registration-number" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {registrationTypeLabel(draft.registrationType)} Number
        </label>
        <input
          id="tax-registration-number"
          data-testid="tax-registration-number"
          type="text"
          value={draft.registrationNumber}
          onChange={(event) => updateField({ registrationNumber: event.target.value })}
          className={FIELD_CLASS}
        />
        {!registrationNumberValid && (
          <p role="alert" data-testid="tax-registration-number-required-error" className="mt-1 text-xs text-status-error">
            {registrationTypeLabel(draft.registrationType)} number is required.
          </p>
        )}
        {registrationNumberConflict && (
          <p role="alert" data-testid="tax-registration-number-conflict-error" className="mt-1 text-xs text-status-error">
            {registrationNumberConflict}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="tax-registration-legal-entity-name" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Legal Entity Name
        </label>
        <input
          id="tax-registration-legal-entity-name"
          data-testid="tax-registration-legal-entity-name"
          type="text"
          value={draft.legalEntityName}
          onChange={(event) => updateField({ legalEntityName: event.target.value })}
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label htmlFor="tax-registration-tax-profile" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tax Profile
        </label>
        <input
          id="tax-registration-tax-profile"
          data-testid="tax-registration-tax-profile"
          type="text"
          value={draft.taxProfile}
          onChange={(event) => updateField({ taxProfile: event.target.value })}
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label htmlFor="tax-registration-fssai-license" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          FSSAI License (optional)
        </label>
        <input
          id="tax-registration-fssai-license"
          data-testid="tax-registration-fssai-license"
          type="text"
          value={draft.fssaiLicense}
          onChange={(event) => updateField({ fssaiLicense: event.target.value })}
          className={FIELD_CLASS}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          data-testid="tax-registration-composition-scheme"
          checked={draft.compositionScheme}
          onChange={(event) => updateField({ compositionScheme: event.target.checked })}
          className="size-4 rounded border-border accent-primary focus-visible:ring-2 focus-visible:ring-ring"
        />
        Composition scheme
      </label>

      <div className="flex items-center justify-end border-t border-border/40 pt-4">
        <Button data-testid="tax-registration-save" disabled={!dirty || saving || !registrationNumberValid} onClick={() => void handleSave()}>
          {saving ? "Saving..." : "Save tax registration"}
        </Button>
      </div>
    </div>
  );
}
