"use client";

// A browser tab standing in for a card terminal (issue #188 web /
// restiq-backend#130) - the payments sibling of ../printer/printer-screen.tsx.
// Polls the outlet's pending payment intents every 2 s, shows the oldest one
// as "tap your card", and its two buttons are the simulated provider's
// webhook (ADR-004): Approve posts `simulate { outcome: 'success' }`, which
// is the one thing that writes the card_terminal tender on the bill; Decline
// posts failure. Stale-on-failure like the printer: a failed poll never
// blanks the request, it just flips the status light.
import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { formatMinor } from "../(shell)/shift/shift-state";
import { listPendingPaymentIntents, simulatePaymentIntent, type PaymentIntentView } from "../api";

const POLL_MS = 2_000;

export function TerminalScreen({ outletId, outletName }: Readonly<{ outletId: string; outletName: string }>) {
  const [queue, setQueue] = useState<PaymentIntentView[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<PaymentIntentView | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const pending = await listPendingPaymentIntents(outletId);
        if (cancelled) return;
        setFailed(false);
        setQueue(pending);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [outletId]);

  const current = queue[0] ?? null;

  function decide(outcome: "success" | "failure") {
    if (!current) return;
    setBusy(true);
    simulatePaymentIntent(current.id, outcome)
      .then((result) => {
        setLast(result);
        setQueue((rest) => rest.filter((intent) => intent.id !== current.id));
      })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  }

  return (
    <div data-testid="terminal-screen" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" aria-hidden="true" />
          <div>
            <p className="font-headline text-sm font-semibold">Card terminal</p>
            <p className="text-xs text-muted-foreground">{outletName || "No outlet"} · simulated</p>
          </div>
        </div>
        <span
          data-testid="terminal-status"
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${failed ? "bg-status-error/15 text-status-error" : "bg-accent text-status-available"}`}
        >
          <span aria-hidden="true" className="size-2 rounded-full bg-current" />
          {failed ? "Reconnecting" : "Ready"}
        </span>
      </header>

      {current ? (
        <section data-testid={`terminal-request-${current.id}`} className="flex flex-col items-center gap-4 rounded-lg border border-primary/60 bg-popover p-6 text-center">
          <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount to pay</p>
          <p data-testid="terminal-amount" className="font-headline text-4xl font-bold tabular-nums text-foreground">
            {formatMinor(current.amountMinor, current.currency)}
          </p>
          <p className="text-sm text-muted-foreground">Tap, insert or swipe card</p>
          <div className="grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="terminal-approve"
              disabled={busy}
              onClick={() => decide("success")}
              className="min-h-14 rounded-lg bg-status-available px-4 text-base font-semibold text-background disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              data-testid="terminal-decline"
              disabled={busy}
              onClick={() => decide("failure")}
              className="min-h-14 rounded-lg border border-status-alert px-4 text-base font-semibold text-status-alert disabled:opacity-50"
            >
              Decline
            </button>
          </div>
          {queue.length > 1 && (
            <p data-testid="terminal-queue-depth" className="text-xs text-muted-foreground">
              {queue.length - 1} more waiting
            </p>
          )}
        </section>
      ) : (
        <p data-testid="terminal-idle" className="py-16 text-center text-sm text-muted-foreground">
          Waiting for a payment…
        </p>
      )}

      {last && (
        <p data-testid="terminal-last-result" className={`text-center text-sm ${last.status === "succeeded" ? "text-status-available" : "text-status-alert"}`}>
          {last.status === "succeeded" ? "Approved" : "Declined"} · {formatMinor(last.amountMinor, last.currency)}
        </p>
      )}
    </div>
  );
}
