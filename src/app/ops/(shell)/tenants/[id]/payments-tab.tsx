"use client";

// Stripe payments for one restaurant (#425, restiq-backend#282): connect status, the
// onboarding link ops hands to the owner, which methods the POS accepts, and the platform
// fee. The save is audited, so it goes through the reason dialog.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { opsApi, OpsApiError, PaymentMethod, PaymentsView, StripeLink } from "../../api";
import { ConfirmReasonDialog } from "../../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../../data-states";
import { StatusBadge } from "../../status-badge";
import { useToast } from "../../toast";
import { useOpsLoad } from "../../use-ops-load";
import { ALL_METHODS, CARD_REQUIRED, formFromPayments, isDirty, METHOD_LABELS, PaymentsForm, validatePaymentsForm } from "./payments-state";
import { StripeLinkResult } from "./stripe-link";

const INPUT_CLASSES =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const LABEL_CLASSES = "font-label mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function PaymentsTab({ tenantId }: Readonly<{ tenantId: string }>) {
  const { loading, failed, status, data, retry } = useOpsLoad<{ payments: PaymentsView }>(`tenants/${tenantId}/payments`);
  // Lives here, not in PaymentsBody: the reload after creating a link remounts the body.
  const [link, setLink] = useState<StripeLink | null>(null);

  if (loading) {
    return (
      <div className="max-w-3xl" data-testid="payments-loading">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="mt-4 h-48 w-full" />
      </div>
    );
  }
  if (failed && status === 503) {
    return (
      <div className="max-w-3xl rounded-lg border border-border/40 bg-card px-6 py-10 text-center text-sm text-muted-foreground" data-testid="payments-not-configured">
        Stripe isn&apos;t configured on this server.
      </div>
    );
  }
  if (failed || !data) {
    return <LoadErrorPanel message="Payments could not be loaded." onRetry={retry} testId="payments-error" />;
  }
  const view = data.payments;
  return <PaymentsBody key={JSON.stringify(formFromPayments(view))} tenantId={tenantId} view={view} reload={retry} link={link} setLink={setLink} />;
}

function PaymentsBody({ tenantId, view, reload, link, setLink }: Readonly<{ tenantId: string; view: PaymentsView; reload: () => void; link: StripeLink | null; setLink: (link: StripeLink) => void }>) {
  const toast = useToast();
  const [form, setForm] = useState<PaymentsForm>(() => formFromPayments(view));
  const [linkBusy, setLinkBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const patch = validatePaymentsForm(form);
  const formError = "error" in patch ? patch.error : null;
  const done = view.status === "active" && view.requirementsDue === 0;

  async function createLink() {
    setLinkBusy(true);
    try {
      const result = await opsApi<StripeLink & { payments: PaymentsView }>(`tenants/${tenantId}/payments/onboarding-link`, { method: "POST", body: "{}" });
      setLink({ url: result.url, expiresAt: result.expiresAt });
      reload();
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "Could not create the onboarding link." });
    } finally {
      setLinkBusy(false);
    }
  }

  async function save(reason: string) {
    if ("error" in patch) return;
    setSaving(true);
    setSaveError(null);
    try {
      await opsApi(`tenants/${tenantId}/payments`, { method: "PATCH", body: JSON.stringify({ ...patch, reason }) });
      setConfirming(false);
      toast({ kind: "success", message: "Payment settings saved." });
      reload();
    } catch (error) {
      setConfirming(false);
      setSaveError(error instanceof OpsApiError ? error.message : "The payment settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(method: PaymentMethod, on: boolean) {
    setForm((f) => ({ ...f, methods: on ? [...f.methods, method] : f.methods.filter((m) => m !== method) }));
  }

  return (
    <div className="grid max-w-3xl gap-4" data-testid="payments-tab">
      <div className="rounded-lg border border-border/40 bg-card p-5">
        <h2 className="font-headline text-lg font-semibold">Stripe account</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={view.status === "restricted" ? "needs info" : view.status} testId="payments-status" />
          {view.requirementsDue > 0 && (
            <span className="text-sm text-muted-foreground" data-testid="payments-requirements">
              {view.requirementsDue} {view.requirementsDue === 1 ? "item" : "items"} Stripe still needs
            </span>
          )}
          {view.stripeAccountId && (
            <span className="font-mono text-xs text-muted-foreground" data-testid="payments-account-id">
              {view.stripeAccountId}
            </span>
          )}
        </div>
        {!done && (
          <Button className="mt-4" size="sm" data-testid="payments-onboarding-link" disabled={linkBusy} onClick={() => void createLink()}>
            {linkBusy ? "Working..." : view.status === "not_connected" ? "Create Stripe account & onboarding link" : "New onboarding link"}
          </Button>
        )}
        {link && (
          <StripeLinkResult
            link={link}
            testId="payments-link"
            note="Send this link to the restaurant owner. It works once and expires in a few minutes."
          />
        )}
      </div>

      <form
        className="rounded-lg border border-border/40 bg-card p-5"
        data-testid="payments-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!formError) setConfirming(true);
        }}
      >
        <fieldset>
          <legend className="font-headline text-base font-semibold">Payment methods</legend>
          <div className="mt-3 flex flex-wrap gap-5">
            {ALL_METHODS.map((method) => (
              <label key={method} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid={`payments-method-${method}`}
                  checked={form.methods.includes(method)}
                  // Card can be ticked back on (an old setting) but never off.
                  disabled={method === "card" && form.methods.includes("card")}
                  aria-describedby={method === "card" ? "payments-card-hint" : undefined}
                  onChange={(event) => toggle(method, event.target.checked)}
                  className="size-4 rounded border-border focus-visible:ring-2 focus-visible:ring-ring"
                />
                {METHOD_LABELS[method]}
              </label>
            ))}
          </div>
          <p id="payments-card-hint" className="mt-2 text-xs text-muted-foreground" data-testid="payments-card-hint">
            {CARD_REQUIRED}
          </p>
        </fieldset>

        <h3 className="font-headline mt-6 text-base font-semibold">Platform fee</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="payments-fee-percent" className={LABEL_CLASSES}>
              Percentage (%)
            </label>
            <input
              id="payments-fee-percent"
              data-testid="payments-fee-percent"
              inputMode="decimal"
              value={form.percent}
              onChange={(event) => setForm((f) => ({ ...f, percent: event.target.value }))}
              className={INPUT_CLASSES}
            />
          </div>
          <div>
            <label htmlFor="payments-fee-fixed" className={LABEL_CLASSES}>
              Fixed per payment ({view.currency})
            </label>
            <input
              id="payments-fee-fixed"
              data-testid="payments-fee-fixed"
              inputMode="decimal"
              value={form.fixed}
              onChange={(event) => setForm((f) => ({ ...f, fixed: event.target.value }))}
              className={INPUT_CLASSES}
            />
          </div>
        </div>

        {isDirty(form, view) && formError && (
          <p role="alert" className="mt-3 text-sm text-status-critical" data-testid="payments-form-error">
            {formError}
          </p>
        )}
        {saveError && (
          <p role="alert" className="mt-3 text-sm text-status-critical" data-testid="payments-save-error">
            {saveError}
          </p>
        )}
        <Button type="submit" className="mt-5" data-testid="payments-save" disabled={!isDirty(form, view) || formError !== null || saving}>
          Save
        </Button>
      </form>

      <ConfirmReasonDialog
        open={confirming}
        title="Save payment settings?"
        description="The accepted payment methods and platform fee change for this restaurant straight away."
        verb="Save"
        busy={saving}
        onCancel={() => setConfirming(false)}
        onConfirm={(reason) => void save(reason)}
      />
    </div>
  );
}
