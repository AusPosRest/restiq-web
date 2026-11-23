// CU-11 / restiq-web#377: the printed bill (invoice page and thermal receipt
// alike) shows the cash round-off and the amount actually paid. Since
// restiq-backend#241 the server stores the round-off and the cash tender is
// already what went into the drawer, so both are used as-is.
import { cashRoundOffMinor } from "@/lib/money";
import type { InvoiceTenderView, InvoiceView } from "../api";

export function invoiceCashRoundOff(invoice: Pick<InvoiceView, "status" | "tenders" | "totalMinor" | "currency" | "roundOffMinor">): {
  roundOffMinor: number;
  tenders: InvoiceTenderView[];
} {
  if (invoice.roundOffMinor != null) return { roundOffMinor: invoice.roundOffMinor, tenders: invoice.tenders };
  // A bill settled before restiq-web#377 posted the exact total, so reprints
  // still guess the rupee round-off for an all-cash bill and carry it on the
  // last cash tender. INR only: older Australian bills were never rounded,
  // and the new 5-cent rule would invent a round-off on a reprint.
  const paidAllInCash = invoice.status !== "open" && invoice.tenders.length > 0 && invoice.tenders.every((tender) => tender.method === "cash");
  const roundOffMinor = paidAllInCash && invoice.currency === "INR" ? cashRoundOffMinor(invoice.totalMinor, invoice.currency) : 0;
  if (roundOffMinor === 0) return { roundOffMinor, tenders: invoice.tenders };
  const last = invoice.tenders.length - 1;
  return { roundOffMinor, tenders: invoice.tenders.map((tender, index) => (index === last ? { ...tender, amountMinor: tender.amountMinor + roundOffMinor } : tender)) };
}
