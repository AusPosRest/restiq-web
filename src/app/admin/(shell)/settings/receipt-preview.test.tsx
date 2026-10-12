import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BRANDING } from "./branding-state";
import { ReceiptPreview } from "./receipt-preview";

afterEach(cleanup);

describe("ReceiptPreview (PE-10)", () => {
  it("adds its sample lines up in rupees for an Indian tenant", () => {
    render(<ReceiptPreview tokens={DEFAULT_BRANDING} currency="INR" />);
    expect(screen.getByTestId("receipt-preview-total").textContent).toBe("₹590.00");
  });

  it("shows Australian dollars, never rupees, for an Australian tenant", () => {
    render(<ReceiptPreview tokens={DEFAULT_BRANDING} currency="AUD" />);
    expect(screen.getByTestId("receipt-preview").textContent).not.toContain("₹");
    expect(screen.getByTestId("receipt-preview-total").textContent).toBe("A$38.00");
  });
});
