"use client";

// The settle / counter screens' half of the simulated card terminal (issue
// #188, restiq-backend#130 - ADR-001/ADR-010). Owns one intent at a time:
// `send` creates it, the effect polls it (immediately, then on
// src/lib/payment-intent.ts's cadence) until it is over, `cancel` closes it
// on the server, `dismiss` clears it locally so the keypad comes back. When
// a poll lands `succeeded` the caller is told once (`onSettled`) so it can
// re-read the bill - the tender the terminal wrote is on the server, never
// invented here.
import { useEffect, useRef, useState } from "react";
import {
  isActiveIntent,
  mergeIntentPoll,
  nextIntentPollMs,
  type PaymentIntentView,
} from "@/lib/payment-intent";
import { cancelPaymentIntent, createPaymentIntent, getPaymentIntent, listPendingPaymentIntents, PosApiError } from "../../../api";

export interface TerminalIntent {
  intent: PaymentIntentView | null;
  busy: boolean;
  error: string | null;
  send: (amountMinor: number) => void;
  cancel: () => void;
  dismiss: () => void;
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

  function adoptWaitingIntent(): Promise<boolean> {
    if (!billId || !outletId) return Promise.resolve(false);
    return listPendingPaymentIntents(outletId).then(
      (pending) => {
        const waiting = pending.find((candidate) => candidate.billId === billId && isActiveIntent(candidate));
        if (waiting) setIntent(waiting);
        return Boolean(waiting);
      },
      () => false,
    );
  }

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
    createPaymentIntent(billId, { rail: "card_terminal", amountMinor, clientKey: crypto.randomUUID() })
      .then(setIntent)
      .catch(async (cause: unknown) => {
        if (cause instanceof PosApiError && cause.code === "intent_active" && (await adoptWaitingIntent())) return;
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

  return { intent, busy, error, send, cancel, dismiss };
}
