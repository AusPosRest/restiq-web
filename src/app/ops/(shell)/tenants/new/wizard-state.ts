// Pure wizard state: the five O4 steps, their field sets and validation
// rules. No React, no fetch - unit-testable on its own.

export const STEP_COUNT = 5;

export const STEPS = [
  { id: 1, key: "business", title: "Business Details", caption: "Company & primary contact" },
  { id: 2, key: "tax", title: "Tax & Compliance", caption: "GST and local regulations" },
  { id: 3, key: "brandsOutlets", title: "Brands & Outlets", caption: "Define your hierarchy" },
  { id: 4, key: "subscription", title: "Subscription Plan", caption: "Select the billing tier" },
  { id: 5, key: "ownerInvite", title: "Owner Invite", caption: "Grant platform access" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export interface BusinessData {
  companyName: string;
  registeredAddress: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

export type CountryCode = "IN" | "AU";

export interface TaxData {
  country: CountryCode;
  registrationNumber: string;
  legalEntityName: string;
  taxProfile: string;
  fssaiLicense: string;
  compositionScheme: boolean;
}

export interface OutletData {
  name: string;
  address: string;
  type: string;
  timezone: string;
}

export interface BrandsOutletsData {
  brandName: string;
  outlets: OutletData[];
}

export interface SubscriptionData {
  plan: "" | "standard" | "enterprise";
  billingPeriod: "monthly" | "annual";
}

export interface OwnerInviteData {
  email: string;
  firstName: string;
  lastName: string;
}

export interface WizardData {
  business: BusinessData;
  tax: TaxData;
  brandsOutlets: BrandsOutletsData;
  subscription: SubscriptionData;
  ownerInvite: OwnerInviteData;
}

export const OUTLET_TYPES = [
  { value: "dine_in", label: "Dine-in" },
  { value: "qsr", label: "QSR (Quick Service)" },
  { value: "cloud_kitchen", label: "Cloud Kitchen" },
  { value: "food_court", label: "Food Court" },
] as const;

export const TIMEZONES: Record<CountryCode, string[]> = {
  IN: ["Asia/Kolkata"],
  AU: ["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth"],
};

export const TAX_PROFILES: Record<CountryCode, string[]> = {
  IN: ["India GST - CGST/SGST split", "India GST - IGST"],
  AU: ["Australia GST 10%"],
};

export function emptyOutlet(country: CountryCode): OutletData {
  return { name: "", address: "", type: "", timezone: TIMEZONES[country][0] };
}

export function emptyWizardData(): WizardData {
  return {
    business: { companyName: "", registeredAddress: "", contactName: "", contactEmail: "", contactPhone: "" },
    tax: {
      country: "IN",
      registrationNumber: "",
      legalEntityName: "",
      taxProfile: TAX_PROFILES.IN[0],
      fssaiLicense: "",
      compositionScheme: false,
    },
    brandsOutlets: { brandName: "", outlets: [emptyOutlet("IN")] },
    subscription: { plan: "", billingPeriod: "monthly" },
    ownerInvite: { email: "", firstName: "", lastName: "" },
  };
}

// --- Validation: per-field on blur, per-step on Next (EXPERIENCE.md O4).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ABN_PATTERN = /^\d{11}$/;
const FSSAI_PATTERN = /^\d{14}$/;

export type StepErrors = Record<string, string>;

function required(value: string, label: string): string | null {
  return value.trim() ? null : `${label} is required`;
}

function email(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`;
  return EMAIL_PATTERN.test(value.trim()) ? null : "Enter a valid email address";
}

export function validateBusiness(data: BusinessData): StepErrors {
  const errors: StepErrors = {};
  const put = (field: string, error: string | null) => {
    if (error) errors[field] = error;
  };
  put("companyName", required(data.companyName, "Company name"));
  put("registeredAddress", required(data.registeredAddress, "Registered address"));
  put("contactName", required(data.contactName, "Contact person"));
  put("contactEmail", email(data.contactEmail, "Email address"));
  put("contactPhone", required(data.contactPhone, "Phone number"));
  return errors;
}

export function validateTax(data: TaxData): StepErrors {
  const errors: StepErrors = {};
  const number = data.registrationNumber.trim().toUpperCase();
  if (data.country === "IN") {
    if (!GSTIN_PATTERN.test(number)) errors.registrationNumber = "Enter a valid 15-character GSTIN (e.g. 29ABCDE1234F1Z5)";
    if (data.fssaiLicense.trim() && !FSSAI_PATTERN.test(data.fssaiLicense.trim())) {
      errors.fssaiLicense = "FSSAI licence numbers have 14 digits";
    }
  } else if (!ABN_PATTERN.test(number.replace(/\s/g, ""))) {
    errors.registrationNumber = "Enter a valid 11-digit ABN";
  }
  const legal = required(data.legalEntityName, "Legal entity name");
  if (legal) errors.legalEntityName = legal;
  const profile = required(data.taxProfile, "Tax profile");
  if (profile) errors.taxProfile = profile;
  return errors;
}

export function validateBrandsOutlets(data: BrandsOutletsData): StepErrors {
  const errors: StepErrors = {};
  const brand = required(data.brandName, "Brand name");
  if (brand) errors.brandName = brand;
  data.outlets.forEach((outlet, index) => {
    const put = (field: string, error: string | null) => {
      if (error) errors[`outlets.${index}.${field}`] = error;
    };
    put("name", required(outlet.name, "Outlet name"));
    put("address", required(outlet.address, "Address"));
    put("type", outlet.type ? null : "Select an outlet type");
    put("timezone", required(outlet.timezone, "Timezone"));
  });
  return errors;
}

export function validateSubscription(data: SubscriptionData): StepErrors {
  return data.plan ? {} : { plan: "Select a subscription plan" };
}

export function validateOwnerInvite(data: OwnerInviteData): StepErrors {
  const errors: StepErrors = {};
  const put = (field: string, error: string | null) => {
    if (error) errors[field] = error;
  };
  put("email", email(data.email, "Email address"));
  put("firstName", required(data.firstName, "First name"));
  put("lastName", required(data.lastName, "Last name"));
  return errors;
}

export function validateStep(step: number, data: WizardData): StepErrors {
  switch (step) {
    case 1:
      return validateBusiness(data.business);
    case 2:
      return validateTax(data.tax);
    case 3:
      return validateBrandsOutlets(data.brandsOutlets);
    case 4:
      return validateSubscription(data.subscription);
    default:
      return validateOwnerInvite(data.ownerInvite);
  }
}

/** The first step whose data does not yet validate - where a resume lands. */
export function firstIncompleteStep(data: WizardData): number {
  for (let step = 1; step <= STEP_COUNT; step += 1) {
    if (Object.keys(validateStep(step, data)).length > 0) return step;
  }
  return STEP_COUNT;
}

/** Merge saved draft steps (keyed "1".."5") over the empty wizard shape. */
export function dataFromDraft(steps: Record<string, unknown>): WizardData {
  const data = emptyWizardData();
  for (const { id, key } of STEPS) {
    const saved = steps[String(id)];
    if (typeof saved === "object" && saved !== null && !Array.isArray(saved)) {
      data[key] = { ...data[key], ...(saved as object) } as never;
    }
  }
  if (!data.brandsOutlets.outlets.length) data.brandsOutlets.outlets = [emptyOutlet(data.tax.country)];
  return data;
}

/** The backend submit payload (drops UI-only empties). */
export function toSubmitPayload(data: WizardData): Record<string, unknown> {
  return {
    business: data.business,
    tax: {
      country: data.tax.country,
      registrationNumber: data.tax.registrationNumber.trim().toUpperCase().replace(/\s/g, ""),
      legalEntityName: data.tax.legalEntityName,
      taxProfile: data.tax.taxProfile,
      ...(data.tax.country === "IN" && data.tax.fssaiLicense.trim() ? { fssaiLicense: data.tax.fssaiLicense.trim() } : {}),
      compositionScheme: data.tax.compositionScheme,
    },
    brandsOutlets: data.brandsOutlets,
    subscription: data.subscription,
    ownerInvite: data.ownerInvite,
  };
}
