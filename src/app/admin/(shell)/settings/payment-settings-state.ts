// Pure Settings ▸ Payments logic (CAP-P1 config, issue #177, W1), kept free
// of React so it's testable on its own - same split as
// tax-registration-state.ts and branding-state.ts. W2 builds the tab over
// this.
//
// The load-bearing shape decision (ADR-006): secrets are write-only. The
// view carries `hasKeySecret` / `hasWebhookSecret` booleans and never the
// values; a blank secret field on save means "keep what is stored", so the
// payload only ever includes a secret the owner actually typed.
//
// PROVISIONAL against wiki/features/payments.md; reconcile with
// restiq-backend#129 B8 (`GET/PUT admin/v1/payment-settings`) when it merges.
import type { PaymentProviderKind } from "@/lib/payment-intent";

export type PaymentMode = "test" | "live";

export interface PaymentSettingsView {
  provider: PaymentProviderKind;
  mode: PaymentMode;
  keyId: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  /** Computed server-side from the region's API host - the owner pastes it into the provider dashboard. */
  webhookUrl: string;
  updatedAt: string | null;
}

export interface PaymentSettingsDraft {
  provider: PaymentProviderKind;
  mode: PaymentMode;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

/** The real PUT body: secrets present only when typed. */
export interface UpdatePaymentSettingsInput {
  provider: PaymentProviderKind;
  mode: PaymentMode;
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
}

export const PROVIDER_LABEL: Record<PaymentProviderKind, string> = {
  simulated: "Simulated (demo)",
  razorpay: "Razorpay",
};

/** Razorpay serves Indian merchants only; an AU tenant keeps the simulated provider until an AU rail exists (ADR-003). */
export function providerOptionsFor(country: string): PaymentProviderKind[] {
  return country === "IN" ? ["simulated", "razorpay"] : ["simulated"];
}

export function toDraft(view: PaymentSettingsView): PaymentSettingsDraft {
  return { provider: view.provider, mode: view.mode, keyId: view.keyId ?? "", keySecret: "", webhookSecret: "" };
}

const RAZORPAY_KEY_ID = /^rzp_(test|live)_[A-Za-z0-9]{6,}$/;

/** The mode a Razorpay key id was issued for, from its prefix; null when it is not a Razorpay key id at all. */
export function keyIdMode(keyId: string): PaymentMode | null {
  const match = RAZORPAY_KEY_ID.exec(keyId.trim());
  return match ? (match[1] as PaymentMode) : null;
}

export interface PaymentSettingsErrors {
  mode?: string;
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
}

/**
 * Mirrors the backend's 400s (`key_mode_mismatch`, `secret_required`) so the
 * save button never sends what the API would reject. A secret is required
 * only when none is stored yet or the provider changed (a stored Razorpay
 * secret is meaningless to a different provider).
 */
export function validateDraft(draft: PaymentSettingsDraft, view: Pick<PaymentSettingsView, "provider" | "hasKeySecret" | "hasWebhookSecret">): PaymentSettingsErrors {
  const errors: PaymentSettingsErrors = {};
  if (draft.provider === "simulated") {
    if (draft.mode === "live") errors.mode = "The simulated provider cannot go live - choose a real provider first.";
    return errors;
  }

  const keyId = draft.keyId.trim();
  const issuedFor = keyIdMode(keyId);
  if (keyId.length === 0) errors.keyId = "Enter the key id from the Razorpay dashboard.";
  else if (issuedFor === null) errors.keyId = "Enter the key id exactly as Razorpay shows it (rzp_test_… or rzp_live_…).";
  else if (issuedFor !== draft.mode) errors.mode = `A ${issuedFor} key cannot be used in ${draft.mode} mode.`;

  const providerChanged = draft.provider !== view.provider;
  if (draft.keySecret.trim().length === 0 && (providerChanged || !view.hasKeySecret)) errors.keySecret = "Enter the key secret.";
  if (draft.webhookSecret.trim().length === 0 && (providerChanged || !view.hasWebhookSecret)) {
    errors.webhookSecret = "Enter the webhook secret you set in the Razorpay dashboard.";
  }
  return errors;
}

export function toUpdatePayload(draft: PaymentSettingsDraft): UpdatePaymentSettingsInput {
  const payload: UpdatePaymentSettingsInput = { provider: draft.provider, mode: draft.mode };
  if (draft.provider === "simulated") return payload;
  payload.keyId = draft.keyId.trim();
  if (draft.keySecret.trim().length > 0) payload.keySecret = draft.keySecret.trim();
  if (draft.webhookSecret.trim().length > 0) payload.webhookSecret = draft.webhookSecret.trim();
  return payload;
}

export function isDirty(draft: PaymentSettingsDraft, view: PaymentSettingsView): boolean {
  return (
    draft.provider !== view.provider ||
    draft.mode !== view.mode ||
    draft.keyId.trim() !== (view.keyId ?? "") ||
    draft.keySecret.trim().length > 0 ||
    draft.webhookSecret.trim().length > 0
  );
}
