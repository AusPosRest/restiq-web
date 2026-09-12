"use client";

// Kiosk pay-here and receipt (issue #220 / restiq-backend#144). The placed
// screen's alternative to paying at the counter: raise the order's bill (the
// guest checkout's own endpoint), take a card payment on the kiosk's reader -
// the bank's answer is a demo control, same honesty posture as /qr/checkout's
// simulate buttons - then print the finalised invoice as a thermal receipt
// that feeds out of the kiosk's RECEIPT slot (#kiosk-receipt-tray, drawn by
// KioskFrame in ../kiosk-chrome.tsx). A decline never calls the API: the
// backend's simulated failure writes nothing anyway.
import { Check, CreditCard, Nfc, Printer } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { GuestApiError } from "../api-client";
import { formatMinor } from "../cart/cart-state";
import { createOrFetchBill, fetchInvoice, payAll, type GuestBillView, type GuestInvoiceView } from "../checkout/checkout-api";

const TRAY_ID = "kiosk-receipt-tray";
const TENDER_LABEL: Record<string, string> = { card_terminal: "Card", card_online: "Card", cash: "Cash", upi_manual: "UPI", upi_intent: "UPI", upi_qr: "UPI" };
const BUTTON = "rounded-xl px-4 py-3 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type PayState =
  | { kind: "offer" }
  | { kind: "busy"; label: string }
  | { kind: "tap"; bill: GuestBillView; declined: boolean }
  | { kind: "paid"; invoice: GuestInvoiceView }
  | { kind: "error"; message: string };

function errorMessage(error: unknown): string {
  return error instanceof GuestApiError && error.status !== 0 ? error.message : "Couldn't reach the restaurant - please try again or pay at the counter.";
}

export function KioskPay({ orderId, tokenNumber, currency }: Readonly<{ orderId: string; tokenNumber: number; currency: string }>) {
  const [state, setState] = useState<PayState>({ kind: "offer" });
  // `copy` re-keys the receipt so "Print another copy" feeds a fresh one.
  const [receipt, setReceipt] = useState<{ copy: number; tray: HTMLElement | null } | null>(null);

  async function finish(bill: GuestBillView) {
    setState({ kind: "paid", invoice: await fetchInvoice(bill.id) });
  }

  async function start() {
    setState({ kind: "busy", label: "Getting your bill…" });
    try {
      const bill = await createOrFetchBill(orderId);
      if (bill.status === "finalized") await finish(bill);
      else setState({ kind: "tap", bill, declined: false });
    } catch (error) {
      setState({ kind: "error", message: errorMessage(error) });
    }
  }

  async function approve(bill: GuestBillView) {
    setState({ kind: "busy", label: "Processing your card…" });
    try {
      await finish(await payAll(bill.id, { simulatedOutcome: "success" }));
    } catch (error) {
      setState({ kind: "error", message: errorMessage(error) });
    }
  }

  function print() {
    setReceipt((prev) => ({ copy: (prev?.copy ?? 0) + 1, tray: document.getElementById(TRAY_ID) }));
  }

  return (
    <section data-testid="kiosk-pay" aria-live="polite" className="mt-6 w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-center">
      {state.kind === "offer" && (
        <>
          <p className="text-sm text-muted-foreground">Pay here by card, or pay at the counter.</p>
          <button type="button" data-testid="kiosk-pay-start" onClick={() => void start()} className={`${BUTTON} mt-3 inline-flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground`}>
            <CreditCard className="size-5" aria-hidden="true" /> Pay here by card
          </button>
        </>
      )}

      {state.kind === "busy" && (
        <p role="status" data-testid="kiosk-pay-busy" className="py-6 text-sm text-muted-foreground">
          {state.label}
        </p>
      )}

      {state.kind === "tap" && (
        <>
          <p data-testid="kiosk-pay-total" className="font-headline text-3xl font-bold tabular-nums text-foreground">
            {formatMinor(state.bill.totalMinor, currency)}
          </p>
          <Nfc className="mx-auto mt-3 size-12 animate-pulse text-primary motion-reduce:animate-none" aria-hidden="true" />
          <p className="mt-2 text-sm text-foreground">Tap, insert or swipe your card on the reader below.</p>
          {state.declined && (
            <p role="alert" data-testid="kiosk-pay-declined" className="mt-3 text-sm text-error-soft">
              Card declined - try again, or pay at the counter.
            </p>
          )}
          <div className="mt-4 rounded-xl border border-dashed border-border p-3">
            <p data-testid="kiosk-pay-demo" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Bank&apos;s answer (demo)
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" data-testid="kiosk-pay-approve" onClick={() => void approve(state.bill)} className={`${BUTTON} flex-1 bg-step-done text-white`}>
                Approve
              </button>
              <button type="button" data-testid="kiosk-pay-decline" onClick={() => setState({ ...state, declined: true })} className={`${BUTTON} flex-1 border border-border text-foreground`}>
                Decline
              </button>
            </div>
          </div>
          <button type="button" data-testid="kiosk-pay-cancel" onClick={() => setState({ kind: "offer" })} className="mt-3 text-sm text-muted-foreground underline-offset-2 hover:underline">
            Pay at the counter instead
          </button>
        </>
      )}

      {state.kind === "paid" && (
        <>
          <p data-testid="kiosk-pay-paid" className="inline-flex items-center gap-2 font-headline text-xl font-semibold text-foreground">
            <Check className="size-6 text-step-done" aria-hidden="true" /> Paid {formatMinor(state.invoice.totalMinor, state.invoice.currency)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Collect your order when number {tokenNumber} is called.</p>
          <button type="button" data-testid="kiosk-pay-print" onClick={print} className={`${BUTTON} mt-4 inline-flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground`}>
            <Printer className="size-5" aria-hidden="true" /> {receipt ? "Print another copy" : "Print receipt"}
          </button>
          {receipt && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              Take your receipt from the slot below.
            </p>
          )}
          {receipt &&
            (receipt.tray
              ? createPortal(<KioskReceipt key={receipt.copy} invoice={state.invoice} tokenNumber={tokenNumber} />, receipt.tray)
              : <KioskReceipt key={receipt.copy} invoice={state.invoice} tokenNumber={tokenNumber} />)}
        </>
      )}

      {state.kind === "error" && (
        <>
          <p role="alert" data-testid="kiosk-pay-error" className="text-sm text-error-soft">
            {state.message}
          </p>
          <button type="button" data-testid="kiosk-pay-retry" onClick={() => setState({ kind: "offer" })} className={`${BUTTON} mt-3 border border-border text-foreground`}>
            Try again
          </button>
        </>
      )}
    </section>
  );
}

function Rule() {
  return (
    <p aria-hidden="true" className="overflow-hidden whitespace-nowrap text-neutral-500">
      {"- ".repeat(30)}
    </p>
  );
}

function Row({ label, value, bold, testId }: Readonly<{ label: string; value: string; bold?: boolean; testId?: string }>) {
  return (
    <p data-testid={testId} className={`flex justify-between gap-3 ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}

// An 80 mm-style thermal strip: white paper, black monospace, dashed rules,
// the token number big enough to read across the counter.
function KioskReceipt({ invoice, tokenNumber }: Readonly<{ invoice: GuestInvoiceView; tokenNumber: number }>) {
  const money = (amountMinor: number) => formatMinor(amountMinor, invoice.currency);
  return (
    <article
      data-testid="kiosk-receipt"
      aria-label="Receipt"
      className="w-[260px] animate-[kiosk-receipt-feed_2.4s_steps(24,end)_both] bg-white px-4 pb-6 pt-4 font-mono text-[11px] leading-5 text-black shadow-lg motion-reduce:animate-none"
    >
      <header className="text-center">
        <p className="text-[13px] font-bold uppercase">{invoice.seller.legalEntityName}</p>
        <p>{invoice.seller.outletName}</p>
        <p>{invoice.seller.outletAddress}</p>
        <p>
          {invoice.seller.registrationLabel}: {invoice.seller.registrationNumber}
        </p>
      </header>
      <Rule />
      <p className="text-center font-bold">
        {invoice.title} {invoice.invoiceNumber}
      </p>
      {invoice.issuedAt && <p className="text-center">{new Date(invoice.issuedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</p>}
      <p data-testid="kiosk-receipt-token" className="my-2 text-center text-[28px] font-bold leading-8">
        #{tokenNumber}
      </p>
      <Rule />
      {invoice.lines.map((line, index) => (
        <Row key={index} label={`${line.quantity} x ${line.name}`} value={money(line.lineTotalMinor)} />
      ))}
      <Rule />
      <Row label="Subtotal" value={money(invoice.subtotalMinor)} />
      {invoice.discountMinor ? <Row label="Discount" value={`-${money(invoice.discountMinor)}`} /> : null}
      {invoice.taxBreakdown.map((tax) => (
        <Row key={tax.label} label={`${tax.label} ${tax.ratePercent}%`} value={money(tax.amountMinor)} />
      ))}
      <Row label="TOTAL" value={money(invoice.totalMinor)} bold testId="kiosk-receipt-total" />
      {invoice.tenders.map((tender, index) => (
        <Row key={index} label={`Paid - ${TENDER_LABEL[tender.method] ?? tender.method}`} value={money(tender.amountMinor)} />
      ))}
      <Rule />
      <p className="text-center">{invoice.footerMessage ?? "Thank you! Please keep this receipt."}</p>
    </article>
  );
}
