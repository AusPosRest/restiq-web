// Live receipt preview (EXPERIENCE.md T10: "theme token editor with a live
// receipt preview pane that updates as tokens change, before saving"). Pure
// presentational - driven entirely by the draft tokens (plus an optional
// locally-picked logo file that isn't part of the saved draft, see
// branding-editor.tsx) passed in, so it updates on every keystroke/color
// pick, before any save call.
// PE-8: the sample order is in the tenant's own name, currency and tax style, and it adds up - India adds
// CGST + SGST (2.5% each, the 5% restaurant rate) on top; Australia's prices already include 10% GST.
import type { CSSProperties } from "react";
import type { BrandingTokens } from "./branding-state";

export interface PreviewTenant {
  name: string;
  country: string;
}

interface SampleLine {
  name: string;
  qty: number;
  unitMinor: number;
}

const SAMPLE: Record<"IN" | "AU", SampleLine[]> = {
  IN: [
    { name: "Paneer Tikka", qty: 1, unitMinor: 28000 },
    { name: "Butter Naan", qty: 3, unitMinor: 9000 },
    { name: "Dal Makhani", qty: 1, unitMinor: 22000 },
  ],
  AU: [
    { name: "Flat White", qty: 2, unitMinor: 500 },
    { name: "Smashed Avo", qty: 1, unitMinor: 1850 },
    { name: "Banana Bread", qty: 1, unitMinor: 750 },
  ],
};

export function sampleReceipt(country: string): { currency: "INR" | "AUD"; lines: Array<SampleLine & { totalMinor: number }>; taxLines: Array<{ label: string; amountMinor: number }>; totalMinor: number } {
  const market = country === "AU" ? "AU" : "IN";
  const lines = SAMPLE[market].map((line) => ({ ...line, totalMinor: line.qty * line.unitMinor }));
  const subtotal = lines.reduce((sum, line) => sum + line.totalMinor, 0);
  if (market === "AU") {
    return { currency: "AUD", lines, taxLines: [{ label: "Includes GST 10%", amountMinor: Math.round(subtotal / 11) }], totalMinor: subtotal };
  }
  const half = Math.round(subtotal * 0.025);
  return { currency: "INR", lines, taxLines: [{ label: "CGST 2.5%", amountMinor: half }, { label: "SGST 2.5%", amountMinor: half }], totalMinor: subtotal + 2 * half };
}

function money(minor: number, currency: "INR" | "AUD"): string {
  return new Intl.NumberFormat(currency === "AUD" ? "en-AU" : "en-IN", { style: "currency", currency }).format(minor / 100);
}

export function ReceiptPreview({ tokens, logoUrl, tenant }: Readonly<{ tokens: BrandingTokens; logoUrl?: string | null; tenant?: PreviewTenant | null }>) {
  const receipt = sampleReceipt(tenant?.country ?? "IN");
  const style: CSSProperties = {
    backgroundColor: tokens.surfaceColor,
    borderRadius: tokens.cornerRadiusPx,
    fontFamily: `${tokens.font}, sans-serif`,
    color: "#F5F5F4",
  };
  const logo = logoUrl ?? tokens.logoUrl;

  return (
    <div
      data-testid="receipt-preview"
      role="img"
      aria-label="Live preview of the receipt with the current branding tokens"
      style={style}
      className="w-full border border-white/10 p-5 text-sm"
    >
      <div className="flex flex-col items-center gap-1 border-b border-dashed border-white/20 pb-3 text-center">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- data/remote URL preview, not a static asset
          <img src={logo} alt="" data-testid="receipt-preview-logo" className="mb-1 size-10 object-contain" />
        )}
        <p className="font-semibold" style={{ color: tokens.primaryColor }} data-testid="receipt-preview-tenant-name">
          {tenant?.name ?? "Your restaurant"}
        </p>
        {tokens.receiptHeader && (
          <p className="text-xs opacity-80" data-testid="receipt-preview-header">
            {tokens.receiptHeader}
          </p>
        )}
      </div>

      <ul className="mt-3 space-y-1">
        {receipt.lines.map((line) => (
          <li key={line.name} className="flex justify-between gap-2 text-xs">
            <span>
              {line.qty}x {line.name}
            </span>
            <span className="tabular-nums">{money(line.totalMinor, receipt.currency)}</span>
          </li>
        ))}
      </ul>

      <ul className="mt-2 space-y-1 text-xs opacity-80" data-testid="receipt-preview-tax">
        {receipt.taxLines.map((line) => (
          <li key={line.label} className="flex justify-between gap-2">
            <span>{line.label}</span>
            <span className="tabular-nums">{money(line.amountMinor, receipt.currency)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex justify-between border-t pt-2 text-sm font-semibold" style={{ borderColor: tokens.accentColor, color: tokens.secondaryColor }}>
        <span>TOTAL</span>
        <span className="tabular-nums" data-testid="receipt-preview-total">
          {money(receipt.totalMinor, receipt.currency)}
        </span>
      </div>

      {tokens.receiptFooter && (
        <p className="mt-3 border-t border-dashed border-white/20 pt-2 text-center text-xs opacity-80" data-testid="receipt-preview-footer">
          {tokens.receiptFooter}
        </p>
      )}
    </div>
  );
}
