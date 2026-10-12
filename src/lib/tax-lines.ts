// Per-bill tax lines, shared by the POS bill and the owner's Payments report
// (lib, not either route tree - AD-4 keeps app/pos, app/admin and app/ops apart).

/** One line of a bill's tax breakdown (restiq-backend bills.dtos.ts TaxBreakdownLineView). */
export interface TaxBreakdownEntry {
  label: string;
  ratePercent: number;
  amountMinor: number;
}

export interface TaxLine {
  label: string;
  amountMinor: number;
}

/** The real breakdown when the backend sent one (CGST 2.5% + SGST 2.5%), else one unlabelled line off `taxMinor`. */
export function taxLines(bill: { taxBreakdown?: TaxBreakdownEntry[]; taxMinor: number }): TaxLine[] {
  if (bill.taxBreakdown && bill.taxBreakdown.length > 0) {
    return bill.taxBreakdown.map((line) => ({ label: `${line.label} (${line.ratePercent}%)`, amountMinor: line.amountMinor }));
  }
  return [{ label: "", amountMinor: bill.taxMinor }];
}
