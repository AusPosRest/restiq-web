"use client";

// Payments tab > Stripe account (restiq-backend#284 onboarding UX): where the restaurant is
// on the way to taking cards, what Stripe still needs and from whom, and one click to carry
// on in Stripe (or a link to copy for the owner).
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { opsApi, OpsApiError, PaymentsView, StripeLink } from "../../api";
import { StatusBadge } from "../../status-badge";
import { useToast } from "../../toast";
import { blocksLabel, groupRequirements, requirementsSummary, sortRequirements, StepState, stripeSteps, URGENCY_LABELS, waitingOnLabel } from "./payments-state";
import { copyToClipboard, openBlankTab, StripeLinkResult } from "./stripe-link";

const MARKER: Record<StepState, string> = {
  done: "border-status-healthy bg-status-healthy text-background",
  current: "border-primary bg-primary/15 text-primary",
  waiting: "border-border bg-transparent text-muted-foreground",
};

const URGENCY_CHIP: Record<keyof typeof URGENCY_LABELS, string> = {
  past_due: "border-status-critical/50 bg-status-critical/10 text-status-critical",
  currently_due: "border-status-warning/50 bg-status-warning/10 text-status-warning",
  eventually_due: "border-border bg-accent text-muted-foreground",
};

const CHIP = "font-label inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider";

export function StripeAccountCard({
  tenantId,
  view,
  reload,
  link,
  setLink,
}: Readonly<{ tenantId: string; view: PaymentsView; reload: () => void; link: StripeLink | null; setLink: (link: StripeLink) => void }>) {
  const toast = useToast();
  const [busy, setBusy] = useState<"open" | "copy" | null>(null);
  const steps = stripeSteps(view);
  const requirements = sortRequirements(view.requirements);
  const groups = groupRequirements(requirements);
  const allSet = view.status === "active" && requirements.length === 0;

  async function requestLink(): Promise<StripeLink | null> {
    try {
      const result = await opsApi<StripeLink & { payments: PaymentsView }>(`tenants/${tenantId}/payments/onboarding-link`, { method: "POST", body: "{}" });
      return { url: result.url, expiresAt: result.expiresAt };
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "Could not create the onboarding link." });
      return null;
    }
  }

  async function continueOnStripe() {
    const tab = openBlankTab();
    setBusy("open");
    const next = await requestLink();
    setBusy(null);
    if (!next) {
      tab?.close();
      return;
    }
    if (tab) {
      tab.location.href = next.url;
    } else {
      setLink(next);
      toast({ kind: "error", message: "The browser blocked the new tab. Use Open below." });
    }
    reload();
  }

  async function copyForOwner() {
    setBusy("copy");
    const next = await requestLink();
    setBusy(null);
    if (!next) return;
    setLink(next);
    if (await copyToClipboard(next.url)) toast({ kind: "success", message: "Link copied — it works once and expires in a few minutes" });
    else toast({ kind: "error", message: "Could not copy. Copy the link from the box below." });
    reload();
  }

  return (
    <div className="rounded-lg border border-border/40 bg-card p-5" data-testid="payments-stripe-card">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-headline mr-1 text-lg font-semibold">Stripe account</h2>
        <StatusBadge status={view.status === "restricted" ? "needs info" : view.status} testId="payments-status" />
        {view.stripeAccountId && (
          <span className="font-mono text-xs text-muted-foreground" data-testid="payments-account-id">
            {view.stripeAccountId}
          </span>
        )}
      </div>

      <ol className="mt-5" data-testid="payments-steps">
        {steps.map((step, i) => (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0" data-testid={`payments-step-${step.key}`} data-state={step.state}>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px ${step.state === "done" ? "bg-status-healthy/60" : "bg-border"}`} />
            )}
            <span
              aria-hidden="true"
              className={`relative flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${MARKER[step.state]}`}
            >
              {step.state === "done" ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className="pt-0.5">
              <p className={`text-sm font-semibold ${step.state === "waiting" ? "text-muted-foreground" : "text-foreground"}`}>
                {step.title}
                <span className="sr-only">{step.state === "done" ? " (done)" : step.state === "current" ? " (in progress)" : " (waiting)"}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      {allSet && (
        <p className="mt-5 flex items-center gap-2 text-sm font-medium text-status-healthy" data-testid="payments-all-set">
          <CheckCircle2 aria-hidden="true" className="size-4" /> All set. Stripe needs nothing more.
        </p>
      )}

      {requirements.length > 0 && (
        <div className="mt-6">
          {/* What Stripe rejected stays in view; the full list is a click away (issue #441). */}
          {groups
            .filter((g) => g.problems.length > 0)
            .map((g) => (
              <p key={g.code} className="mb-2 flex items-start gap-1.5 rounded-md bg-status-warning/10 px-2.5 py-1.5 text-xs text-status-warning" data-testid={`payments-problem-${g.code}`}>
                <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                <span>
                  <span className="font-semibold">{g.title}:</span> {g.problems.join(" ")}
                </span>
              </p>
            ))}
          <details open={groups.length <= 3} className="group rounded-lg border border-border/40" data-testid="payments-requirements">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden" data-testid="payments-requirements-toggle">
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              {requirementsSummary(requirements)}
            </summary>
            <ul className="divide-y divide-border/30 border-t border-border/40">
              {groups.map((g) => {
                const blocks = blocksLabel(g.blocks);
                return (
                  <li key={g.code} className="px-4 py-3" data-testid={`payments-requirement-${g.code}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-auto text-sm font-medium">
                        {g.title}
                        {g.count > 1 && <span className="ml-2 text-xs font-normal text-muted-foreground">×{g.count}</span>}
                      </span>
                      <span className={`${CHIP} ${URGENCY_CHIP[g.urgency]}`}>{URGENCY_LABELS[g.urgency]}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {blocks && <span>{blocks} · </span>}
                      <span>Waiting on: {waitingOnLabel(g.waitingOn)}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      )}

      {!allSet && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" data-testid="payments-continue" disabled={busy !== null} onClick={() => void continueOnStripe()}>
            <ExternalLink aria-hidden="true" />
            {busy === "open" ? "Opening..." : view.status === "not_connected" ? "Set up Stripe account" : "Continue on Stripe"}
          </Button>
          <Button size="sm" variant="secondary" data-testid="payments-copy-link" disabled={busy !== null} onClick={() => void copyForOwner()}>
            <Copy aria-hidden="true" />
            {busy === "copy" ? "Working..." : "Copy link for owner"}
          </Button>
        </div>
      )}
      {link && <StripeLinkResult link={link} testId="payments-link" note="Send this link to the restaurant owner. It works once and expires in a few minutes." />}
    </div>
  );
}
