"use client";

// Q6 Checkout and split payment, simulated (CAP-5, issue #84). Against the
// real, merged backend contract (restiq-backend PR #84,
// src/guest/bills/bills.{dtos,controller,service}.ts, read directly): the
// table settles either as one payment ("Pay for the table") or per-guest
// ("Split by guest"), through a payment step that is explicitly demo-marked
// in the DOM (same honesty posture as pos's PrinterStatusChip "(demo)"
// label) - the simulated success/failure choice is a demo control, never
// dressed up as a real UPI flow, per SPEC-qr-self-order's CAP-5 non-goal ("no
// real payment integration").
//
// UJ-5's invariant (the spec's own acceptance narrative): a simulated
// failure leaves the targeted share outstanding and every other guest's
// paid share untouched - rendered here as a calm, non-error retry note
// (checkout-share-failed-*), never role="alert" red text, matching the
// backend's own posture that `simulatedOutcome: 'failure'` is a normal 200,
// not a server error.
//
// The signed-in guest's own share is the only row this screen ever renders
// a Pay action for - other guests' rows are read-only status, even though
// the backend itself places no ownership check on `payShare`'s `:guestId`
// param (any guest may technically pay any share, or pay-all) - this UI
// simply never exposes that button for someone else's row.
import { useEffect, useState } from "react";
import { GuestApiError } from "../api-client";
import { SessionEndedView } from "../session-ended-view";
import { createOrFetchBill, payAll, payShare, type BillShareView, type GuestBillView, type SimulatedOutcome } from "./checkout-api";
import { canPayAll, findShare, formatRupees, isSettled, sortSharesOwnFirst } from "./checkout-state";

type Phase = "loading" | "ready" | "error" | "settled" | "no-order";
type PayMode = "split" | "all";
type SheetKind = "own" | "all";

export function CheckoutScreen({ orderId, myGuestId }: Readonly<{ orderId: string | null; myGuestId: string }>) {
  const [phase, setPhase] = useState<Phase>(orderId ? "loading" : "no-order");
  const [bill, setBill] = useState<GuestBillView | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    createOrFetchBill(orderId)
      .then((value) => {
        if (cancelled) return;
        setBill(value);
        setPhase("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof GuestApiError && error.status === 410) {
          setPhase("settled");
          return;
        }
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, attempt]);

  if (phase === "no-order") return <NoOrderPanel />;
  if (phase === "settled") return <SessionEndedView variant="settled" />;
  if (phase === "loading") return <LoadingSkeleton />;
  if (phase === "error" || !bill) {
    return (
      <ErrorPanel
        onRetry={() => {
          setPhase("loading");
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  if (isSettled(bill)) return <SettledPanel bill={bill} />;

  return (
    <BillLoaded
      bill={bill}
      myGuestId={myGuestId}
      onUpdate={setBill}
      onSessionEnded={() => setPhase("settled")}
    />
  );
}

function BillLoaded({
  bill,
  myGuestId,
  onUpdate,
  onSessionEnded,
}: Readonly<{
  bill: GuestBillView;
  myGuestId: string;
  onUpdate: (bill: GuestBillView) => void;
  onSessionEnded: () => void;
}>) {
  const [mode, setMode] = useState<PayMode>("split");
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  // Which share's most recent simulated attempt failed - a demo, non-error
  // outcome (UJ-5), so this is plain local UI state, never surfaced as an
  // alert. "all" covers a failed pay-all attempt. Cleared on any new attempt.
  const [failedFor, setFailedFor] = useState<string | null>(null);

  const myShare = findShare(bill.shares, myGuestId);
  const payAllEligible = canPayAll(bill.shares);
  const orderedShares = sortSharesOwnFirst(bill.shares, myGuestId);

  function openSheet(kind: SheetKind) {
    setSheetError(null);
    setSheet(kind);
  }

  function closeSheet() {
    setSheet(null);
    setPhone("");
    setSheetError(null);
  }

  async function handleSimulate(outcome: SimulatedOutcome) {
    if (!sheet) return;
    setSubmitting(true);
    setSheetError(null);
    const trimmedPhone = phone.trim();
    const input = { simulatedOutcome: outcome, ...(trimmedPhone ? { payerPhone: trimmedPhone } : {}) };
    try {
      const result = sheet === "own" && myShare ? await payShare(bill.id, myShare.guestId, input) : await payAll(bill.id, input);
      onUpdate(result);
      setFailedFor(outcome === "failure" ? (sheet === "own" ? (myShare?.guestId ?? "all") : "all") : null);
      closeSheet();
    } catch (error) {
      if (error instanceof GuestApiError) {
        if (error.status === 410) {
          onSessionEnded();
          return;
        }
        setSheetError(error.message);
        setSubmitting(false);
        return;
      }
      setSheetError("Couldn't process that - please try again.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  }

  const sheetAmount = sheet === "own" ? myShare?.amountMinor ?? 0 : bill.totalMinor;

  return (
    <main data-testid="checkout-screen" className="flex min-h-screen flex-1 flex-col px-6 pb-12 pt-8">
      <h1 className="font-headline text-2xl font-semibold text-foreground">Your bill</h1>
      {bill.billNumber ? <p className="mt-1 text-sm text-muted-foreground">Bill #{bill.billNumber}</p> : null}

      <BillSummary bill={bill} />

      <div role="tablist" aria-label="How do you want to pay?" className="mt-6 flex gap-2 rounded-xl bg-accent p-1">
        <ModeTab data-testid="checkout-mode-split" selected={mode === "split"} onClick={() => setMode("split")}>
          Split by guest
        </ModeTab>
        <ModeTab data-testid="checkout-mode-all" selected={mode === "all"} onClick={() => setMode("all")}>
          Pay for the table
        </ModeTab>
      </div>

      {mode === "split" ? (
        <ul className="mt-4 flex flex-col gap-3" aria-label="Split by guest">
          {orderedShares.map((share) => (
            <SplitShareRow
              key={share.guestId}
              share={share}
              own={share.guestId === myGuestId}
              failed={failedFor === share.guestId}
              onPay={() => openSheet("own")}
            />
          ))}
        </ul>
      ) : (
        <PayAllPanel bill={bill} eligible={payAllEligible} failed={failedFor === "all"} onPay={() => openSheet("all")} />
      )}

      {sheet ? (
        <PaymentSheet
          kind={sheet}
          amountMinor={sheetAmount}
          phone={phone}
          onPhoneChange={setPhone}
          submitting={submitting}
          error={sheetError}
          onSimulate={handleSimulate}
          onCancel={closeSheet}
        />
      ) : null}
    </main>
  );
}

function BillSummary({ bill }: Readonly<{ bill: GuestBillView }>) {
  return (
    <div data-testid="checkout-bill-summary" className="mt-6 rounded-xl border border-border bg-card p-4">
      <SummaryRow label="Subtotal" amountMinor={bill.subtotalMinor} />
      <SummaryRow label="Tax" amountMinor={bill.taxMinor} />
      {bill.discountMinor ? <SummaryRow label={bill.discountReason ?? "Discount"} amountMinor={-bill.discountMinor} /> : null}
      <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
        <span className="text-sm font-semibold text-foreground">Total</span>
        <span data-testid="checkout-total" className="font-headline text-xl font-bold tabular-nums text-foreground">
          {formatRupees(bill.totalMinor)}
        </span>
      </div>
    </div>
  );
}

function SummaryRow({ label, amountMinor }: Readonly<{ label: string; amountMinor: number }>) {
  return (
    <div className="flex items-baseline justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{formatRupees(amountMinor)}</span>
    </div>
  );
}

function ModeTab({
  selected,
  onClick,
  children,
  ...rest
}: Readonly<{ selected: boolean; onClick: () => void; children: React.ReactNode; "data-testid": string }>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
        selected ? "bg-primary text-primary-foreground" : "text-accent-foreground"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

function SplitShareRow({
  share,
  own,
  failed,
  onPay,
}: Readonly<{ share: BillShareView; own: boolean; failed: boolean; onPay: () => void }>) {
  return (
    <li data-testid={`checkout-share-${share.guestId}`} className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span
          data-testid={own ? "guest-chip-mine" : "guest-chip"}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
        >
          {share.guestName}
          {own ? <span className="text-primary">(you)</span> : null}
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">{formatRupees(share.amountMinor)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {share.status === "paid" ? (
          <span
            data-testid={`checkout-share-paid-${share.guestId}`}
            className="inline-flex items-center gap-1 rounded-full bg-step-done px-2.5 py-1 text-xs font-medium text-white"
          >
            Paid
          </span>
        ) : own ? (
          <button
            type="button"
            data-testid="checkout-pay-own"
            onClick={onPay}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Pay your share
          </button>
        ) : (
          <span data-testid={`checkout-share-outstanding-${share.guestId}`} className="text-xs text-muted-foreground">
            Outstanding
          </span>
        )}
      </div>

      {failed ? (
        <p data-testid={`checkout-share-failed-${share.guestId}`} className="mt-2 text-xs text-muted-foreground">
          Payment didn&apos;t go through - try again.
        </p>
      ) : null}
    </li>
  );
}

function PayAllPanel({
  bill,
  eligible,
  failed,
  onPay,
}: Readonly<{ bill: GuestBillView; eligible: boolean; failed: boolean; onPay: () => void }>) {
  return (
    <div data-testid="checkout-payall-panel" className="mt-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">One payment settles the whole table.</p>
      {eligible ? (
        <button
          type="button"
          data-testid="checkout-pay-all"
          onClick={onPay}
          className="mt-3 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Pay full bill · {formatRupees(bill.totalMinor)}
        </button>
      ) : (
        <p data-testid="checkout-payall-blocked" className="mt-3 text-sm text-muted-foreground">
          Some shares are already paid individually - pay the remaining shares one by one under &quot;Split by guest&quot;.
        </p>
      )}
      {failed ? (
        <p data-testid="checkout-payall-failed" className="mt-2 text-xs text-muted-foreground">
          Payment didn&apos;t go through - try again.
        </p>
      ) : null}
    </div>
  );
}

function PaymentSheet({
  kind,
  amountMinor,
  phone,
  onPhoneChange,
  submitting,
  error,
  onSimulate,
  onCancel,
}: Readonly<{
  kind: SheetKind;
  amountMinor: number;
  phone: string;
  onPhoneChange: (value: string) => void;
  submitting: boolean;
  error: string | null;
  onSimulate: (outcome: SimulatedOutcome) => void;
  onCancel: () => void;
}>) {
  return (
    <div
      data-testid="checkout-payment-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Simulate payment"
      className="fixed inset-x-0 bottom-0 z-10 rounded-t-2xl border-t border-border bg-card p-6 shadow-lg"
    >
      <span
        data-testid="checkout-demo-badge"
        title="No real payment is processed - this simulates a UPI outcome for the demo"
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
      >
        Demo payment simulation
        <span className="text-muted-foreground">(demo)</span>
      </span>

      <p className="mt-3 text-sm text-muted-foreground">
        This is a demo - no real money moves. Choose an outcome to see how {kind === "own" ? "your share" : "the whole bill"} responds.
      </p>

      <p className="mt-3 font-headline text-xl font-bold tabular-nums text-foreground">{formatRupees(amountMinor)}</p>

      <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="checkout-payer-phone">
        Phone number for updates <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <input
        id="checkout-payer-phone"
        data-testid="checkout-payer-phone"
        type="tel"
        value={phone}
        onChange={(event) => onPhoneChange(event.target.value)}
        placeholder="10-digit mobile number"
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      />

      {error ? (
        <p role="alert" data-testid="checkout-sheet-error" className="mt-3 text-sm text-error-soft">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          data-testid="checkout-simulate-success"
          disabled={submitting}
          onClick={() => onSimulate("success")}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          Simulate successful payment
        </button>
        <button
          type="button"
          data-testid="checkout-simulate-failure"
          disabled={submitting}
          onClick={() => onSimulate("failure")}
          className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-opacity disabled:opacity-50"
        >
          Simulate failed payment
        </button>
        <button
          type="button"
          data-testid="checkout-sheet-cancel"
          disabled={submitting}
          onClick={onCancel}
          className="w-full rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SettledPanel({ bill }: Readonly<{ bill: GuestBillView }>) {
  return (
    <main data-testid="checkout-settled" className="flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="font-headline text-2xl font-semibold text-foreground">Bill settled - thanks!</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        Table total <span className="tabular-nums">{formatRupees(bill.totalMinor)}</span> is paid in full. We hope you enjoyed your meal.
      </p>
    </main>
  );
}

function NoOrderPanel() {
  return (
    <main data-testid="checkout-no-order" role="alert" className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted-foreground">No order to check out yet.</p>
    </main>
  );
}

function ErrorPanel({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <main data-testid="checkout-error" role="alert" className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted-foreground">Couldn&apos;t load your bill.</p>
      <button
        type="button"
        data-testid="checkout-retry"
        onClick={onRetry}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Retry
      </button>
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div data-testid="checkout-loading" className="flex min-h-screen flex-1 flex-col gap-4 px-6 pt-8">
      <p className="sr-only" role="status">
        Loading your bill…
      </p>
      <div aria-hidden="true" className="h-8 w-40 animate-pulse rounded-md bg-accent" />
      <div aria-hidden="true" className="h-28 w-full animate-pulse rounded-xl bg-accent" />
      <div aria-hidden="true" className="h-28 w-full animate-pulse rounded-xl bg-accent" />
    </div>
  );
}
