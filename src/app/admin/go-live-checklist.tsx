"use client";

// T2 Go-Live Checklist card (CAP-2) - lives outside the app shell until the
// sidebar arrives with a later story. Reload mid-flow shows the same
// progress because state is only ever read fresh from the backend, never
// cached across page loads.
import { CheckCircle2, Circle, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { completeStep, fetchChecklist, goLive, type GoLiveOutcome } from "./api";
import { ChecklistState, STEP_META, countComplete, goLiveMessage, stepLabel } from "./checklist-state";

interface Landed {
  attempt: number;
  checklist: ChecklistState | null;
  failed: boolean;
}

export function GoLiveChecklist() {
  // Loading is derived (no result for the current attempt has landed yet)
  // rather than set directly in the effect, so retry works without a
  // separate flag and the effect never calls setState synchronously.
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<Landed | null>(null);
  const [stepPending, setStepPending] = useState<string | null>(null);
  const [goLivePending, setGoLivePending] = useState(false);
  const [goLiveOutcome, setGoLiveOutcome] = useState<GoLiveOutcome | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchChecklist()
      .then((checklist) => {
        if (!cancelled) setLanded({ attempt, checklist, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLanded({ attempt, checklist: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const current = landed !== null && landed.attempt === attempt ? landed : null;
  const loading = current === null;
  const failed = current?.failed ?? false;
  const checklist = current && !current.failed ? current.checklist : null;

  function retry() {
    setGoLiveOutcome(null);
    setAttempt((n) => n + 1);
  }

  async function handleCompleteStep(key: string) {
    setStepPending(key);
    try {
      const updated = await completeStep(key);
      setLanded({ attempt, checklist: updated, failed: false });
    } catch {
      // the step's action button stays in place so the owner can try again
    }
    setStepPending(null);
  }

  async function handleGoLive() {
    setGoLivePending(true);
    setGoLiveOutcome(await goLive());
    setGoLivePending(false);
  }

  if (loading) {
    return (
      <div
        data-testid="admin-checklist-loading"
        role="status"
        className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground"
      >
        Loading your setup progress...
      </div>
    );
  }

  if (failed || checklist === null) {
    return (
      <div
        data-testid="admin-checklist-error"
        role="alert"
        className="flex flex-col items-center gap-3 rounded-xl border border-status-error/40 bg-card p-8 text-center"
      >
        <p className="text-sm text-muted-foreground">We couldn&apos;t load your setup progress.</p>
        <Button variant="secondary" size="sm" data-testid="admin-checklist-retry" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }

  if (goLiveOutcome?.ok) {
    return (
      <div
        data-testid="admin-checklist-go-live-success"
        className="flex flex-col items-center gap-3 rounded-xl border border-status-active/40 bg-card p-10 text-center"
      >
        <PartyPopper className="size-8 text-status-active" aria-hidden="true" />
        <h2 className="font-headline text-xl font-semibold">You&apos;re live!</h2>
        <p className="text-sm text-muted-foreground">RESTIQ is ready to take orders for your outlet.</p>
      </div>
    );
  }

  const complete = countComplete(checklist.steps);
  const reason = goLiveMessage(checklist.canGoLive, checklist.steps);

  return (
    <div className="rounded-xl border border-border bg-card p-8">
      <div className="flex items-center gap-4">
        <ProgressRing complete={complete} total={checklist.steps.length} />
        <div>
          <h1 className="font-headline text-xl font-semibold">Let&apos;s get you set up</h1>
          <p data-testid="admin-checklist-progress" className="text-sm text-muted-foreground">
            {complete}/{checklist.steps.length}
          </p>
        </div>
      </div>

      <ul data-testid="admin-checklist-steps" className="mt-8 space-y-3">
        {checklist.steps.map((step) => {
          const meta = STEP_META[step.step];
          const done = step.completed;
          return (
            <li
              key={step.step}
              data-testid={`admin-checklist-step-${step.step}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-status-active" aria-hidden="true" />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <div>
                  <p className="text-sm font-medium">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
              </div>
              <span data-testid={`admin-checklist-step-${step.step}-status`} className="sr-only">
                {done ? "Done" : "Not started"}
              </span>
              {meta.action === "complete"
                ? !done && (
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid={`admin-checklist-step-${step.step}-action`}
                      disabled={stepPending === step.step}
                      onClick={() => void handleCompleteStep(step.step)}
                    >
                      {stepPending === step.step ? "Saving..." : "Mark as complete"}
                    </Button>
                  )
                : (
                    <Button asChild size="sm" variant={done ? "outline" : "default"} data-testid={`admin-checklist-step-${step.step}-action`}>
                      <Link href={meta.href ?? "#"}>{done ? "Review" : "Start"}</Link>
                    </Button>
                  )}
            </li>
          );
        })}
      </ul>

      {goLiveOutcome && !goLiveOutcome.ok && (
        <p data-testid="admin-checklist-go-live-blocked" role="alert" className="mt-4 text-sm text-error-soft">
          {goLiveOutcome.missingSteps?.length
            ? `Still needed: ${goLiveOutcome.missingSteps.map(stepLabel).join(", ")}.`
            : "Something went wrong going live. Check your connection and try again."}
        </p>
      )}

      <div className="mt-8 flex flex-col items-center gap-2">
        <Button
          data-testid="admin-checklist-go-live"
          disabled={!checklist.canGoLive || goLivePending}
          aria-describedby={reason ? "admin-checklist-go-live-reason" : undefined}
          title={reason ?? undefined}
          className="w-full py-6 text-base font-semibold"
          onClick={() => void handleGoLive()}
        >
          {goLivePending ? "Going live..." : "Go live"}
        </Button>
        {reason && (
          <p id="admin-checklist-go-live-reason" data-testid="admin-checklist-go-live-reason" className="text-xs text-muted-foreground">
            {reason}
          </p>
        )}
      </div>
    </div>
  );
}

function ProgressRing({ complete, total }: Readonly<{ complete: number; total: number }>) {
  const size = 56;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total === 0 ? 0 : complete / total;
  const offset = circumference * (1 - fraction);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label={`${complete} of ${total} steps complete`}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
