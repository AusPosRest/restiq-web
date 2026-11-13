// Where Stripe sends people after onboarding or card setup (#425, restiq-backend#284).
// Public: no ops chrome. The proxy matcher doesn't cover /stripe, so nothing intercepts it.
// Reads only whether the ops cookie exists (never its value) to pick where to send them
// next; cookies() also keeps the page dynamic, so one visitor's answer is never cached for another.
import { Clock, X } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { OPS_SESSION_COOKIE } from "@/lib/ops-session";
import { DoneKind, doneResult } from "./done-state";
import { RedirectCountdown } from "./redirect-countdown";

export const metadata: Metadata = { title: "RESTIQ", robots: { index: false } };
export const dynamic = "force-dynamic";

type Params = Record<"flow" | "tenant" | "slug" | "cancelled", string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function StripeDonePage({ searchParams }: Readonly<{ searchParams: Promise<Partial<Params>> }>) {
  const params = await searchParams;
  const isOperator = (await cookies()).has(OPS_SESSION_COOKIE);
  const result = doneResult({
    flow: one(params.flow),
    tenant: one(params.tenant),
    slug: one(params.slug),
    cancelled: one(params.cancelled),
    isOperator,
    baseDomain: process.env.NEXT_PUBLIC_BASE_DOMAIN,
  });

  return (
    <main className="ops-theme flex min-h-screen flex-1 items-center justify-center bg-background p-6 text-foreground" data-testid="stripe-done" data-kind={result.kind}>
      <div className="flex max-w-md flex-col items-center text-center">
        <DoneIcon kind={result.kind} />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight" data-testid="stripe-done-title">
          {result.title}
        </h1>
        <p className="mt-2 text-base text-muted-foreground" data-testid="stripe-done-message">
          {result.line}
        </p>
        {result.href ? (
          <RedirectCountdown href={result.href} seconds={result.seconds} />
        ) : (
          <p className="mt-8 text-sm text-muted-foreground" data-testid="stripe-done-close">
            You can close this page.
          </p>
        )}
      </div>
    </main>
  );
}

function DoneIcon({ kind }: Readonly<{ kind: DoneKind }>) {
  if (kind === "success") {
    return (
      <span className="flex size-24 items-center justify-center rounded-full bg-status-healthy/15 ring-1 ring-status-healthy/40 motion-safe:animate-[done-pop_400ms_cubic-bezier(.2,.9,.3,1.3)_both]">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-12 text-status-healthy">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={1}
            className="motion-safe:animate-[done-draw_450ms_ease-out_300ms_both]"
          />
        </svg>
        <span className="sr-only">Done</span>
      </span>
    );
  }
  const Icon = kind === "cancelled" ? X : Clock;
  return (
    <span className="flex size-24 items-center justify-center rounded-full bg-accent ring-1 ring-border">
      <Icon aria-hidden="true" className="size-11 text-muted-foreground" />
    </span>
  );
}
