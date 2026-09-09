"use client";

// What the tender column shows while a card-terminal intent exists (issue
// #188): waiting (amount, countdown, Cancel), checking (the clock ran out
// but the server hasn't said expired yet - ADR-011 means it may still
// succeed), approved (Done returns to the keypad), or declined / timed out /
// cancelled (Try again). Phase logic is electronic-tender-state.ts's
// intentPanelPhase; only the rendering lives here.
import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCountdown, INTENT_STATUS_LABEL, intentExpiresInMs, isAwaitingServerExpiry, type PaymentIntentView } from "@/lib/payment-intent";
import { formatMinor } from "../../../(shell)/shift/shift-state";
import { intentPanelPhase } from "./electronic-tender-state";

export interface TerminalIntentPanelProps {
  intent: PaymentIntentView;
  currency: string;
  busy: boolean;
  onCancel: () => void;
  onDismiss: () => void;
}

export function TerminalIntentPanel({ intent, currency, busy, onCancel, onDismiss }: Readonly<TerminalIntentPanelProps>) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const phase = intentPanelPhase(intent, isAwaitingServerExpiry(intent, now));

  return (
    <section data-testid="intent-panel" data-phase={phase} className="flex min-h-fit flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <CreditCard className={`size-8 ${phase === "paid" ? "text-status-available" : phase === "retry" ? "text-status-alert" : "text-primary"}`} aria-hidden="true" />
      <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Card terminal</p>
      <p data-testid="intent-amount" className="font-headline text-3xl font-bold tabular-nums text-foreground">
        {formatMinor(intent.amountMinor, currency)}
      </p>
      <p data-testid="intent-status" role="status" className={`text-sm ${phase === "retry" ? "text-status-alert" : "text-muted-foreground"}`}>
        {phase === "checking" ? "Checking with the terminal…" : INTENT_STATUS_LABEL[intent.status]}
        {phase === "retry" && intent.failureReason === "declined" ? " - the card was declined" : ""}
      </p>

      {phase === "showing" && (
        <>
          <p data-testid="intent-countdown" className="font-mono text-sm tabular-nums text-muted-foreground">
            {formatCountdown(intentExpiresInMs(intent, now))}
          </p>
          <Button variant="outline" data-testid="intent-cancel" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </>
      )}
      {phase === "paid" && (
        <Button data-testid="intent-dismiss" onClick={onDismiss}>
          Done
        </Button>
      )}
      {phase === "retry" && (
        <Button variant="outline" data-testid="intent-retry" onClick={onDismiss}>
          Try again
        </Button>
      )}
    </section>
  );
}
