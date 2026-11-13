"use client";

// The settle / counter screens' half of the simulated card terminal (issue
// #188, restiq-backend#130 - ADR-001/ADR-010). Owns one intent at a time:
// `send` creates it, the effect polls it (immediately, then on
// src/lib/payment-intent.ts's cadence) until it is over, `cancel` closes it
// on the server, `dismiss` clears it locally so the keypad comes back. When
// a poll lands `succeeded` the caller is told once (`onSettled`) so it can
// re-read the bill - the tender the terminal wrote is on the server, never
// invented here.
//
// No terminal (issue #407): the POS has no device list of its own, so the
// first `no_terminal` refusal is the signal - `available` turns false and
// stays false for this tab's session, and callers stop offering the option.
//
// Stripe readers (restiq-web#429): when the outlet has registered readers the
// intent goes to the picked one (`readerId`), the server drives the reader,
// and the same poll below sees it succeed or fail. `simulate` presents a test
// card on a sandbox reader; the first 404 means a live key and hides it.
import { useEffect, useRef, useState } from "react";
import {
  isActiveIntent,
  mergeIntentPoll,
  nextIntentPollMs,
  type PaymentIntentView,
} from "@/lib/payment-intent";
import {
  cancelPaymentIntent,
  createPaymentIntent,
  getPaymentIntent,
  listCardReaders,
  getActiveBillIntent,
  listPendingPaymentIntents,
  PosApiError,
  simulatePaymentIntent,
  type CardReaderView,
} from "../../../api";
import { defaultReaderId, readRememberedReader, rememberReader } from "./card-reader-state";

// Same per-tab, best-effort storage posture as terminal-binding.ts.
const NO_TERMINAL_KEY = "pos:no-terminal";

function readNoTerminal(): boolean {
  try {
    return window.sessionStorage.getItem(NO_TERMINAL_KEY) === "1";
  } catch {
    return false;
  }
}

function saveNoTerminal(): void {
  try {
    window.sessionStorage.setItem(NO_TERMINAL_KEY, "1");
  } catch {
    // Best-effort - this screen still hides the option until it unmounts.
  }
}

export interface TerminalIntent {
  intent: PaymentIntentView | null;
  /** False once the server said this till has no card terminal (issue #407). */
  available: boolean;
  busy: boolean;
  error: string | null;
  send: (amountMinor: number) => void;
  cancel: () => void;
  dismiss: () => void;
  /** The outlet's Stripe readers - empty means the simulated terminal (today's flow). */
  readers: CardReaderView[];
  readerId: string | null;
  selectReader: (readerId: string) => void;
  /** False once the server 404'd a simulate call (live key) - hide the test buttons. */
  sandbox: boolean;
  simulate: (outcome: "approve" | "decline") => void;
}

/**
 * `outletId` (restiq-web#343, PE-22/CU-13): lets the hook find a card payment
 * already waiting on the terminal for this bill - after a reload, or when a
 * send is refused because one is already waiting - so the waiting state with
 * its Cancel comes back instead of a dead end.
 */
export function useTerminalIntent(billId: string | null, onSettled: () => void, outletId?: string): TerminalIntent {
  const [intent, setIntent] = useState<PaymentIntentView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(() => !readNoTerminal());
  const [readers, setReaders] = useState<CardReaderView[]>([]);
  const [readerId, setReaderId] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState(true);
  const settledFor = useRef<string | null>(null);
  // Latest callback without re-arming the effects below on every render.
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  });

  // Poll while the intent is still open. Keyed on the intent id so a retry
  // (a new intent) restarts the loop; a terminal status ends it.
  const intentId = intent?.id ?? null;
  const active = isActiveIntent(intent);
  useEffect(() => {
    if (!intentId || !active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    function poll() {
      getPaymentIntent(intentId as string)
        .then((next) => {
          if (cancelled) return;
          setIntent((current) => mergeIntentPoll(current, next));
          if (!isActiveIntent(next)) return;
          timer = setTimeout(poll, nextIntentPollMs(Date.now() - startedAt));
        })
        .catch(() => {
          if (cancelled) return;
          timer = setTimeout(poll, nextIntentPollMs(Date.now() - startedAt));
        });
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [intentId, active]);

  // A payment already waiting for this bill: the per-bill read (#286) also finds Stripe reader
  // payments, which never sit in the terminal queue; an older API without it falls back to the queue.
  function adoptWaitingIntent(): Promise<boolean> {
    if (!billId) return Promise.resolve(false);
    const adopt = (waiting: PaymentIntentView | null | undefined): boolean => {
      if (waiting && isActiveIntent(waiting)) setIntent(waiting);
      return Boolean(waiting && isActiveIntent(waiting));
    };
    return getActiveBillIntent(billId).then(
      ({ intent: waiting }) => adopt(waiting),
      () =>
        outletId
          ? listPendingPaymentIntents(outletId).then(
              (pending) => adopt(pending.find((candidate) => candidate.billId === billId && isActiveIntent(candidate))),
              () => false,
            )
          : false,
    );
  }

  // Readers for this outlet; any failure leaves the list empty (the simulated terminal).
  useEffect(() => {
    if (!outletId) return;
    let cancelled = false;
    listCardReaders(outletId)
      .then(({ readers: loaded }) => {
        if (cancelled) return;
        setReaders(loaded);
        setReaderId(defaultReaderId(loaded, readRememberedReader(outletId)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [outletId]);

  // A payment already waiting for this bill (e.g. before a reload) shows again.
  useEffect(() => {
    void adoptWaitingIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId, outletId]);

  // Tell the caller exactly once per intent that money landed.
  useEffect(() => {
    if (intent?.status !== "succeeded" || settledFor.current === intent.id) return;
    settledFor.current = intent.id;
    onSettledRef.current();
  }, [intent]);

  function send(amountMinor: number) {
    if (!billId) return;
    setBusy(true);
    setError(null);
    createPaymentIntent(billId, {
      rail: "card_terminal",
      amountMinor,
      clientKey: crypto.randomUUID(),
      ...(readers.length > 0 && readerId ? { readerId } : {}),
    })
      .then(setIntent)
      .catch(async (cause: unknown) => {
        if (cause instanceof PosApiError && cause.code === "intent_active" && (await adoptWaitingIntent())) return;
        if (cause instanceof PosApiError && cause.code === "no_terminal") {
          saveNoTerminal();
          setAvailable(false);
        }
        setError(cause instanceof PosApiError ? cause.message : "Couldn't reach the card terminal. Choose another way to pay, or try again.");
      })
      .finally(() => setBusy(false));
  }

  function cancel() {
    if (!intent) return;
    setBusy(true);
    cancelPaymentIntent(intent.id)
      .then((next) => setIntent((current) => mergeIntentPoll(current, next)))
      .catch((cause: unknown) => setError(cause instanceof PosApiError ? cause.message : "Couldn't cancel the terminal request."))
      .finally(() => setBusy(false));
  }

  function dismiss() {
    setIntent(null);
    setError(null);
  }

  function selectReader(next: string) {
    setReaderId(next);
    if (outletId) rememberReader(outletId, next);
  }

  function simulate(outcome: "approve" | "decline") {
    if (!intent) return;
    setBusy(true);
    setError(null);
    simulatePaymentIntent(intent.id, outcome === "approve" ? "success" : "failure")
      .then((next) => setIntent((current) => mergeIntentPoll(current, next)))
      .catch((cause: unknown) => {
        if (cause instanceof PosApiError && cause.status === 404) setSandbox(false);
        else setError(cause instanceof PosApiError ? cause.message : "Couldn't reach the card reader.");
      })
      .finally(() => setBusy(false));
  }

  // Readers stand in for the simulated terminal, so a past `no_terminal` doesn't hide them.
  return { intent, available: available || readers.length > 0, busy, error, send, cancel, dismiss, readers, readerId, selectReader, sandbox, simulate };
}
