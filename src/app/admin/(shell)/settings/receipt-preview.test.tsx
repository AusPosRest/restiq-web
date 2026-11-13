import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeBranding } from "./branding-state";
import { ReceiptPreview, sampleReceipt } from "./receipt-preview";

afterEach(cleanup);

// PE-8: the preview used a fixed "Your restaurant", rupee prices for every market and a total (671.50) that matched nothing.
describe("ReceiptPreview", () => {
  it("adds up an Indian sample: lines + CGST + SGST", () => {
    const receipt = sampleReceipt("IN");
    const subtotal = receipt.lines.reduce((sum, line) => sum + line.totalMinor, 0);
    expect(subtotal).toBe(77000);
    expect(receipt.taxLines).toEqual([
      { label: "CGST 2.5%", amountMinor: 1925 },
      { label: "SGST 2.5%", amountMinor: 1925 },
    ]);
    expect(receipt.totalMinor).toBe(80850);
  });

  it("keeps an Australian sample GST-inclusive in A$", () => {
    const receipt = sampleReceipt("AU");
    expect(receipt.currency).toBe("AUD");
    expect(receipt.totalMinor).toBe(receipt.lines.reduce((sum, line) => sum + line.totalMinor, 0));
    expect(receipt.taxLines).toEqual([{ label: "Includes GST 10%", amountMinor: Math.round(receipt.totalMinor / 11) }]);
  });

  it("shows the restaurant's own name and currency", () => {
    render(<ReceiptPreview tokens={normalizeBranding(null)} tenant={{ name: "Bondi Beans", country: "AU" }} />);
    expect(screen.getByTestId("receipt-preview-tenant-name").textContent).toBe("Bondi Beans");
    expect(screen.getByTestId("receipt-preview-total").textContent).toContain("$36.00");
    expect(screen.getByTestId("receipt-preview-total").textContent).not.toContain("₹");
  });
});
