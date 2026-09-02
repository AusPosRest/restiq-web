"use client";

// Tenant Detail's Branding tab (issue #108): a structured form over the
// tenant's design-token overrides, replacing the raw-JSON textarea this used
// to be. See branding-tab-state.ts's file header for why this can't just
// reuse the owner console's own branding form/contract (AD-4, plus a
// genuinely different full-replace-not-merge backend endpoint).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { opsApi, OpsApiError, TenantDetail } from "../../api";
import { ConfirmReasonDialog } from "../../confirm-reason-dialog";
import { useToast } from "../../toast";
import { TextField, TextAreaField } from "../new/fields";
import {
  BrandingDraft,
  brandingDraftEqual,
  buildBrandingPayload,
  clampCornerRadius,
  expandHex,
  isValidHexColor,
  MAX_CORNER_RADIUS_PX,
  MAX_FONT_LENGTH,
  MAX_LOGO_URL_LENGTH,
  MAX_RECEIPT_TEXT_LENGTH,
  normalizeBrandingDraft,
} from "./branding-tab-state";

interface TabProps {
  detail: TenantDetail;
  onMutated: () => void;
}

const COLOR_FIELDS: Array<{ key: keyof Pick<BrandingDraft, "primaryColor" | "secondaryColor" | "accentColor" | "surfaceColor">; label: string }> = [
  { key: "primaryColor", label: "Primary" },
  { key: "secondaryColor", label: "Secondary" },
  { key: "accentColor", label: "Accent" },
  { key: "surfaceColor", label: "Surface" },
];

function ColorField({
  fieldKey,
  label,
  value,
  onChange,
}: Readonly<{ fieldKey: string; label: string; value: string; onChange: (value: string) => void }>) {
  const id = `branding-color-${fieldKey}`;
  const valid = isValidHexColor(value);
  return (
    <div>
      <label htmlFor={`${id}-hex`} className="font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color`}
          data-testid={`${id}-picker`}
          value={valid ? expandHex(value) : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          id={`${id}-hex`}
          data-testid={`${id}-hex`}
          value={value}
          placeholder="#RRGGBB"
          spellCheck={false}
          aria-invalid={valid ? undefined : true}
          aria-describedby={valid ? undefined : `${id}-error`}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-lg border bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            valid ? "border-border" : "border-status-critical"
          }`}
        />
      </div>
      {!valid && (
        <p id={`${id}-error`} role="alert" data-testid={`${id}-error`} className="mt-1.5 text-sm text-error-soft">
          Enter a valid hex color (#rgb or #rrggbb).
        </p>
      )}
    </div>
  );
}

function PreviewTile({ draft }: Readonly<{ draft: BrandingDraft }>) {
  return (
    <div
      data-testid="branding-preview"
      role="img"
      aria-label="Live preview of the tenant's branding tokens"
      style={{ backgroundColor: draft.surfaceColor, borderRadius: draft.cornerRadiusPx, borderColor: draft.accentColor }}
      className="w-full border p-5"
    >
      <div className="flex items-center gap-3">
        {draft.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- operator-pasted remote URL preview, not a static asset
          <img src={draft.logoUrl} alt="" data-testid="branding-preview-logo" className="size-10 rounded object-contain" />
        )}
        <div>
          <p className="font-semibold" style={{ color: draft.primaryColor }} data-testid="branding-preview-name">
            Tenant name
          </p>
          <p className="text-xs" style={{ color: draft.accentColor }}>
            Sample guest-facing card
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled
        style={{ backgroundColor: draft.primaryColor, borderRadius: draft.cornerRadiusPx }}
        className="mt-4 px-4 py-2 text-sm font-semibold text-white"
      >
        Place order
      </button>
    </div>
  );
}

export function BrandingTab({ detail, onMutated }: Readonly<TabProps>) {
  const toast = useToast();
  const { tenant } = detail;
  const [initial, setInitial] = useState<BrandingDraft>(() => normalizeBrandingDraft(tenant.brandingTokens));
  const [draft, setDraft] = useState<BrandingDraft>(initial);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof BrandingDraft>(key: K, value: BrandingDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const invalidColor = COLOR_FIELDS.some(({ key }) => !isValidHexColor(draft[key]));
  const fontTooLong = draft.font.length > MAX_FONT_LENGTH;
  const logoUrlTooLong = draft.logoUrl.length > MAX_LOGO_URL_LENGTH;
  const dirty = !brandingDraftEqual(draft, initial);
  const canSave = dirty && !invalidColor && !fontTooLong && !logoUrlTooLong;

  async function save(reason: string) {
    setBusy(true);
    try {
      const tokens = buildBrandingPayload(tenant.brandingTokens, initial, draft);
      await opsApi<{ brandingTokens: Record<string, string> }>(`tenants/${tenant.id}/branding`, {
        method: "PUT",
        body: JSON.stringify({ tokens, reason }),
      });
      setConfirming(false);
      setInitial(draft);
      toast({ kind: "success", message: "Branding updated." });
      onMutated();
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "The branding update failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-[2fr_1fr]" data-testid="branding-form">
      <div className="space-y-5 rounded-lg border border-border/40 bg-card p-5">
        <div>
          <h2 className="font-headline text-lg font-semibold">Branding tokens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Design-token overrides applied to this tenant&apos;s guest-facing surfaces (logo, colors, receipt text).
          </p>
        </div>

        <fieldset>
          <legend className="font-label mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Color tokens</legend>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {COLOR_FIELDS.map(({ key, label }) => (
              <ColorField key={key} fieldKey={key} label={label} value={draft[key]} onChange={(value) => set(key, value)} />
            ))}
          </div>
        </fieldset>

        <TextField id="branding-font" label="Display font" value={draft.font} placeholder="e.g. Inter" onChange={(value) => set("font", value)} />

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="branding-corner-radius" className="font-label block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Corner radius
            </label>
            <span className="text-xs tabular-nums text-muted-foreground" data-testid="branding-corner-radius-value">
              {draft.cornerRadiusPx}px
            </span>
          </div>
          <input
            id="branding-corner-radius"
            data-testid="branding-corner-radius"
            type="range"
            min={0}
            max={MAX_CORNER_RADIUS_PX}
            step={1}
            value={draft.cornerRadiusPx}
            onChange={(event) => set("cornerRadiusPx", clampCornerRadius(Number(event.target.value)))}
            className="w-full accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <TextField
          id="branding-logo-url"
          label="Logo URL"
          value={draft.logoUrl}
          placeholder="https://cdn.example.com/logo.png"
          error={logoUrlTooLong ? `Logo URL can't be longer than ${MAX_LOGO_URL_LENGTH} characters.` : undefined}
          onChange={(value) => set("logoUrl", value)}
        />

        <TextAreaField id="branding-receipt-header" label="Receipt header" value={draft.receiptHeader} placeholder="e.g. GST Number, Tagline" onChange={(value) => set("receiptHeader", value.slice(0, MAX_RECEIPT_TEXT_LENGTH))} />

        <TextAreaField id="branding-receipt-footer" label="Receipt footer" value={draft.receiptFooter} placeholder="e.g. Thank you for visiting!" onChange={(value) => set("receiptFooter", value.slice(0, MAX_RECEIPT_TEXT_LENGTH))} />

        <div className="flex items-center justify-between border-t border-border/40 pt-4">
          <p className="text-xs text-muted-foreground">Replaces the tenant&apos;s current branding overrides.</p>
          <Button data-testid="branding-save" disabled={!canSave || busy} onClick={() => setConfirming(true)}>
            Save branding
          </Button>
        </div>
      </div>

      <div>
        <h2 className="font-headline mb-2 text-sm font-semibold text-muted-foreground">Live preview</h2>
        <PreviewTile draft={draft} />
      </div>

      <ConfirmReasonDialog
        open={confirming}
        title={`Update branding for ${tenant.name}`}
        description="The changed tokens replace the tenant's current branding overrides."
        verb="Save branding"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={(reason) => void save(reason)}
      />
    </div>
  );
}
