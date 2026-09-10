"use client";

// A browser tab standing in for a card terminal (issue #188 web /
// restiq-backend#130) - the payments sibling of ../printer/printer-screen.tsx.
// Polls the outlet's pending payment intents every 2 s and walks the flow a
// real reader walks: pick a payment method, present the card (tap / insert /
// swipe), enter a PIN, process, then approved or declined.
//
// Drawn as the physical device rather than a web panel (issue #198): a body,
// a brand bar with a status LED, an inset screen, and reader hardware along
// the bottom edge. Everything a person would touch lives inside the screen;
// the simulator control sits outside the device, where a real bank's answer
// would come from.
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
import { ArrowRightLeft, CalendarClock, Check, CreditCard, Delete, Nfc, QrCode, Wallet, X } from "lucide-react";
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
type Stage = "rail" | "entry" | "pin" | "processing" | "result";

/**
 * The four buttons a terminal opens with. Only cards are wired up:
 * `card_terminal` is the only rail the backend mints intents for
 * (`INTENT_RAILS`), so the rest are drawn the way the device draws them and
 * say so when pressed, rather than charging on a rail that would then be
 * recorded as a card.
 */
const RAILS: { rail: string; label: string; icon: typeof QrCode; enabled: boolean }[] = [
  { rail: "upi", label: "UPI", icon: QrCode, enabled: false },
  { rail: "cards", label: "Cards", icon: CreditCard, enabled: true },
  { rail: "wallets", label: "Wallets", icon: Wallet, enabled: false },
  { rail: "emi", label: "EMI", icon: CalendarClock, enabled: false },
];

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

  const [stage, setStage] = useState<Stage>("rail");
  const [method, setMethod] = useState<EntryMethod | null>(null);
  const [pin, setPin] = useState("");
  const [railNote, setRailNote] = useState<string | null>(null);
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
    setStage("rail");
    setMethod(null);
    setPin("");
    setRailNote(null);
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

  function chooseRail(enabled: boolean) {
    if (!enabled) {
      setRailNote("Only card payments are wired up on this terminal yet.");
      return;
    }
    setRailNote(null);
    setStage("entry");
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

  /** Back one step while the customer is still choosing; on the first screen it declines the payment outright, as a terminal's red key does. */
  function onCancel() {
    if (stage === "pin") {
      setStage("entry");
      setPin("");
      return;
    }
    if (stage === "entry") {
      resetCard();
      return;
    }
    if (current) settle(current, "failure");
  }

  const approved = last?.status === "succeeded";
  const cancelLabel = stage === "pin" ? "Cancel PIN" : stage === "entry" ? "Back" : "Cancel payment";

  return (
    <div data-testid="terminal-screen" className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 p-4">
      {/* The device itself: body, brand bar, inset screen, reader hardware. */}
      <div
        data-testid="terminal-device"
        className="rounded-[2rem] bg-gradient-to-b from-zinc-200 via-zinc-100 to-zinc-300 p-3 shadow-2xl ring-1 ring-black/20"
      >
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-600">
            Restiq <span className="text-amber-600">Pay</span>
          </span>
          <span
            data-testid="terminal-status"
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600"
          >
            <span aria-hidden="true" className={`size-2 rounded-full ${failed ? "bg-red-500" : "bg-emerald-500"}`} />
            {failed ? "Reconnecting" : "Ready"}
          </span>
        </div>

        <div className="flex min-h-[26rem] flex-col rounded-2xl bg-zinc-950 p-4 text-center shadow-inner ring-1 ring-black/50">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{outletName || "No outlet"}</p>

          {stage === "result" && last ? (
            <section data-testid="terminal-result" className="flex flex-1 flex-col items-center justify-center gap-3">
              <span
                aria-hidden="true"
                className={`flex size-16 items-center justify-center rounded-full ${approved ? "bg-emerald-500 text-zinc-950" : "bg-red-500 text-zinc-950"}`}
              >
                {approved ? <Check className="size-9" /> : <X className="size-9" />}
              </span>
              <p className={`font-headline text-2xl font-bold ${approved ? "text-emerald-400" : "text-red-400"}`}>
                {approved ? "Approved" : "Declined"}
              </p>
              <p data-testid="terminal-last-result" className="text-sm text-zinc-400">
                {approved ? "Approved" : "Declined"} · {formatMinor(last.amountMinor, last.currency)}
              </p>
              {approved && <p className="text-xs text-zinc-500">Remove card · keep the receipt</p>}
            </section>
          ) : current ? (
            <section data-testid={`terminal-request-${current.id}`} className="flex flex-1 flex-col items-center gap-4">
              <div className="pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Amount to pay</p>
                <p data-testid="terminal-amount" className="font-headline text-4xl font-bold tabular-nums text-zinc-50">
                  {formatMinor(current.amountMinor, current.currency)}
                </p>
              </div>

              {stage === "processing" ? (
                <div data-testid="terminal-processing" className="flex flex-1 flex-col items-center justify-center gap-3">
                  <span aria-hidden="true" className="size-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
                  <p className="text-sm text-zinc-400">Processing… do not remove card</p>
                </div>
              ) : stage === "pin" ? (
                <div data-testid="terminal-pin-pad" className="flex w-full flex-1 flex-col items-center gap-3">
                  <p className="text-sm text-zinc-400">
                    Enter PIN
                    {method && <span data-testid="terminal-method-in-use"> · {METHODS.find((entry) => entry.method === method)?.hint}</span>}
                  </p>
                  <div data-testid="terminal-pin-dots" aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`} className="flex gap-3">
                    {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                      <span
                        key={index}
                        aria-hidden="true"
                        className={`size-3.5 rounded-full border ${index < pin.length ? "border-amber-500 bg-amber-500" : "border-zinc-700"}`}
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
                        className="min-h-11 rounded-lg bg-zinc-800 text-lg font-semibold text-zinc-100 hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      data-testid="terminal-pin-backspace"
                      aria-label="Backspace"
                      onClick={() => setPin((entered) => entered.slice(0, -1))}
                      className="flex min-h-11 items-center justify-center rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      <Delete className="size-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      data-testid="terminal-pin-0"
                      onClick={() => pressDigit("0")}
                      className="min-h-11 rounded-lg bg-zinc-800 text-lg font-semibold text-zinc-100 hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      data-testid="terminal-pin-confirm"
                      disabled={pin.length < PIN_LENGTH}
                      onClick={confirmPin}
                      className="min-h-11 rounded-lg bg-emerald-500 font-semibold text-zinc-950 disabled:opacity-40"
                    >
                      Enter
                    </button>
                  </div>
                </div>
              ) : stage === "entry" ? (
                <div className="flex w-full flex-1 flex-col gap-3">
                  <p className="text-sm text-zinc-400">Present card</p>
                  <div className="grid grid-cols-3 gap-2">
                    {METHODS.map(({ method: option, label, hint, icon: Icon }) => (
                      <button
                        key={option}
                        type="button"
                        data-testid={`terminal-method-${option}`}
                        onClick={() => chooseMethod(option)}
                        className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl bg-zinc-900 ring-1 ring-zinc-800 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        <Icon className="size-6 text-amber-500" aria-hidden="true" />
                        <span className="text-sm font-semibold text-zinc-100">{label}</span>
                        <span className="text-[11px] text-zinc-500">{hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex w-full flex-1 flex-col gap-3">
                  <p className="text-sm text-zinc-400">Select payment method</p>
                  <div className="grid grid-cols-2 gap-2">
                    {RAILS.map(({ rail, label, icon: Icon, enabled }) => (
                      <button
                        key={rail}
                        type="button"
                        data-testid={`terminal-rail-${rail}`}
                        aria-disabled={!enabled}
                        onClick={() => chooseRail(enabled)}
                        className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                          enabled ? "bg-zinc-900 ring-zinc-800 hover:bg-zinc-800" : "bg-zinc-900/40 ring-zinc-900 opacity-50"
                        }`}
                      >
                        <Icon className={`size-6 ${enabled ? "text-amber-500" : "text-zinc-600"}`} aria-hidden="true" />
                        <span className={`text-sm font-semibold ${enabled ? "text-zinc-100" : "text-zinc-500"}`}>{label}</span>
                      </button>
                    ))}
                  </div>
                  {railNote && (
                    <p data-testid="terminal-rail-note" role="status" className="text-xs text-amber-500">
                      {railNote}
                    </p>
                  )}
                </div>
              )}

              {stage !== "processing" && (
                <button
                  type="button"
                  data-testid="terminal-cancel"
                  onClick={onCancel}
                  className="text-xs font-semibold text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  {cancelLabel}
                </button>
              )}

              {queue.length > 1 && (
                <p data-testid="terminal-queue-depth" className="text-[11px] text-zinc-500">
                  {queue.length - 1} more waiting
                </p>
              )}
            </section>
          ) : (
            <div data-testid="terminal-idle" className="flex flex-1 flex-col items-center justify-center gap-2">
              <CreditCard className="size-8 text-zinc-700" aria-hidden="true" />
              <p className="text-sm text-zinc-500">Waiting for a payment…</p>
            </div>
          )}
        </div>

        {/* Reader hardware along the bottom edge: contactless arc and card slot. */}
        <div className="flex items-center justify-between px-3 pb-1 pt-3" aria-hidden="true">
          <Nfc className="size-4 text-zinc-500" />
          <span className="h-1.5 w-28 rounded-full bg-zinc-400 shadow-inner" />
          <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Insert</span>
        </div>
      </div>

      {/* Outside the device: the bank's answer, which a real terminal never chooses. */}
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
