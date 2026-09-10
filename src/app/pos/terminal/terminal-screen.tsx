"use client";

// A browser tab standing in for a card terminal (issue #188 web /
// restiq-backend#130) - the payments sibling of ../printer/printer-screen.tsx.
// Polls the outlet's pending payment intents every 2 s and walks the card
// flow a real terminal walks: present the amount, pick tap / insert / swipe,
// enter a PIN (skipped for a contactless tap under the floor limit),
// process, then show approved or declined.
//
// Only the last step touches the server: it posts the simulated provider's
// webhook (ADR-004) - `simulate { outcome: 'success' }` is the one thing that
// writes the card_terminal tender on the bill, `failure` declines it. The
// method and PIN are terminal-side theatre; nothing in the contract carries
// them, and a real reader would never send a PIN to us anyway.
//
// ponytail: the bank's answer is a two-button simulator strip rather than any
// rule about which PIN is "right" - a wrong-PIN decline would need a stored
// PIN per card, which no part of this demo has.
import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Check, CreditCard, Delete, Nfc, X } from "lucide-react";
import { formatMinor } from "../(shell)/shift/shift-state";
import { listPendingPaymentIntents, simulatePaymentIntent, type PaymentIntentView } from "../api";

const POLL_MS = 2_000;
/** How long "Processing" sits on screen before the outcome, so the flow reads like a real terminal rather than an instant toggle. */
const PROCESSING_MS = 1_200;
/** How long the approved/declined screen stays up before the terminal returns to idle. */
const RESULT_MS = 3_000;

/** Contactless floor limit per currency - a tap above it asks for a PIN, exactly like a real reader. */
const TAP_PIN_LIMIT_MINOR: Record<string, number> = { INR: 500_000, AUD: 20_000 };
const DEFAULT_TAP_PIN_LIMIT_MINOR = 500_000;

const PIN_LENGTH = 4;

type EntryMethod = "tap" | "insert" | "swipe";
type Stage = "entry" | "pin" | "processing" | "result";

const METHODS: { method: EntryMethod; label: string; hint: string; icon: typeof Nfc }[] = [
  { method: "tap", label: "Tap", hint: "Contactless", icon: Nfc },
  { method: "insert", label: "Insert", hint: "Chip", icon: CreditCard },
  { method: "swipe", label: "Swipe", hint: "Magstripe", icon: ArrowRightLeft },
];

function tapNeedsPin(amountMinor: number, currency: string): boolean {
  return amountMinor > (TAP_PIN_LIMIT_MINOR[currency] ?? DEFAULT_TAP_PIN_LIMIT_MINOR);
}

export function TerminalScreen({ outletId, outletName }: Readonly<{ outletId: string; outletName: string }>) {
  const [queue, setQueue] = useState<PaymentIntentView[]>([]);
  const [failed, setFailed] = useState(false);
  const [last, setLast] = useState<PaymentIntentView | null>(null);

  const [stage, setStage] = useState<Stage>("entry");
  const [method, setMethod] = useState<EntryMethod | null>(null);
  const [pin, setPin] = useState("");
  // What the "bank" will answer for the next card - simulator-only chrome.
  const [outcome, setOutcome] = useState<"success" | "failure">("success");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  // Every timer this component starts, cleared on unmount so a settled
  // request never resets a screen that has already gone away.
  useEffect(() => {
    const started = timers.current;
    return () => {
      for (const timer of started) clearTimeout(timer);
    };
  }, []);

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  const current = queue[0] ?? null;

  function resetCard() {
    setStage("entry");
    setMethod(null);
    setPin("");
  }

  function settle(intent: PaymentIntentView, result: "success" | "failure") {
    setStage("processing");
    later(() => {
      simulatePaymentIntent(intent.id, result)
        .then((settled) => {
          setLast(settled);
          setStage("result");
          setQueue((rest) => rest.filter((entry) => entry.id !== intent.id));
          later(resetCard, RESULT_MS);
        })
        .catch(() => {
          setFailed(true);
          resetCard();
        });
    }, PROCESSING_MS);
  }

  function chooseMethod(chosen: EntryMethod) {
    if (!current) return;
    setMethod(chosen);
    if (chosen === "tap" && !tapNeedsPin(current.amountMinor, current.currency)) {
      settle(current, outcome);
      return;
    }
    setStage("pin");
  }

  function pressDigit(digit: string) {
    setPin((entered) => (entered.length >= PIN_LENGTH ? entered : entered + digit));
  }

  function confirmPin() {
    if (!current || pin.length < PIN_LENGTH) return;
    settle(current, outcome);
  }

  function cancel() {
    if (!current) return;
    settle(current, "failure");
  }

  const approved = last?.status === "succeeded";

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

      {stage === "result" && last ? (
        <section
          data-testid="terminal-result"
          className={`flex flex-col items-center gap-3 rounded-lg border p-8 text-center ${approved ? "border-status-available/60 bg-status-available/10" : "border-status-alert/60 bg-status-alert/10"}`}
        >
          <span
            aria-hidden="true"
            className={`flex size-14 items-center justify-center rounded-full ${approved ? "bg-status-available text-background" : "bg-status-alert text-background"}`}
          >
            {approved ? <Check className="size-8" /> : <X className="size-8" />}
          </span>
          <p className={`font-headline text-2xl font-bold ${approved ? "text-status-available" : "text-status-alert"}`}>
            {approved ? "Approved" : "Declined"}
          </p>
          <p data-testid="terminal-last-result" className="text-sm text-muted-foreground">
            {approved ? "Approved" : "Declined"} · {formatMinor(last.amountMinor, last.currency)}
          </p>
          {approved && <p className="text-xs text-muted-foreground">Remove card · keep the receipt</p>}
        </section>
      ) : current ? (
        <section
          data-testid={`terminal-request-${current.id}`}
          className="flex flex-col items-center gap-4 rounded-lg border border-primary/60 bg-popover p-6 text-center"
        >
          <p className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount to pay</p>
          <p data-testid="terminal-amount" className="font-headline text-4xl font-bold tabular-nums text-foreground">
            {formatMinor(current.amountMinor, current.currency)}
          </p>

          {stage === "processing" ? (
            <div data-testid="terminal-processing" className="flex flex-col items-center gap-3 py-6">
              <span aria-hidden="true" className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
              <p className="text-sm text-muted-foreground">Processing… do not remove card</p>
            </div>
          ) : stage === "pin" ? (
            <div data-testid="terminal-pin-pad" className="flex w-full flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">
                Enter PIN
                {method && <span data-testid="terminal-method-in-use"> · {METHODS.find((entry) => entry.method === method)?.hint}</span>}
              </p>
              <div data-testid="terminal-pin-dots" aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`} className="flex gap-3">
                {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                  <span
                    key={index}
                    aria-hidden="true"
                    className={`size-3.5 rounded-full border ${index < pin.length ? "border-primary bg-primary" : "border-border"}`}
                  />
                ))}
              </div>
              <div className="grid w-full grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    data-testid={`terminal-pin-${digit}`}
                    onClick={() => pressDigit(digit)}
                    className="min-h-12 rounded-lg bg-secondary text-lg font-semibold text-secondary-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="terminal-pin-backspace"
                  aria-label="Backspace"
                  onClick={() => setPin((entered) => entered.slice(0, -1))}
                  className="flex min-h-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Delete className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-testid="terminal-pin-0"
                  onClick={() => pressDigit("0")}
                  className="min-h-12 rounded-lg bg-secondary text-lg font-semibold text-secondary-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  0
                </button>
                <button
                  type="button"
                  data-testid="terminal-pin-confirm"
                  disabled={pin.length < PIN_LENGTH}
                  onClick={confirmPin}
                  className="min-h-12 rounded-lg bg-status-available font-semibold text-background disabled:opacity-40"
                >
                  Enter
                </button>
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-3">
              <p className="text-sm text-muted-foreground">Present card</p>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map(({ method: option, label, hint, icon: Icon }) => (
                  <button
                    key={option}
                    type="button"
                    data-testid={`terminal-method-${option}`}
                    onClick={() => chooseMethod(option)}
                    className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="size-6 text-primary" aria-hidden="true" />
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-[11px] text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage !== "processing" && (
            <button
              type="button"
              data-testid="terminal-cancel"
              onClick={stage === "pin" ? resetCard : cancel}
              className="text-xs font-semibold text-status-alert hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {stage === "pin" ? "Cancel PIN" : "Cancel payment"}
            </button>
          )}

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

      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 px-3 py-2">
        <p className="font-label text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Simulator · bank answers</p>
        <div className="flex gap-1">
          <button
            type="button"
            data-testid="terminal-outcome-approve"
            aria-pressed={outcome === "success"}
            onClick={() => setOutcome("success")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${outcome === "success" ? "bg-status-available text-background" : "text-muted-foreground hover:bg-accent"}`}
          >
            Approve
          </button>
          <button
            type="button"
            data-testid="terminal-outcome-decline"
            aria-pressed={outcome === "failure"}
            onClick={() => setOutcome("failure")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${outcome === "failure" ? "bg-status-alert text-background" : "text-muted-foreground hover:bg-accent"}`}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
