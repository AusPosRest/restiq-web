"use client";

// O4 Tenant Onboarding Wizard (CAP-2). Behavior per EXPERIENCE.md: step
// indicator clickable backwards only, per-field validation on blur, step
// validation on Next, every step auto-saved as a resumable draft, and a
// provisioning failure keeps the draft - nothing partial is ever created.
import { AlertTriangle, Check, MailCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BusinessStep, OutletsStep, OwnerInviteStep, SubscriptionStep, TaxStep } from "./steps";
import {
  STEP_COUNT,
  STEPS,
  StepErrors,
  StepKey,
  WizardData,
  dataFromDraft,
  emptyWizardData,
  firstIncompleteStep,
  toSubmitPayload,
  validateStep,
} from "./wizard-state";

const AUTOSAVE_DEBOUNCE_MS = 800;

type Phase =
  | { name: "loading" }
  | { name: "resume-prompt"; draftUpdatedAt: string; draftData: WizardData }
  | { name: "editing" }
  | { name: "success"; tenantName: string; inviteEmail: string; inviteExpiresAt: string };

type DraftStatus = { state: "idle" } | { state: "saved"; at: string } | { state: "error" };

interface ApiError {
  error?: { code?: string; message?: string };
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/ops/api/${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
}

function stepPayload(data: WizardData, step: number): object {
  return data[STEPS[step - 1].key];
}

export function OnboardingWizard() {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [data, setData] = useState<WizardData>(emptyWizardData);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<StepErrors>({});
  const [draftStatus, setDraftStatus] = useState<DraftStatus>({ state: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api("tenants/draft");
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { draft: { steps: Record<string, unknown>; updatedAt: string } };
          setPhase({ name: "resume-prompt", draftUpdatedAt: body.draft.updatedAt, draftData: dataFromDraft(body.draft.steps) });
          return;
        }
      } catch {
        // fall through to a fresh wizard - drafts are a convenience
      }
      if (!cancelled) setPhase({ name: "editing" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveStep = useCallback(async (stepToSave: number): Promise<void> => {
    try {
      const res = await api(`tenants/draft/steps/${stepToSave}`, {
        method: "PUT",
        body: JSON.stringify(stepPayload(dataRef.current, stepToSave)),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { updatedAt: string };
      setDraftStatus({ state: "saved", at: body.updatedAt });
    } catch {
      setDraftStatus({ state: "error" });
    }
  }, []);

  // Debounced auto-save as fields change; immediate save happens on step change.
  const scheduleAutosave = useCallback(
    (stepToSave: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void saveStep(stepToSave);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [saveStep],
  );

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function updateSection<K extends StepKey>(key: K, value: WizardData[K]): void {
    setData((current) => ({ ...current, [key]: value }));
    scheduleAutosave(step);
  }

  function onFieldBlur(field: string): void {
    const stepErrors = validateStep(step, dataRef.current);
    setErrors((current) => {
      const next = { ...current };
      if (stepErrors[field]) next[field] = stepErrors[field];
      else delete next[field];
      return next;
    });
  }

  function goToStep(target: number): void {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void saveStep(step);
    setErrors({});
    setSubmitError(null);
    setStep(target);
  }

  function onNext(): void {
    const stepErrors = validateStep(step, data);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    goToStep(step + 1);
  }

  function onBack(): void {
    goToStep(step - 1);
  }

  function onResume(): void {
    if (phase.name !== "resume-prompt") return;
    setData(phase.draftData);
    setStep(firstIncompleteStep(phase.draftData));
    setPhase({ name: "editing" });
  }

  function onStartOver(): void {
    void api("tenants/draft", { method: "DELETE" }).catch(() => undefined);
    setData(emptyWizardData());
    setStep(1);
    setPhase({ name: "editing" });
  }

  async function onSubmit(): Promise<void> {
    const stepErrors = validateStep(STEP_COUNT, data);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api("tenants", { method: "POST", body: JSON.stringify(toSubmitPayload(data)) });
      if (res.ok) {
        const body = (await res.json()) as {
          tenant: { id: string; name: string; status: string };
          invite: { email: string; expiresAt: string };
        };
        setPhase({
          name: "success",
          tenantName: body.tenant.name,
          inviteEmail: body.invite.email,
          inviteExpiresAt: body.invite.expiresAt,
        });
        return;
      }
      const body = (await res.json().catch(() => null)) as ApiError | null;
      setSubmitError(body?.error?.message ?? "Provisioning failed. Check the API connection and try again.");
    } catch {
      setSubmitError("Provisioning failed. Check the API connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase.name === "loading") {
    return (
      <div data-testid="onb-loading" className="mx-auto w-full max-w-3xl">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="mt-8 h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (phase.name === "success") {
    return (
      <section data-testid="onb-success" className="mx-auto w-full max-w-2xl pt-8 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-status-healthy/15">
          <Check className="size-8 text-status-healthy" aria-hidden="true" />
        </span>
        <h1 className="font-headline mt-6 text-3xl font-semibold">{phase.tenantName} is provisioned</h1>
        <p className="mt-3 text-muted-foreground">
          Tenant, outlets, system roles, tax profile and a sample menu were created together. The tenant stays in{" "}
          <span className="font-semibold text-status-pending">provisioning</span> until the owner&apos;s first device syncs.
        </p>
        <div className="mx-auto mt-8 flex max-w-md items-start gap-4 rounded-lg border border-border bg-card p-5 text-left">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Owner invite pending</p>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="onb-success-invite-email">
              {phase.inviteEmail}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Expires {new Date(phase.inviteExpiresAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button asChild data-testid="onb-success-tenants-link">
            <Link href="/ops/tenants">Go to Tenants</Link>
          </Button>
          <Button
            variant="outline"
            data-testid="onb-success-new"
            onClick={() => {
              setData(emptyWizardData());
              setStep(1);
              setErrors({});
              setDraftStatus({ state: "idle" });
              setPhase({ name: "editing" });
            }}
          >
            Onboard another tenant
          </Button>
        </div>
      </section>
    );
  }

  if (phase.name === "resume-prompt") {
    return (
      <section data-testid="onb-resume-prompt" className="mx-auto w-full max-w-xl pt-16">
        <h1 className="font-headline text-2xl font-semibold">Resume onboarding draft?</h1>
        <p className="mt-3 text-muted-foreground">
          You have an unfinished tenant onboarding draft, last saved{" "}
          {new Date(phase.draftUpdatedAt).toLocaleString()}. Drafts never create a tenant until final submit.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Button data-testid="onb-resume" onClick={onResume}>
            Resume draft
          </Button>
          <Button variant="outline" data-testid="onb-start-over" onClick={onStartOver}>
            Start over
          </Button>
        </div>
      </section>
    );
  }

  const active = STEPS[step - 1];

  return (
    <div className="mx-auto flex w-full max-w-5xl gap-10">
      {/* Step indicator - backward-clickable only (EXPERIENCE.md wizard pattern). */}
      <nav aria-label="Onboarding progress" className="w-56 shrink-0 pt-2">
        <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Onboarding progress
        </p>
        <ol className="mt-5 space-y-1">
          {STEPS.map(({ id, title, caption }) => {
            const isDone = id < step;
            const isActive = id === step;
            const marker = isDone ? (
              <Check className="size-3.5" aria-hidden="true" />
            ) : (
              <span className="text-xs font-semibold">{id}</span>
            );
            const markerClasses = isDone
              ? "bg-status-healthy/20 text-status-healthy"
              : isActive
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-muted-foreground";
            const inner = (
              <span className="flex items-start gap-3">
                <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${markerClasses}`}>
                  {marker}
                </span>
                <span>
                  <span className={`block text-sm ${isActive ? "font-semibold text-primary" : isDone ? "text-foreground" : "text-muted-foreground"}`}>
                    {title}
                  </span>
                  <span className="block text-xs text-muted-foreground">{caption}</span>
                </span>
              </span>
            );
            return (
              <li key={id}>
                {isDone ? (
                  <button
                    type="button"
                    data-testid={`onb-step-${id}`}
                    aria-label={`Back to step ${id}: ${title}`}
                    onClick={() => goToStep(id)}
                    className="w-full rounded-lg p-2 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {inner}
                  </button>
                ) : (
                  <span
                    data-testid={`onb-step-${id}`}
                    aria-current={isActive ? "step" : undefined}
                    className="block w-full p-2"
                  >
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="min-w-0 flex-1 rounded-lg border border-border/60 bg-card p-8">
        <header className="flex items-start justify-between gap-6 border-b border-border/60 pb-6">
          <div>
            <h1 className="font-headline text-2xl font-semibold">{active.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{active.caption}</p>
          </div>
          <span data-testid="onb-draft-status" className="font-label shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {draftStatus.state === "saved"
              ? `Draft · saved ${new Date(draftStatus.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : draftStatus.state === "error"
                ? "Draft · not saved"
                : "Draft"}
          </span>
        </header>

        {submitError ? (
          <div
            role="alert"
            data-testid="onb-error-panel"
            className="mt-6 flex items-start gap-3 rounded-lg border border-status-critical/40 bg-status-critical/10 p-4"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-status-critical" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-status-critical">Provisioning failed - nothing was created</p>
              <p className="mt-1 text-sm text-foreground">{submitError}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your draft is kept. Fix the issue and submit again.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          {step === 1 ? (
            <BusinessStep data={data.business} errors={errors} onChange={(value) => updateSection("business", value)} onFieldBlur={onFieldBlur} />
          ) : step === 2 ? (
            <TaxStep data={data.tax} errors={errors} onChange={(value) => updateSection("tax", value)} onFieldBlur={onFieldBlur} />
          ) : step === 3 ? (
            <OutletsStep
              data={data.brandsOutlets}
              errors={errors}
              country={data.tax.country}
              onChange={(value) => updateSection("brandsOutlets", value)}
              onFieldBlur={onFieldBlur}
            />
          ) : step === 4 ? (
            <SubscriptionStep data={data.subscription} errors={errors} onChange={(value) => updateSection("subscription", value)} />
          ) : (
            <OwnerInviteStep data={data.ownerInvite} errors={errors} onChange={(value) => updateSection("ownerInvite", value)} onFieldBlur={onFieldBlur} />
          )}
        </div>

        <footer className="mt-10 flex items-center justify-between border-t border-border/60 pt-6">
          <div>
            {step > 1 ? (
              <Button variant="outline" data-testid="onb-back" onClick={onBack}>
                Back
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            {step < STEP_COUNT ? (
              <Button data-testid="onb-next" onClick={onNext}>
                {step === 1 ? "Next Step" : `Continue to ${STEPS[step].title}`}
              </Button>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">Tenant creation ready</span>
                <Button data-testid="onb-submit" disabled={submitting} onClick={() => void onSubmit()}>
                  {submitting ? "Provisioning..." : "Send Invite & Finish"}
                </Button>
              </>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
