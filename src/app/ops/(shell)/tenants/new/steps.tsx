"use client";

// The five O4 step forms. Field sets follow the Stitch renders; pricing copy
// is illustrative display copy only - plans have no money model until the
// subscription story.
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, SelectField, TextAreaField, TextField, ToggleField } from "./fields";
import {
  BrandsOutletsData,
  BusinessData,
  CountryCode,
  OUTLET_TYPES,
  OwnerInviteData,
  StepErrors,
  SubscriptionData,
  TAX_PROFILES,
  TaxData,
  TIMEZONES,
  emptyOutlet,
} from "./wizard-state";

interface StepProps<T> {
  data: T;
  errors: StepErrors;
  onChange: (data: T) => void;
  onFieldBlur: (field: string) => void;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-label border-b border-border/60 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

export function BusinessStep({ data, errors, onChange, onFieldBlur }: StepProps<BusinessData>) {
  const set = (patch: Partial<BusinessData>) => onChange({ ...data, ...patch });
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <SectionHeading>Company Information</SectionHeading>
        <TextField
          id="onb-company-name"
          label="Company Name"
          placeholder="e.g. Acme Hospitality Group"
          value={data.companyName}
          error={errors.companyName}
          onChange={(companyName) => set({ companyName })}
          onBlur={() => onFieldBlur("companyName")}
        />
        <TextAreaField
          id="onb-registered-address"
          label="Registered Address"
          placeholder="Full street address"
          value={data.registeredAddress}
          error={errors.registeredAddress}
          onChange={(registeredAddress) => set({ registeredAddress })}
          onBlur={() => onFieldBlur("registeredAddress")}
        />
      </section>
      <section className="space-y-4">
        <SectionHeading>Primary Contact</SectionHeading>
        <TextField
          id="onb-contact-name"
          label="Contact Person"
          placeholder="Jane Doe"
          value={data.contactName}
          error={errors.contactName}
          onChange={(contactName) => set({ contactName })}
          onBlur={() => onFieldBlur("contactName")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="onb-contact-email"
            label="Email Address"
            type="email"
            placeholder="jane@example.com"
            value={data.contactEmail}
            error={errors.contactEmail}
            onChange={(contactEmail) => set({ contactEmail })}
            onBlur={() => onFieldBlur("contactEmail")}
          />
          <TextField
            id="onb-contact-phone"
            label="Phone Number"
            type="tel"
            placeholder="+91 00000 00000"
            value={data.contactPhone}
            error={errors.contactPhone}
            onChange={(contactPhone) => set({ contactPhone })}
            onBlur={() => onFieldBlur("contactPhone")}
          />
        </div>
      </section>
    </div>
  );
}

export function TaxStep({ data, errors, onChange, onFieldBlur }: StepProps<TaxData>) {
  const set = (patch: Partial<TaxData>) => onChange({ ...data, ...patch });
  const setCountry = (country: CountryCode) =>
    onChange({ ...data, country, taxProfile: TAX_PROFILES[country][0], registrationNumber: "", fssaiLicense: "" });
  const isIndia = data.country === "IN";

  return (
    <div className="space-y-6">
      <div
        role="radiogroup"
        aria-label="Country"
        className="inline-flex rounded-lg border border-border bg-muted p-1"
      >
        {(
          [
            { code: "IN", label: "India" },
            { code: "AU", label: "Australia" },
          ] as const
        ).map(({ code, label }) => (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={data.country === code}
            data-testid={`onb-country-${code.toLowerCase()}`}
            onClick={() => setCountry(code)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              data.country === code ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <TextField
        id="onb-registration-number"
        label={isIndia ? "GSTIN" : "ABN"}
        placeholder={isIndia ? "29ABCDE1234F1Z5" : "11-digit ABN"}
        value={data.registrationNumber}
        error={errors.registrationNumber}
        onChange={(registrationNumber) => set({ registrationNumber })}
        onBlur={() => onFieldBlur("registrationNumber")}
      />
      <TextField
        id="onb-legal-entity-name"
        label="Legal entity name"
        placeholder="Registered legal name"
        value={data.legalEntityName}
        error={errors.legalEntityName}
        onChange={(legalEntityName) => set({ legalEntityName })}
        onBlur={() => onFieldBlur("legalEntityName")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="onb-tax-profile"
          label="Tax profile"
          value={data.taxProfile}
          error={errors.taxProfile}
          options={TAX_PROFILES[data.country].map((profile) => ({ value: profile, label: profile }))}
          onChange={(taxProfile) => set({ taxProfile })}
        />
        {isIndia ? (
          <TextField
            id="onb-fssai-license"
            label="FSSAI licence number"
            placeholder="14-digit licence code"
            value={data.fssaiLicense}
            error={errors.fssaiLicense}
            onChange={(fssaiLicense) => set({ fssaiLicense })}
            onBlur={() => onFieldBlur("fssaiLicense")}
          />
        ) : null}
      </div>
      {isIndia ? (
        <ToggleField
          id="onb-composition-scheme"
          label="Composition scheme"
          description="Enable if this business is registered under the GST composition scheme. Standard tax rates will be disabled."
          checked={data.compositionScheme}
          onChange={(compositionScheme) => set({ compositionScheme })}
        />
      ) : null}
      <p className="rounded-lg border border-status-info/30 bg-status-info/10 px-4 py-3 text-sm text-status-info">
        Invoice series and tax rates will be seeded from this profile for every outlet. You can override these settings
        later at the individual outlet level if required.
      </p>
    </div>
  );
}

export function OutletsStep({
  data,
  errors,
  country,
  onChange,
  onFieldBlur,
}: StepProps<BrandsOutletsData> & { country: CountryCode }) {
  const setOutlet = (index: number, patch: Partial<BrandsOutletsData["outlets"][number]>) => {
    const outlets = data.outlets.map((outlet, i) => (i === index ? { ...outlet, ...patch } : outlet));
    onChange({ ...data, outlets });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-border/60 bg-muted/40 p-5">
        <SectionHeading>Primary Brand</SectionHeading>
        <TextField
          id="onb-brand-name"
          label="Brand Name"
          placeholder="e.g. Burger Palace"
          value={data.brandName}
          error={errors.brandName}
          onChange={(brandName) => onChange({ ...data, brandName })}
          onBlur={() => onFieldBlur("brandName")}
        />
        <p className="text-sm text-muted-foreground">This is the customer-facing name, distinct from the legal entity.</p>
      </section>

      {data.outlets.map((outlet, index) => (
        <section key={index} className="space-y-4 rounded-lg border border-border/60 bg-muted/40 p-5">
          <div className="flex items-center justify-between">
            <SectionHeading>{index === 0 ? "First Outlet Details" : `Outlet ${index + 1}`}</SectionHeading>
            <div className="flex items-center gap-3">
              <span className="font-label rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                Outlet #{String(index + 1).padStart(3, "0")}
              </span>
              {data.outlets.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  data-testid={`onb-outlet-${index}-remove`}
                  aria-label={`Remove outlet ${index + 1}`}
                  onClick={() => onChange({ ...data, outlets: data.outlets.filter((_, i) => i !== index) })}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>
          <TextField
            id={`onb-outlet-${index}-name`}
            label="Outlet Name"
            placeholder="e.g. Downtown Central"
            value={outlet.name}
            error={errors[`outlets.${index}.name`]}
            onChange={(name) => setOutlet(index, { name })}
            onBlur={() => onFieldBlur(`outlets.${index}.name`)}
          />
          <TextAreaField
            id={`onb-outlet-${index}-address`}
            label="Address / Location"
            placeholder="Full street address..."
            value={outlet.address}
            error={errors[`outlets.${index}.address`]}
            onChange={(address) => setOutlet(index, { address })}
            onBlur={() => onFieldBlur(`outlets.${index}.address`)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id={`onb-outlet-${index}-type`}
              label="Outlet Type"
              placeholder="Select type..."
              value={outlet.type}
              error={errors[`outlets.${index}.type`]}
              options={OUTLET_TYPES}
              onChange={(type) => setOutlet(index, { type })}
            />
            <SelectField
              id={`onb-outlet-${index}-timezone`}
              label="Timezone"
              value={outlet.timezone}
              error={errors[`outlets.${index}.timezone`]}
              options={TIMEZONES[country].map((zone) => ({ value: zone, label: zone }))}
              onChange={(timezone) => setOutlet(index, { timezone })}
            />
          </div>
        </section>
      ))}

      <Button
        type="button"
        variant="outline"
        data-testid="onb-add-outlet"
        onClick={() => onChange({ ...data, outlets: [...data.outlets, emptyOutlet(country)] })}
      >
        <Plus aria-hidden="true" /> Add another outlet
      </Button>
    </div>
  );
}

const PLANS = [
  {
    value: "standard" as const,
    name: "Standard",
    tagline: "Essential features for single-location quick service restaurants.",
    monthly: 49,
    features: ["Up to 3 POS devices per outlet", "Basic menu management", "Standard end-of-day reporting", "Email support (24hr SLA)"],
  },
  {
    value: "enterprise" as const,
    name: "Enterprise",
    tagline: "Advanced fleet management for multi-location franchises.",
    monthly: 129,
    recommended: true,
    features: ["Unlimited POS devices", "Centralized multi-location menus", "Real-time analytics API", "Advanced inventory syncing", "24/7 priority phone support"],
  },
];

export function SubscriptionStep({ data, errors, onChange }: Omit<StepProps<SubscriptionData>, "onFieldBlur">) {
  const annual = data.billingPeriod === "annual";
  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-lg border border-border bg-muted p-1">
        {(
          [
            { value: "monthly", label: "Monthly billing" },
            { value: "annual", label: "Annual billing · -20%" },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={data.billingPeriod === value}
            data-testid={`onb-billing-${value}`}
            onClick={() => onChange({ ...data, billingPeriod: value })}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              data.billingPeriod === value ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {PLANS.map((plan) => {
          const selected = data.plan === plan.value;
          const price = annual ? Math.round(plan.monthly * 0.8) : plan.monthly;
          return (
            <button
              key={plan.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`onb-plan-${plan.value}`}
              onClick={() => onChange({ ...data, plan: plan.value })}
              className={`relative flex flex-col rounded-lg border p-6 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                selected ? "border-primary bg-primary/5" : "border-border bg-muted/40 hover:border-primary/50"
              }`}
            >
              {plan.recommended ? (
                <span className="font-label absolute -top-3 left-6 rounded-md bg-primary px-2 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                  Recommended
                </span>
              ) : null}
              <span className="font-headline text-lg font-semibold">{plan.name}</span>
              <span className="mt-1 text-sm text-muted-foreground">{plan.tagline}</span>
              <span className="font-headline mt-4 text-3xl font-semibold">
                A${price}
                <span className="font-sans text-sm font-normal text-muted-foreground"> / outlet / month</span>
              </span>
              <ul className="mt-5 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm">
                    <Check className="size-4 shrink-0 text-status-healthy" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <span
                aria-hidden="true"
                className={`mt-6 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-semibold ${
                  selected ? "bg-primary text-primary-foreground" : "border border-border text-foreground"
                }`}
              >
                {selected ? "Selected" : `Select ${plan.name}`}
              </span>
            </button>
          );
        })}
      </div>
      <FieldError error={errors.plan} id="onb-plan-error" />
    </div>
  );
}

export function OwnerInviteStep({ data, errors, onChange, onFieldBlur }: StepProps<OwnerInviteData>) {
  const set = (patch: Partial<OwnerInviteData>) => onChange({ ...data, ...patch });
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-border/60 bg-muted/40 p-5">
        <SectionHeading>Owner Profile</SectionHeading>
        <TextField
          id="onb-owner-email"
          label="Email Address"
          type="email"
          placeholder="owner@restaurant.com"
          value={data.email}
          error={errors.email}
          onChange={(email) => set({ email })}
          onBlur={() => onFieldBlur("email")}
        />
        <p className="text-sm text-muted-foreground">The invitation link will be sent here.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="onb-owner-first-name"
            label="First Name"
            value={data.firstName}
            error={errors.firstName}
            onChange={(firstName) => set({ firstName })}
            onBlur={() => onFieldBlur("firstName")}
          />
          <TextField
            id="onb-owner-last-name"
            label="Last Name"
            value={data.lastName}
            error={errors.lastName}
            onChange={(lastName) => set({ lastName })}
            onBlur={() => onFieldBlur("lastName")}
          />
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-muted/40 p-5">
        <div className="flex items-center justify-between">
          <SectionHeading>Role Assignment</SectionHeading>
          <span className="font-label rounded-md bg-accent px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fixed Role
          </span>
        </div>
        <div className="mt-4 flex items-start gap-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Tenant Super Admin</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This role grants unrestricted access to the tenant&apos;s workspace, including managing other users,
              billing, and system configuration. The primary owner must be assigned this role.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
