"use client";

// T10 Branding token editor (CAP-10 / EXPERIENCE.md): color tokens, display
// font, corner radius, logo, receipt header/footer, with a live receipt
// preview pane that updates on every change before Save is ever clicked.
// Branding is a routine content edit (not in the SPEC's named
// security-relevant list - role change, PIN revoke, price change), so Save
// is a plain pessimistic action with no reason prompt, same shape as
// ItemDrawer's Save.
import { Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveBranding } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useToast } from "../toast";
import { useAdminLoad } from "../use-admin-load";
import {
  BRANDING_FONTS,
  BrandingTokens,
  brandingEqual,
  clampCornerRadius,
  hexLabel,
  isAcceptedLogoFile,
  MAX_CORNER_RADIUS_PX,
  MAX_LOGO_URL_LENGTH,
  normalizeBranding,
} from "./branding-state";
import { ReceiptPreview } from "./receipt-preview";

const COLOR_FIELDS: Array<{ key: keyof Pick<BrandingTokens, "primaryColor" | "secondaryColor" | "accentColor" | "surfaceColor">; label: string }> = [
  { key: "primaryColor", label: "Primary" },
  { key: "secondaryColor", label: "Secondary" },
  { key: "accentColor", label: "Accent" },
  { key: "surfaceColor", label: "Surface" },
];

export function BrandingEditor() {
  const { loading, failed, data, retry } = useAdminLoad<Partial<BrandingTokens>>("branding");

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" data-testid="branding-loading">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (failed) {
    return <LoadErrorPanel testId="branding-load-error" message="Your branding couldn't be loaded." onRetry={retry} />;
  }

  // data is only ever null while loading/failed (see useAdminLoad) - both
  // handled above, so this mount always has a real (possibly all-null)
  // response.
  return <BrandingForm initial={normalizeBranding(data)} />;
}

// Owns the editable draft, seeded once from the load that's already landed
// by the time this mounts - no effect needed to mirror `data` into state
// (React's own guidance: adjust state during render/initial state, not via
// a synchronous setState-in-effect, which only exists here on the very first
// render of a freshly successful load).
function BrandingForm({ initial }: Readonly<{ initial: BrandingTokens }>) {
  const [draft, setDraft] = useState<BrandingTokens>(initial);
  const [saved, setSaved] = useState<BrandingTokens>(initial);
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  // A locally-picked file only ever previews - restiq-backend's `logoUrl` is
  // a plain string capped at 2048 chars (read directly from
  // branding.dtos.ts), so a data: URL encoding of any real image would be
  // rejected outright. It's kept separate from `draft` so Save never tries
  // to persist it; pasting an already-hosted URL into the Logo URL field
  // below is the only way this API can actually save a logo today.
  const [localLogoPreview, setLocalLogoPreview] = useState<string | null>(null);
  const pushToast = useToast();

  const dirty = !brandingEqual(draft, saved);
  const logoUrlTooLong = draft.logoUrl !== null && draft.logoUrl.length > MAX_LOGO_URL_LENGTH;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveBranding(draft);
      const normalized = normalizeBranding(result);
      setDraft(normalized);
      setSaved(normalized);
      pushToast({ kind: "success", message: "Branding saved. Changes reach every device within 5 minutes." });
    } catch {
      pushToast({ kind: "error", message: "Couldn't save your branding. Try again.", onRetry: () => void handleSave() });
    } finally {
      setSaving(false);
    }
  }

  function handleLogoFile(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (!isAcceptedLogoFile(file)) {
      setLogoError("Logo must be an SVG or PNG under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setLocalLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6 rounded-lg border border-border/40 bg-card p-6" data-testid="branding-form">
        <h2 className="font-headline text-lg font-semibold">Brand Identity</h2>

        <fieldset>
          <legend className="font-label mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Color Tokens</legend>
          <div className="grid grid-cols-4 gap-3">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex flex-col items-center gap-1.5 text-center text-xs">
                <input
                  type="color"
                  aria-label={`${label} color`}
                  data-testid={`branding-color-${key}`}
                  value={draft[key]}
                  onChange={(event) => setDraft((d) => ({ ...d, [key]: event.target.value }))}
                  className="h-12 w-full cursor-pointer rounded-lg border border-border bg-transparent p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono text-[11px] text-muted-foreground/80">{hexLabel(draft[key])}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="branding-font" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Display Font
          </label>
          <select
            id="branding-font"
            data-testid="branding-font"
            value={draft.font}
            onChange={(event) => setDraft((d) => ({ ...d, font: event.target.value }))}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {BRANDING_FONTS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="branding-corner-radius" className="font-label block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Corner Radius
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
            onChange={(event) => setDraft((d) => ({ ...d, cornerRadiusPx: clampCornerRadius(Number(event.target.value)) }))}
            className="w-full accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div>
          <span className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Brand Logo</span>
          <label
            htmlFor="branding-logo"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-input px-4 py-6 text-center text-xs text-muted-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-ring"
          >
            <Upload className="size-5" aria-hidden="true" />
            <span>Upload a square SVG or PNG to preview it on the receipt below.</span>
            <span className="font-semibold text-primary">Browse files</span>
            <input
              id="branding-logo"
              data-testid="branding-logo-input"
              type="file"
              accept="image/svg+xml,image/png"
              className="sr-only"
              onChange={(event) => handleLogoFile(event.target.files?.[0])}
            />
          </label>
          {logoError && (
            <p role="alert" data-testid="branding-logo-error" className="mt-1 text-xs text-status-error">
              {logoError}
            </p>
          )}

          <label htmlFor="branding-logo-url" className="font-label mb-1 mt-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Logo URL
          </label>
          <input
            id="branding-logo-url"
            data-testid="branding-logo-url"
            type="url"
            placeholder="https://cdn.example.com/logo.png"
            value={draft.logoUrl ?? ""}
            onChange={(event) => setDraft((d) => ({ ...d, logoUrl: event.target.value || null }))}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">Used on receipts, POS login screens, and customer-facing menus once hosted somewhere - a browsed file only previews here for now.</p>
          {logoUrlTooLong && (
            <p role="alert" data-testid="branding-logo-url-error" className="mt-1 text-xs text-status-error">
              Logo URL can&apos;t be longer than {MAX_LOGO_URL_LENGTH} characters.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="branding-receipt-header" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Receipt Header
          </label>
          <textarea
            id="branding-receipt-header"
            data-testid="branding-receipt-header"
            rows={2}
            maxLength={200}
            placeholder="Enter header text (e.g. GST Number, Tagline)"
            value={draft.receiptHeader}
            onChange={(event) => setDraft((d) => ({ ...d, receiptHeader: event.target.value }))}
            className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="branding-receipt-footer" className="font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Receipt Footer
          </label>
          <textarea
            id="branding-receipt-footer"
            data-testid="branding-receipt-footer"
            rows={2}
            maxLength={200}
            placeholder="Enter footer text (e.g. Thank you for visiting!)"
            value={draft.receiptFooter}
            onChange={(event) => setDraft((d) => ({ ...d, receiptFooter: event.target.value }))}
            className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-4">
          <p className="text-xs text-muted-foreground">Changes reach all devices within 5 minutes.</p>
          <Button data-testid="branding-save" disabled={!dirty || saving || logoUrlTooLong} onClick={() => void handleSave()}>
            {saving ? "Saving..." : "Save branding"}
          </Button>
        </div>
      </div>

      <div>
        <h2 className="font-headline mb-2 text-sm font-semibold text-muted-foreground">Live Preview</h2>
        <ReceiptPreview tokens={draft} logoUrl={localLogoPreview} />
      </div>
    </div>
  );
}
