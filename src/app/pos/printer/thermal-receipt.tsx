// The simulated printer's paper (issue #208): an 80mm thermal strip -
// white paper, black monospace text, centred header, dashed rules, a torn
// bottom edge - fed out of the slot line by line (`animate-paper-feed`,
// globals.css; still for reduced-motion users). Same InvoiceView the
// invoice page renders, laid out the way a receipt printer would.
import type { InvoiceView } from "../api";
import { formatMinor } from "../(shell)/shift/shift-state";
import { TENDER_METHOD_LABEL, type BillTenderMethod } from "../orders/[orderId]/settle/bill-state";

function Rule() {
  return <p aria-hidden="true" className="overflow-hidden whitespace-nowrap text-neutral-500">{"- ".repeat(40)}</p>;
}

function Row({ label, value, bold, testId }: Readonly<{ label: string; value: string; bold?: boolean; testId?: string }>) {
  return (
    <p data-testid={testId} className={`flex justify-between gap-3 ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

export function ThermalReceipt({ invoice, printedAt }: Readonly<{ invoice: InvoiceView; printedAt: string }>) {
  const { seller, currency } = invoice;
  const discountMinor = invoice.discountMinor ?? 0;
  return (
    <article
      data-testid="thermal-receipt"
      className="w-[302px] bg-white px-4 pt-5 pb-8 font-mono text-[12px] leading-5 text-black shadow-[0_8px_24px_rgba(0,0,0,0.45)] [clip-path:polygon(0_0,100%_0,100%_calc(100%-6px),97%_100%,94%_calc(100%-6px),91%_100%,88%_calc(100%-6px),85%_100%,82%_calc(100%-6px),79%_100%,76%_calc(100%-6px),73%_100%,70%_calc(100%-6px),67%_100%,64%_calc(100%-6px),61%_100%,58%_calc(100%-6px),55%_100%,52%_calc(100%-6px),49%_100%,46%_calc(100%-6px),43%_100%,40%_calc(100%-6px),37%_100%,34%_calc(100%-6px),31%_100%,28%_calc(100%-6px),25%_100%,22%_calc(100%-6px),19%_100%,16%_calc(100%-6px),13%_100%,10%_calc(100%-6px),7%_100%,4%_calc(100%-6px),1%_100%,0_calc(100%-6px))]"
    >
      <header className="text-center">
        <p className="text-[14px] font-bold uppercase tracking-wide">{seller.legalEntityName}</p>
        <p>{seller.outletName}</p>
        <p>{seller.outletAddress}</p>
        <p>
          {seller.registrationLabel}: {seller.registrationNumber}
        </p>
        {seller.fssaiLicense && <p>FSSAI: {seller.fssaiLicense}</p>}
        <p>{seller.phone}</p>
        <p>{seller.email}</p>
      </header>
      <Rule />
      <p className="text-center text-[14px] font-bold uppercase">
        {invoice.title}
        {invoice.status === "open" && " (unpaid)"}
      </p>
      {invoice.invoiceNumber && <p className="text-center">No. {invoice.invoiceNumber}</p>}
      <p className="text-center">{stamp(invoice.issuedAt ?? printedAt)}</p>
      <Rule />
      {invoice.lines.map((line, index) => (
        <div key={index} data-testid={`thermal-line-${index}`}>
          <p className="break-words">{line.name}</p>
          <Row label={`  ${line.quantity} x ${formatMinor(line.unitPriceMinor, currency)}`} value={formatMinor(line.lineTotalMinor, currency)} />
        </div>
      ))}
      <Rule />
      <Row label="Subtotal" value={formatMinor(invoice.subtotalMinor, currency)} />
      {discountMinor > 0 && <Row label={`Discount${invoice.discountReason ? ` (${invoice.discountReason})` : ""}`} value={`-${formatMinor(discountMinor, currency)}`} />}
      {invoice.title !== "Receipt" &&
        invoice.taxBreakdown.map((tax, index) => <Row key={index} label={`${tax.label} ${tax.ratePercent}%`} value={formatMinor(tax.amountMinor, currency)} />)}
      <Row label="TOTAL" value={formatMinor(invoice.totalMinor, currency)} bold testId="thermal-total" />
      {invoice.pricesIncludeTax && <p className="text-neutral-600">Prices include tax</p>}
      {invoice.tenders.length > 0 && (
        <>
          <Rule />
          {invoice.tenders.map((tender, index) => (
            <Row key={index} label={TENDER_METHOD_LABEL[tender.method as BillTenderMethod] ?? tender.method} value={formatMinor(tender.amountMinor, currency)} />
          ))}
        </>
      )}
      {invoice.creditNotes.length > 0 && (
        <>
          <Rule />
          {invoice.creditNotes.map((note) => (
            <Row key={note.id} label={`Credit: ${note.reason}`} value={`-${formatMinor(note.amountMinor, currency)}`} />
          ))}
        </>
      )}
      {(invoice.notes.length > 0 || invoice.footerMessage) && <Rule />}
      {invoice.notes.map((note, index) => (
        <p key={index} className="whitespace-pre-wrap text-neutral-600">
          {note}
        </p>
      ))}
      {invoice.footerMessage && <p className="whitespace-pre-wrap text-center">{invoice.footerMessage}</p>}
      <p className="mt-3 text-center">*** Thank you ***</p>
    </article>
  );
}
