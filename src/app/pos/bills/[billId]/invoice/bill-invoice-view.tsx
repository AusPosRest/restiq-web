"use client";

// Printable tax invoice (issue #137 web / restiq-backend#103, merged via
// restiq-backend PR #105). Reached from the finalised bill-settle screen's
// "Bill finalised" panel and the counter's settled panel (both already have
// a bill id in hand) via a new "Print invoice" link - see those files' own
// headers. Everything here is read-only, server-computed display: no
// mutation of any kind, matching AD-14's posture once a bill is finalised.
//
// `GET bills/:id/invoice` 409s with `not_finalized` while the bill is still
// open (a plain, non-retryable state - the bill just isn't ready yet) and
// 404s for any other unreachable/unknown bill id (the existing
// LoadErrorPanel/retry pattern).
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchInvoice, PosApiError, type InvoiceView } from "../../../api";
import { LoadErrorPanel, Skeleton } from "../../../data-states";
import { formatMinor } from "../../../(shell)/shift/shift-state";
import { TENDER_METHOD_LABEL, type BillTenderMethod } from "../../../orders/[orderId]/settle/bill-state";

interface InvoiceLanded {
  attempt: number;
  invoice: InvoiceView | null;
  notFinalized: boolean;
  failed: boolean;
}

/** Same "landed keyed by attempt" shape use-pos-load.ts's hook uses, plus a `notFinalized` branch usePosLoad has no room for (it only ever tracks a plain failed/not-failed boolean). */
function useInvoice(billId: string) {
  const [attempt, setAttempt] = useState(0);
  const [landed, setLanded] = useState<InvoiceLanded | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInvoice(billId)
      .then((invoice) => {
        if (!cancelled) setLanded({ attempt, invoice, notFinalized: false, failed: false });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const notFinalized = error instanceof PosApiError && error.status === 409 && error.code === "not_finalized";
        setLanded({ attempt, invoice: null, notFinalized, failed: !notFinalized });
      });
    return () => {
      cancelled = true;
    };
  }, [billId, attempt]);

  const current = landed !== null && landed.attempt === attempt ? landed : null;
  return {
    loading: current === null,
    failed: current?.failed ?? false,
    notFinalized: current?.notFinalized ?? false,
    invoice: current?.invoice ?? null,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function BillInvoiceView({ billId }: Readonly<{ billId: string }>) {
  const load = useInvoice(billId);

  if (load.loading) return <LoadingShell />;

  if (load.notFinalized) {
    return (
      <section data-testid="invoice-not-finalized" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">This bill isn&apos;t finalized yet.</p>
        <Link href="/pos/table-map" data-testid="invoice-back" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Back to table map
        </Link>
      </section>
    );
  }

  if (load.failed || !load.invoice) {
    return <LoadErrorPanel testId="invoice-error" message="Couldn't load this invoice." onRetry={load.retry} />;
  }

  return <InvoiceLoaded invoice={load.invoice} />;
}

function InvoiceLoaded({ invoice }: Readonly<{ invoice: InvoiceView }>) {
  const discountMinor = invoice.discountMinor ?? 0;

  return (
    <div data-testid="bill-invoice-view" className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 p-6 print:max-w-none print:gap-4 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/pos/table-map" data-testid="invoice-back" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Back to table map
        </Link>
        <Button size="sm" data-testid="invoice-print" onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <header className="border-b border-border/60 pb-4 text-center">
        <h1 className="font-headline text-xl font-bold text-foreground">{invoice.title}</h1>
        <p className="text-sm text-muted-foreground">
          Invoice #{invoice.invoiceNumber} · {formatIssuedAt(invoice.issuedAt)}
        </p>
      </header>

      <section data-testid="invoice-seller" className="text-sm">
        <p className="font-semibold text-foreground">{invoice.seller.legalEntityName}</p>
        <p className="text-muted-foreground">{invoice.seller.outletName}</p>
        <p className="text-muted-foreground">{invoice.seller.outletAddress}</p>
        <p className="text-muted-foreground">
          {invoice.seller.registrationLabel}: {invoice.seller.registrationNumber}
        </p>
        {invoice.seller.fssaiLicense && <p className="text-muted-foreground">FSSAI: {invoice.seller.fssaiLicense}</p>}
      </section>

      <table data-testid="invoice-lines" className="w-full text-left text-sm">
        <thead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="pb-2">Item</th>
            <th className="pb-2 text-right">Qty</th>
            <th className="pb-2 text-right">Unit price</th>
            <th className="pb-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, index) => (
            <tr key={index} data-testid={`invoice-line-${index}`}>
              <td className="py-1">{line.name}</td>
              <td className="py-1 text-right tabular-nums">{line.quantity}</td>
              <td className="py-1 text-right tabular-nums">{formatMinor(line.unitPriceMinor, invoice.currency)}</td>
              <td className="py-1 text-right tabular-nums">{formatMinor(line.lineTotalMinor, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl data-testid="invoice-totals" className="flex flex-col gap-1.5 border-t border-border/60 pt-3 text-sm">
        <TotalRow label="Subtotal" value={formatMinor(invoice.subtotalMinor, invoice.currency)} testId="invoice-subtotal" />
        {discountMinor > 0 && (
          <TotalRow
            label={`Discount${invoice.discountReason ? ` — ${invoice.discountReason}` : ""}`}
            value={`-${formatMinor(discountMinor, invoice.currency)}`}
            testId="invoice-discount"
          />
        )}
        {invoice.taxBreakdown.map((tax, index) => (
          <TotalRow key={index} label={`${tax.label} (${tax.ratePercent}%)`} value={formatMinor(tax.amountMinor, invoice.currency)} testId={`invoice-tax-${index}`} />
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2">
          <span className="font-label text-sm font-semibold uppercase tracking-wider text-foreground">Total</span>
          <span data-testid="invoice-grand-total" className="tabular-nums text-lg font-bold text-primary">
            {formatMinor(invoice.totalMinor, invoice.currency)}
          </span>
        </div>
        {invoice.pricesIncludeTax && (
          <p data-testid="invoice-prices-include-tax" className="text-xs text-muted-foreground">
            Prices include tax
          </p>
        )}
      </dl>

      {invoice.tenders.length > 0 && (
        <section data-testid="invoice-tenders" className="text-sm">
          <h2 className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payments</h2>
          <ul className="mt-1 flex flex-col gap-1">
            {invoice.tenders.map((tender, index) => (
              <li key={index} data-testid={`invoice-tender-${index}`} className="flex items-center justify-between">
                <span>
                  {tenderMethodLabel(tender.method)} · {formatIssuedAt(tender.createdAt)}
                </span>
                <span className="tabular-nums">{formatMinor(tender.amountMinor, invoice.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invoice.creditNotes.length > 0 && (
        <section data-testid="invoice-credit-notes" className="text-sm">
          <h2 className="font-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credit notes</h2>
          <ul className="mt-1 flex flex-col gap-1">
            {invoice.creditNotes.map((note) => (
              <li key={note.id} data-testid={`invoice-credit-note-${note.id}`} className="flex items-center justify-between">
                <span>
                  {note.reason} · {formatIssuedAt(note.createdAt)}
                </span>
                <span className="tabular-nums">-{formatMinor(note.amountMinor, invoice.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invoice.notes.length > 0 && (
        <section data-testid="invoice-notes" className="whitespace-pre-wrap border-t border-border/60 pt-3 text-xs text-muted-foreground">
          {invoice.notes.map((note, index) => (
            <p key={index}>{note}</p>
          ))}
        </section>
      )}
    </div>
  );
}

function TotalRow({ label, value, testId }: Readonly<{ label: string; value: string; testId: string }>) {
  return (
    <div data-testid={testId} className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function tenderMethodLabel(method: string): string {
  return TENDER_METHOD_LABEL[method as BillTenderMethod] ?? method;
}

function formatIssuedAt(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function LoadingShell() {
  return (
    <div data-testid="invoice-loading" className="mx-auto flex max-w-2xl flex-1 flex-col gap-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
