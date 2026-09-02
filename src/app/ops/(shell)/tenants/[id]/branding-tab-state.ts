// Pure branding-draft logic for the ops Tenant Detail Branding tab (issue
// #108), kept free of React so it's testable on its own - same split as
// capabilities-tab and the owner console's own branding-state.ts (AD-4:
// ops/admin route trees never import from each other, so this doesn't reuse
// that file directly even though the shape overlaps).
//
// This tab edits `Tenant.brandingTokens` through
// `PUT /ops/v1/tenants/:id/branding` (restiq-backend's directory.dtos.ts
// `UpdateBrandingDto`, read directly), which is a *different* contract from
// the owner console's merge-PUT `/admin/v1/branding`: it's a free-form
// `Record<string, string>` that the backend REPLACES wholesale
// (`directory.service.ts#updateBranding` - `tenant.update({ data: {
// brandingTokens: tokens } })`, not a merge), accepts arbitrary extra keys
// beyond the 9 this form knows about, and requires every value - including
// `cornerRadiusPx` - to be a string (`typeof value !== 'string'` is a hard
// 400). `buildBrandingPayload` below starts from the tenant's current full
// token map and only touches the fields this form actually changed, so an
// unrelated custom key an operator set earlier is never silently dropped by
// the full-replace semantics.

export interface BrandingDraft {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor: string;
  font: string;
  cornerRadiusPx: number;
  logoUrl: string;
  receiptHeader: string;
  receiptFooter: string;
}

const FIELDS = [
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "surfaceColor",
  "font",
  "cornerRadiusPx",
  "logoUrl",
  "receiptHeader",
  "receiptFooter",
] as const satisfies ReadonlyArray<keyof BrandingDraft>;

// Mirrors restiq-backend's UpdateBrandingDto: @Min(0) @Max(64).
export const MAX_CORNER_RADIUS_PX = 64;
export const MAX_FONT_LENGTH = 100;
export const MAX_LOGO_URL_LENGTH = 2048;
export const MAX_RECEIPT_TEXT_LENGTH = 200;

// Mirrors the backend's @IsHexColor (validator.js accepts 3/4/6/8 hex
// digits with an optional leading "#" - the 3- and 6-digit forms are the
// only ones a real color picker or a hand-typed shorthand ever produces).
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** input[type=color] only ever accepts/emits a 6-digit "#rrggbb" - this
 * expands a valid 3-digit shorthand so the picker can mirror a hand-typed
 * hex value, falling back to black for whatever's currently invalid. */
export function expandHex(value: string): string {
  const shorthand = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (shorthand) {
    const [, r, g, b] = shorthand;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return isValidHexColor(value) ? value.toLowerCase() : "#000000";
}

export function clampCornerRadius(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_CORNER_RADIUS_PX, Math.max(0, Math.round(value)));
}

// Same defaults as the owner console's DEFAULT_BRANDING (branding-state.ts)
// for the fields that need a real value even when unset - a color input
// can't render "empty" and a slider needs a starting position. The text
// fields default to "" so an unset field shows its placeholder, not a
// fabricated value.
const DEFAULT_COLORS = {
  primaryColor: "#f59e0b",
  secondaryColor: "#f5990b",
  accentColor: "#ffe08a",
  surfaceColor: "#26262a",
} as const;
const DEFAULT_CORNER_RADIUS_PX = 8;

/** `tenant.brandingTokens` is a flat Record<string, string> that may also
 * hold unrelated custom keys an operator set directly - this reads out just
 * the 9 fields this form edits. */
export function normalizeBrandingDraft(tokens: Record<string, string>): BrandingDraft {
  const color = (key: keyof typeof DEFAULT_COLORS): string => {
    const raw = tokens[key];
    return raw !== undefined && isValidHexColor(raw) ? raw : DEFAULT_COLORS[key];
  };
  const radius = Number(tokens.cornerRadiusPx);
  return {
    primaryColor: color("primaryColor"),
    secondaryColor: color("secondaryColor"),
    accentColor: color("accentColor"),
    surfaceColor: color("surfaceColor"),
    font: tokens.font ?? "",
    cornerRadiusPx: tokens.cornerRadiusPx !== undefined && Number.isFinite(radius) ? clampCornerRadius(radius) : DEFAULT_CORNER_RADIUS_PX,
    logoUrl: tokens.logoUrl ?? "",
    receiptHeader: tokens.receiptHeader ?? "",
    receiptFooter: tokens.receiptFooter ?? "",
  };
}

export function brandingDraftEqual(a: BrandingDraft, b: BrandingDraft): boolean {
  return FIELDS.every((field) => a[field] === b[field]);
}

/** Builds the full tokens map to PUT: the tenant's current full token map
 * (preserving any custom key outside the 9 this form knows about - the
 * endpoint replaces the whole map rather than merging it), with only the
 * fields that actually changed from `initial` applied on top. A field
 * cleared back to "" is removed from the map rather than sent as an empty
 * string - this contract has no other way to represent "unset". */
export function buildBrandingPayload(current: Record<string, string>, initial: BrandingDraft, draft: BrandingDraft): Record<string, string> {
  const next = { ...current };
  for (const field of FIELDS) {
    if (draft[field] === initial[field]) continue;
    const value = draft[field];
    const str = typeof value === "number" ? String(value) : value;
    if (str === "") delete next[field];
    else next[field] = str;
  }
  return next;
}
