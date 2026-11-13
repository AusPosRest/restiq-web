"use client";

// Pay by card on the guest's phone (issue #427, restiq-backend#284): Stripe's Payment
// Element on the restaurant's connected account. Opened in place of the simulated
// outcome picker whenever the bill carries `cardPayments`.
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useEffect, useEffectEvent, useState } from "react";
import { GuestApiError } from "../api-client";
import { startCardPayment, syncCardPayment, type CardPaymentsConfig, type CardPaymentStart, type GuestBillView } from "./checkout-api";
import { cardReturnUrl, syncUntilPaid, walletOptions } from "./card-payment-state";

// One Stripe.js instance per key + connected account (loadStripe must not run per render).
const stripeByAccount = new Map<string, Promise<Stripe | null>>();
function stripeFor(config: CardPaymentsConfig): Promise<Stripe | null> {
  const key = `${config.publishableKey}:${config.stripeAccountId}`;
  let stripe = stripeByAccount.get(key);
  if (!stripe) {
    stripe = loadStripe(config.publishableKey, { stripeAccount: config.stripeAccountId });
    stripeByAccount.set(key, stripe);
  }
  return stripe;
}

export interface CardSheetProps {
  billId: string;
  /** Set to pay this guest's share; null pays the whole bill. */
  guestId: string | null;
  myGuestId: string;
  amountLabel: string;
  config: CardPaymentsConfig;
  onPaid: (bill: GuestBillView) => void;
  /** Stripe took the money but the bill hasn't caught up yet. */
  onPending: (intentId: string, bill: GuestBillView | null) => void;
  onSessionEnded: () => void;
  onCancel: () => void;
}

export function CardPaymentSheet(props: Readonly<CardSheetProps>) {
  const { billId, guestId, config, amountLabel, onSessionEnded, onCancel } = props;
  const [start, setStart] = useState<CardPaymentStart | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const sessionEnded = useEffectEvent(onSessionEnded);

  useEffect(() => {
    let cancelled = false;
    startCardPayment(billId, guestId ? { guestId } : {})
      .then((value) => {
        if (!cancelled) setStart(value);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof GuestApiError && error.status === 410) {
          sessionEnded();
          return;
        }
        setStartError(error instanceof GuestApiError ? error.message : "Couldn't start the card payment - please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [billId, guestId]);

  return (
    <div
      data-testid="checkout-card-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Pay by card"
      className="fixed inset-x-0 bottom-0 z-10 max-h-[90vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-6 shadow-lg"
    >
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-muted-foreground">{guestId ? "Your share" : "The whole bill"}</p>
        <p className="font-headline text-xl font-bold tabular-nums text-foreground">{amountLabel}</p>
      </div>

      {startError ? (
        <p role="alert" data-testid="checkout-card-error" className="mt-4 text-sm text-error-soft">
          {startError}
        </p>
      ) : start ? (
        <Elements stripe={stripeFor(config)} options={{ clientSecret: start.clientSecret }}>
          <CardPayForm {...props} intentId={start.intentId} />
        </Elements>
      ) : (
        <p role="status" data-testid="checkout-card-loading" className="mt-4 text-sm text-muted-foreground">
          Getting card payment ready…
        </p>
      )}

      {/* While Elements is loading or start failed the form's own Cancel isn't there. */}
      {start ? null : <CancelButton onCancel={onCancel} disabled={false} />}
    </div>
  );
}

function CardPayForm({ intentId, myGuestId, config, onPaid, onPending, onCancel }: Readonly<CardSheetProps & { intentId: string }>) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: cardReturnUrl(window.location.href, intentId) },
    });
    if (result.error) {
      setError(result.error.message ?? "Your card payment didn't go through - please try again.");
      setBusy(false);
      return;
    }
    try {
      const { bill, paid } = await syncUntilPaid(() => syncCardPayment(intentId), myGuestId);
      if (paid) onPaid(bill);
      else onPending(intentId, bill);
    } catch {
      // Stripe has the money; the bill read failed. The pending notice offers a refresh.
      onPending(intentId, null);
    }
  }

  return (
    <form
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        void pay();
      }}
    >
      <PaymentElement options={{ wallets: walletOptions(config.allowedMethods) }} />
      {error ? (
        <p role="alert" data-testid="checkout-card-error" className="mt-3 text-sm text-error-soft">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        data-testid="checkout-card-pay"
        disabled={!stripe || !elements || busy}
        className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {busy ? "Paying…" : "Pay"}
      </button>
      <CancelButton onCancel={onCancel} disabled={busy} />
    </form>
  );
}

function CancelButton({ onCancel, disabled }: Readonly<{ onCancel: () => void; disabled: boolean }>) {
  return (
    <button
      type="button"
      data-testid="checkout-card-cancel"
      disabled={disabled}
      onClick={onCancel}
      className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      Cancel
    </button>
  );
}

/** "Payment received — updating your bill", with a refresh that asks the server to read Stripe again. */
export function CardPendingNotice({ onRefresh }: Readonly<{ onRefresh: () => Promise<void> }>) {
  const [busy, setBusy] = useState(false);
  return (
    <div data-testid="checkout-card-pending" role="status" className="mt-6 rounded-xl border border-border bg-card p-4 text-center">
      <p className="text-sm font-medium text-foreground">Payment received — updating your bill</p>
      <button
        type="button"
        data-testid="checkout-card-refresh"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void onRefresh().finally(() => setBusy(false));
        }}
        className="mt-3 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {busy ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
