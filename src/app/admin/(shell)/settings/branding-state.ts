// Pure Branding token logic (CAP-10), kept free of React so it's testable on
// its own - same split as menu-state.ts.
//
// Shape matches restiq-backend's actual GET/PUT /admin/v1/branding
// (src/admin/branding/branding.dtos.ts, read directly on
// feature/32-branding-capabilities) - a flat token set, not the
// `{ colors: {...} }` nesting assumed before that code existed:
// `{ primaryColor, secondaryColor, accentColor, surfaceColor, font,
// cornerRadiusPx, logoUrl, receiptHeader, receiptFooter }`. GET returns every
// field `null` until the tenant's first save (no defaults server-side), and
// PUT **merges** whatever fields are sent into the stored JSON rather than
// replacing it - normalizeBranding below is what fills in this editor's
// defaults for a null/unset field, not the backend.

export interface BrandingTokens {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor: string;
  font: string;
  cornerRadiusPx: number;
  logoUrl: string | null;
  receiptHeader: string;
  receiptFooter: string;
}

/** The all-nullable shape GET actually returns. */
export type BrandingResponse = { [K in keyof BrandingTokens]: BrandingTokens[K] | null };

export const BRANDING_FONTS = ["Hanken Grotesk", "Inter", "Public Sans"] as const;

export const MIN_CORNER_RADIUS_PX = 0;
// Matches the backend's UpdateBrandingDto: @Min(0) @Max(64).
export const MAX_CORNER_RADIUS_PX = 64;

export const DEFAULT_BRANDING: BrandingTokens = {
  primaryColor: "#F59E0B",
  secondaryColor: "#F5990B",
  accentColor: "#FFE08A",
  surfaceColor: "#26262A",
  font: "Hanken Grotesk",
  cornerRadiusPx: 8,
  logoUrl: null,
  receiptHeader: "",
  receiptFooter: "",
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export function clampCornerRadius(value: number): number {
  if (!Number.isFinite(value)) return MIN_CORNER_RADIUS_PX;
  return Math.min(MAX_CORNER_RADIUS_PX, Math.max(MIN_CORNER_RADIUS_PX, Math.round(value)));
}

/** Fills in DEFAULT_BRANDING for anything null/missing/invalid in a raw
 * response, so the editor never renders a blank/broken field. */
export function normalizeBranding(raw: Partial<BrandingResponse> | null | undefined): BrandingTokens {
  const color = (value: string | null | undefined, fallback: string): string => (value && isValidHexColor(value) ? value : fallback);
  return {
    primaryColor: color(raw?.primaryColor, DEFAULT_BRANDING.primaryColor),
    secondaryColor: color(raw?.secondaryColor, DEFAULT_BRANDING.secondaryColor),
    accentColor: color(raw?.accentColor, DEFAULT_BRANDING.accentColor),
    surfaceColor: color(raw?.surfaceColor, DEFAULT_BRANDING.surfaceColor),
    font: raw?.font && (BRANDING_FONTS as readonly string[]).includes(raw.font) ? raw.font : DEFAULT_BRANDING.font,
    cornerRadiusPx: raw?.cornerRadiusPx != null ? clampCornerRadius(raw.cornerRadiusPx) : DEFAULT_BRANDING.cornerRadiusPx,
    logoUrl: raw?.logoUrl ?? null,
    receiptHeader: raw?.receiptHeader ?? "",
    receiptFooter: raw?.receiptFooter ?? "",
  };
}

export function brandingEqual(a: BrandingTokens, b: BrandingTokens): boolean {
  return (
    a.primaryColor === b.primaryColor &&
    a.secondaryColor === b.secondaryColor &&
    a.accentColor === b.accentColor &&
    a.surfaceColor === b.surfaceColor &&
    a.font === b.font &&
    a.cornerRadiusPx === b.cornerRadiusPx &&
    a.logoUrl === b.logoUrl &&
    a.receiptHeader === b.receiptHeader &&
    a.receiptFooter === b.receiptFooter
  );
}

// No logo *upload* endpoint exists in this backend yet (confirmed reading
// its working tree - branding.dtos.ts's `logoUrl` is a plain string capped
// at 2048 chars, the same as a normal design-token field, not an asset
// reference). A picked file therefore can only ever preview locally here -
// encoding even a small PNG as a data: URL runs to thousands of characters,
// which the backend would reject outright. Saving a real logo means pasting
// an already-hosted URL into the Logo URL field instead; direct upload is
// left to whichever future story wires real asset storage (per the
// backend's own wiki note).
export const MAX_LOGO_PREVIEW_BYTES = 2 * 1024 * 1024; // 2MB - keeps the local preview read reasonable.
export const ACCEPTED_LOGO_TYPES = ["image/svg+xml", "image/png"];
// Matches the backend's UpdateBrandingDto: @MaxLength(2048).
export const MAX_LOGO_URL_LENGTH = 2048;

export function isAcceptedLogoFile(file: { type: string; size: number }): boolean {
  return ACCEPTED_LOGO_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_LOGO_PREVIEW_BYTES;
}

/** Strips the leading "#" and upper-cases, matching the design's hex labels
 * under each swatch (e.g. "8B2028" not "#8b2028"). */
export function hexLabel(hex: string): string {
  return hex.replace(/^#/, "").toUpperCase();
}
