"use client";

// Outlet tab (issue #329): the owner edits the selected outlet's name,
// address and timezone via PATCH /admin/v1/outlets/:outletId. Outlet type is
// read-only (set at provisioning). Same GET-already-in-context /
// dirty-tracked-draft / merge-PATCH shape as tax-registration-editor.tsx,
// except there's no separate GET here - the outlet switcher's own load
// already has every field this form needs.
import { useState } from "react";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminApiError, updateOutlet, type UpdateOutletInput } from "../../api";
import type { OutletType, OutletView } from "../menu/menu-state";
import { Skeleton } from "../data-states";
import { useOutlets } from "../outlet-context";
import { useToast } from "../toast";

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const READONLY_FIELD_CLASS = "w-full rounded-lg border border-border/40 bg-accent/40 px-3 py-2 text-sm text-muted-foreground";
const LABEL_CLASS = "font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

const TIMEZONES = Intl.supportedValuesOf("timeZone");

const OUTLET_TYPE_LABELS: Record<OutletType, string> = {
  dine_in: "Dine-in",
  qsr: "QSR",
  cloud_kitchen: "Cloud Kitchen",
  food_court: "Food Court",
};

function LoadingRows() {
  return (
    <div className="max-w-2xl space-y-6 rounded-lg border border-border/40 bg-card p-6" data-testid="outlet-details-loading">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-40" />
    </div>
  );
}

export function OutletDetailsEditor() {
  const { outlets, loading, selectedOutletId, updateOutlet: applyLocalUpdate } = useOutlets();

  if (loading) return <LoadingRows />;

  if (outlets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center" data-testid="outlet-details-no-outlets">
        <Store className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-headline text-lg font-medium">No outlets yet</p>
        <p className="max-w-md text-sm text-muted-foreground">Once your outlet is set up, you can edit its name, address and timezone here.</p>
      </div>
    );
  }

  const outlet = outlets.find((candidate) => candidate.id === selectedOutletId);
  if (!outlet) return <LoadingRows />;

  // key={outlet.id}: a full remount on outlet switch so an edit in flight
  // for outlet A can never bleed into outlet B's draft.
  return <OutletDetailsForm key={outlet.id} outlet={outlet} onSaved={applyLocalUpdate} />;
}

interface Draft {
  name: string;
  address: string;
  timezone: string;
}

function toDraft(outlet: Pick<OutletView, "name" | "address" | "timezone">): Draft {
  return { name: outlet.name, address: outlet.address, timezone: outlet.timezone };
}

function OutletDetailsForm({
  outlet,
  onSaved,
}: Readonly<{ outlet: OutletView; onSaved: (id: string, patch: Partial<Pick<OutletView, "name" | "address" | "timezone">>) => void }>) {
  const [draft, setDraft] = useState<Draft>(toDraft(outlet));
  const [saved, setSaved] = useState<Draft>(toDraft(outlet));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pushToast = useToast();

  const dirty = draft.name !== saved.name || draft.address !== saved.address || draft.timezone !== saved.timezone;

  function updateField(patch: Partial<Draft>) {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  }

  function buildPatch(): UpdateOutletInput {
    const patch: UpdateOutletInput = {};
    if (draft.name !== saved.name) patch.name = draft.name;
    if (draft.address !== saved.address) patch.address = draft.address;
    if (draft.timezone !== saved.timezone) patch.timezone = draft.timezone;
    return patch;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const patch = buildPatch();
    try {
      const result = await updateOutlet(outlet.id, patch);
      const normalized = toDraft(result);
      setDraft(normalized);
      setSaved(normalized);
      onSaved(outlet.id, patch);
      pushToast({ kind: "success", message: "Outlet details saved." });
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't save outlet details. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6 rounded-lg border border-border/40 bg-card p-6" data-testid="outlet-details-form">
      <h2 className="font-headline text-lg font-semibold">Outlet</h2>

      <div>
        <span className={LABEL_CLASS}>Outlet type</span>
        <p data-testid="outlet-details-type" className={READONLY_FIELD_CLASS}>
          {OUTLET_TYPE_LABELS[outlet.type]}
        </p>
      </div>

      <div>
        <label htmlFor="outlet-details-name" className={LABEL_CLASS}>
          Outlet name
        </label>
        <input
          id="outlet-details-name"
          data-testid="outlet-details-name"
          type="text"
          value={draft.name}
          onChange={(event) => updateField({ name: event.target.value })}
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label htmlFor="outlet-details-address" className={LABEL_CLASS}>
          Address
        </label>
        <textarea
          id="outlet-details-address"
          data-testid="outlet-details-address"
          rows={3}
          value={draft.address}
          onChange={(event) => updateField({ address: event.target.value })}
          className={`${FIELD_CLASS} resize-none`}
        />
      </div>

      <div>
        <label htmlFor="outlet-details-timezone" className={LABEL_CLASS}>
          Timezone
        </label>
        <select
          id="outlet-details-timezone"
          data-testid="outlet-details-timezone"
          value={draft.timezone}
          onChange={(event) => updateField({ timezone: event.target.value })}
          className={FIELD_CLASS}
        >
          {/* An outlet's stored zone (e.g. the IANA alias "Asia/Kolkata") may not
              be in this ICU's canonical list (which has "Asia/Calcutta" instead) -
              prepend it so the current value is always selectable, never silently
              swapped for the list's first entry. */}
          {!TIMEZONES.includes(draft.timezone) && <option value={draft.timezone}>{draft.timezone}</option>}
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" data-testid="outlet-details-error" className="text-sm text-status-error">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end border-t border-border/40 pt-4">
        <Button data-testid="outlet-details-save" disabled={!dirty || saving} onClick={() => void handleSave()}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
