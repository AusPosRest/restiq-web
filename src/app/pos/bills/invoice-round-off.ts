// CU-11: a rupee bill paid wholly in cash is settled to the nearest rupee.
// The server keeps the exact total and tenders; the printed bill (invoice
// page and thermal receipt alike) shows the round-off and the cash actually
// collected, carried on the last cash tender.
import { cashRoundOffMinor } from "@/lib/money";
import type { InvoiceTenderView, InvoiceView } from "../api";

export function invoiceCashRoundOff(invoice: Pick<InvoiceView, "status" | "tenders" | "totalMinor" | "currency">): {
  roundOffMinor: number;
  tenders: InvoiceTenderView[];
} {
  const paidAllInCash = invoice.status !== "open" && invoice.tenders.length > 0 && invoice.tenders.every((tender) => tender.method === "cash");
  const roundOffMinor = paidAllInCash ? cashRoundOffMinor(invoice.totalMinor, invoice.currency) : 0;
  if (roundOffMinor === 0) return { roundOffMinor, tenders: invoice.tenders };
  const last = invoice.tenders.length - 1;
  return { roundOffMinor, tenders: invoice.tenders.map((tender, index) => (index === last ? { ...tender, amountMinor: tender.amountMinor + roundOffMinor } : tender)) };
}
