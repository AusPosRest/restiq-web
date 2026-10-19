// Pure Tax Registration logic (issue #140), kept free of React so it's
// testable on its own - same split as branding-state.ts.
//
// Shape matches restiq-backend#108's actual GET/PUT admin/v1/tax-registration
// contract: `{ country, registrationType, registrationNumber, legalEntityName,
// taxProfile, fssaiLicense, compositionScheme }`, plus `gstRegistered`
// (restiq-backend#111) and `gstRatePercent` (issue #148, number | null).
// `country` and `registrationType` are set once at tenant provisioning and
// are never part of the PUT body - this editor only ever patches
// registrationNumber/legalEntityName/taxProfile/fssaiLicense/
// compositionScheme/gstRegistered/gstRatePercent, and PUT **merges** those
// into the stored record (same merge-PUT discipline as branding), returning
// the full record back. `gstRegistered` is only editable for AU tenants - the
// backend 400s a PUT with `gstRegistered: false` for an IN tenant, so the
// editor never renders the toggle (or sends a changed value) for
// country === "IN". `gstSplitRounding` (restiq-web#369, restiq-backend#244)
// is the CGST/SGST odd-paisa rule - null from the backend reads as
// "exact_total" and it is only shown for IN tenants not on the composition
// scheme. `gstRatePercent` is shown whenever `gstRegistered` is
// true (always for IN, opt-in for AU); a blank input sends `null`.

export type TaxRegistrationType = "gstin" | "abn";

export type GstSplitRounding = "exact_total" | "equal_half_up" | "equal_half_even";

export const GST_SPLIT_ROUNDING_OPTIONS: ReadonlyArray<{ value: GstSplitRounding; label: string; help: string }> = [
  { value: "exact_total", label: "Exact total", help: "GST is rounded once, then split. ₹289 at 5%: CGST ₹7.22 + SGST ₹7.23 = ₹14.45." },
  { value: "equal_half_up", label: "Equal halves, round half up", help: "Each half is rounded up on half a paisa. ₹289 at 5%: CGST ₹7.23 + SGST ₹7.23 = ₹14.46." },
  { value: "equal_half_even", label: "Equal halves, round half to even", help: "Each half is rounded to the even paisa. ₹289 at 5%: CGST ₹7.22 + SGST ₹7.22 = ₹14.44." },
];

export interface TaxRegistrationView {
  country: string;
  registrationType: TaxRegistrationType;
  registrationNumber: string | null;
  legalEntityName: string | null;
  taxProfile: string | null;
  fssaiLicense: string | null;
  compositionScheme: boolean;
  gstRegistered: boolean;
  gstRatePercent: number | null;
  gstSplitRounding: GstSplitRounding | null;
}

/** The editable draft shape this form works with - nullable text fields
 * flattened to "" so controlled inputs never see null. */
export interface TaxRegistrationDraft {
  country: string;
  registrationType: TaxRegistrationType;
  registrationNumber: string;
  legalEntityName: string;
  taxProfile: string;
  fssaiLicense: string;
  compositionScheme: boolean;
  gstRegistered: boolean;
  gstRatePercent: string;
  gstSplitRounding: GstSplitRounding;
}

/** Only the fields PUT accepts - country/registrationType are read-only and
 * never sent back. */
export interface TaxRegistrationPatch {
  registrationNumber?: string | null;
  legalEntityName?: string | null;
  taxProfile?: string | null;
  fssaiLicense?: string | null;
  compositionScheme?: boolean;
  gstRegistered?: boolean;
  gstRatePercent?: number | null;
  gstSplitRounding?: GstSplitRounding;
}

export function normalizeTaxRegistration(raw: Partial<TaxRegistrationView> | null | undefined): TaxRegistrationDraft {
  return {
    country: raw?.country ?? "",
    registrationType: raw?.registrationType ?? "gstin",
    registrationNumber: raw?.registrationNumber ?? "",
    legalEntityName: raw?.legalEntityName ?? "",
    taxProfile: raw?.taxProfile ?? "",
    fssaiLicense: raw?.fssaiLicense ?? "",
    compositionScheme: raw?.compositionScheme ?? false,
    gstRegistered: raw?.gstRegistered ?? true,
    gstRatePercent: raw?.gstRatePercent != null ? String(raw.gstRatePercent) : "",
    gstSplitRounding: raw?.gstSplitRounding ?? "exact_total",
  };
}

export function taxRegistrationEqual(a: TaxRegistrationDraft, b: TaxRegistrationDraft): boolean {
  return (
    a.registrationNumber === b.registrationNumber &&
    a.legalEntityName === b.legalEntityName &&
    a.taxProfile === b.taxProfile &&
    a.fssaiLicense === b.fssaiLicense &&
    a.compositionScheme === b.compositionScheme &&
    a.gstRegistered === b.gstRegistered &&
    a.gstRatePercent === b.gstRatePercent &&
    a.gstSplitRounding === b.gstSplitRounding
  );
}

export function isRegistrationNumberValid(draft: TaxRegistrationDraft): boolean {
  return draft.registrationNumber.trim().length > 0;
}

export function registrationTypeLabel(type: TaxRegistrationType): string {
  return type === "gstin" ? "GSTIN" : "ABN";
}

/** Builds the merge-PUT body from the current draft - blank optional fields
 * go back as null (clearing them), never as "". */
export function buildTaxRegistrationPatch(draft: TaxRegistrationDraft): TaxRegistrationPatch {
  const orNull = (value: string): string | null => (value.trim() ? value : null);
  return {
    registrationNumber: draft.registrationNumber.trim(),
    legalEntityName: orNull(draft.legalEntityName),
    taxProfile: orNull(draft.taxProfile),
    fssaiLicense: orNull(draft.fssaiLicense),
    compositionScheme: draft.compositionScheme,
    gstRegistered: draft.gstRegistered,
    gstRatePercent: draft.gstRatePercent.trim() ? Number(draft.gstRatePercent) : null,
    // CGST/SGST only - never sent for an AU tenant.
    ...(draft.country === "IN" ? { gstSplitRounding: draft.gstSplitRounding } : {}),
  };
}
