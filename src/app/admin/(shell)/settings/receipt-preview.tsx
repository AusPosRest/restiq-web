// Live receipt preview (EXPERIENCE.md T10: "theme token editor with a live
// receipt preview pane that updates as tokens change, before saving"). Pure
// presentational - driven entirely by the draft tokens (plus an optional
// locally-picked logo file that isn't part of the saved draft, see
// branding-editor.tsx) passed in, so it updates on every keystroke/color
// pick, before any save call.
import type { CSSProperties } from "react";
import type { BrandingTokens } from "./branding-state";

const MOCK_LINE_ITEMS = [
  { name: "Paneer Tikka", qty: 1, price: "₹280.00" },
  { name: "Butter Naan", qty: 3, price: "₹90.00" },
  { name: "Dal Makhani", qty: 1, price: "₹220.00" },
];

export function ReceiptPreview({ tokens, logoUrl }: Readonly<{ tokens: BrandingTokens; logoUrl?: string | null }>) {
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
          TENANT NAME
        </p>
        {tokens.receiptHeader && (
          <p className="text-xs opacity-80" data-testid="receipt-preview-header">
            {tokens.receiptHeader}
          </p>
        )}
      </div>

      <ul className="mt-3 space-y-1">
        {MOCK_LINE_ITEMS.map((line) => (
          <li key={line.name} className="flex justify-between gap-2 text-xs">
            <span>
              {line.qty}x {line.name}
            </span>
            <span className="tabular-nums">{line.price}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex justify-between border-t pt-2 text-sm font-semibold" style={{ borderColor: tokens.accentColor, color: tokens.secondaryColor }}>
        <span>TOTAL</span>
        <span className="tabular-nums" data-testid="receipt-preview-total">
          ₹671.50
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
