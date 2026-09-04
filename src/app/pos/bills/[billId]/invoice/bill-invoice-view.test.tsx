// Component tests for the printable tax invoice (issue #137 web /
// restiq-backend#103, merged via restiq-backend PR #105) against the real
// `GET bills/:id/invoice` contract - see api.ts's `fetchInvoice` header.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BillInvoiceView } from "./bill-invoice-view";
import type { InvoiceView } from "../../../api";

const BILL_ID = "bill-9001";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(respond: (init?: RequestInit) => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(`bills/${BILL_ID}/invoice`)) return Promise.resolve(respond(init));
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: `unhandled ${url}` } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function inInvoice(overrides: Partial<InvoiceView> = {}): InvoiceView {
  return {
    invoiceNumber: "INV-2026-0042",
    title: "Tax Invoice",
    issuedAt: "2026-09-02T10:30:00.000Z",
    currency: "INR",
    seller: {
      legalEntityName: "Restiq Foods Pvt Ltd",
      registrationLabel: "GSTIN",
      registrationNumber: "29ABCDE1234F1Z5",
      fssaiLicense: "10023456789012",
      outletName: "Restiq - Indiranagar",
      outletAddress: "100 Ft Road, Indiranagar, Bengaluru",
      phone: "+91 80 4567 8901",
      email: "indiranagar@restiqfoods.example",
    },
    lines: [{ name: "Butter Naan", quantity: 2, unitPriceMinor: 6000, lineTotalMinor: 12000 }],
    subtotalMinor: 12000,
    discountMinor: 1000,
    discountReason: "Regular guest",
    taxBreakdown: [
      { label: "CGST", ratePercent: 2.5, amountMinor: 275 },
      { label: "SGST", ratePercent: 2.5, amountMinor: 275 },
    ],
    taxMinor: 550,
    totalMinor: 11550,
    pricesIncludeTax: false,
    tenders: [{ method: "cash", amountMinor: 11550, createdAt: "2026-09-02T10:31:00.000Z" }],
    creditNotes: [{ id: "cn-1", amountMinor: 500, reason: "Item returned", createdAt: "2026-09-02T10:45:00.000Z" }],
    notes: ["Thank you for dining with us.", "This is a computer-generated invoice."],
    footerMessage: null,
    ...overrides,
  };
}

function auInvoice(overrides: Partial<InvoiceView> = {}): InvoiceView {
  return {
    invoiceNumber: "INV-AU-0007",
    title: "Tax Invoice",
    issuedAt: "2026-09-02T05:00:00.000Z",
    currency: "AUD",
    seller: {
      legalEntityName: "Restiq Foods Pty Ltd",
      registrationLabel: "ABN",
      registrationNumber: "51 824 753 556",
      fssaiLicense: null,
      outletName: "Restiq - Bondi",
      outletAddress: "12 Beach Rd, Bondi NSW",
      phone: "+61 2 9000 1234",
      email: "bondi@restiqfoods.example",
    },
    lines: [{ name: "Flat White", quantity: 1, unitPriceMinor: 500, lineTotalMinor: 500 }],
    subtotalMinor: 500,
    discountMinor: null,
    discountReason: null,
    taxBreakdown: [{ label: "GST", ratePercent: 10, amountMinor: 45 }],
    taxMinor: 45,
    totalMinor: 500,
    pricesIncludeTax: true,
    tenders: [],
    creditNotes: [],
    notes: [],
    footerMessage: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BillInvoiceView - IN invoice (GSTIN, CGST+SGST)", () => {
  it("renders every section of the fetched InvoiceView", async () => {
    stubFetch(() => jsonResponse(inInvoice()));
    render(<BillInvoiceView billId={BILL_ID} />);

    await screen.findByTestId("bill-invoice-view");

    expect(screen.getByText("Tax Invoice")).toBeTruthy();
    expect(screen.getByText(/INV-2026-0042/)).toBeTruthy();

    const seller = screen.getByTestId("invoice-seller");
    expect(seller.textContent).toContain("Restiq Foods Pvt Ltd");
    expect(seller.textContent).toContain("Restiq - Indiranagar");
    expect(seller.textContent).toContain("GSTIN: 29ABCDE1234F1Z5");
    expect(seller.textContent).toContain("FSSAI: 10023456789012");
    expect(seller.textContent).toContain("+91 80 4567 8901");
    expect(seller.textContent).toContain("indiranagar@restiqfoods.example");

    expect(screen.getByTestId("invoice-line-0").textContent).toContain("Butter Naan");
    expect(screen.getByTestId("invoice-subtotal").textContent).toBe("Subtotal₹120.00");
    expect(screen.getByTestId("invoice-discount").textContent).toContain("Regular guest");
    expect(screen.getByTestId("invoice-tax-0").textContent).toBe("CGST (2.5%)₹2.75");
    expect(screen.getByTestId("invoice-tax-1").textContent).toBe("SGST (2.5%)₹2.75");
    expect(screen.getByTestId("invoice-grand-total").textContent).toBe("₹115.50");
    expect(screen.queryByTestId("invoice-prices-include-tax")).toBeNull();

    expect(screen.getByTestId("invoice-tender-0").textContent).toContain("Cash");
    expect(screen.getByTestId("invoice-credit-note-cn-1").textContent).toContain("Item returned");
    expect(screen.getByTestId("invoice-notes").textContent).toContain("Thank you for dining with us.");
    expect(screen.getByTestId("invoice-notes").textContent).toContain("This is a computer-generated invoice.");
  });

  it("calls window.print when the Print button is clicked", async () => {
    stubFetch(() => jsonResponse(inInvoice()));
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<BillInvoiceView billId={BILL_ID} />);

    await screen.findByTestId("bill-invoice-view");
    await userEvent.click(screen.getByTestId("invoice-print"));

    expect(printSpy).toHaveBeenCalledOnce();
  });
});

describe("BillInvoiceView - AU invoice (ABN, prices include tax)", () => {
  it("shows the Tax Invoice title, ABN registration, and the prices-include-tax line", async () => {
    stubFetch(() => jsonResponse(auInvoice()));
    render(<BillInvoiceView billId={BILL_ID} />);

    await screen.findByTestId("bill-invoice-view");

    expect(screen.getByText("Tax Invoice")).toBeTruthy();
    expect(screen.getByTestId("invoice-seller").textContent).toContain("ABN: 51 824 753 556");
    expect(screen.getByTestId("invoice-tax-0").textContent).toBe("GST (10%)AUD 0.45");
    expect(screen.getByTestId("invoice-prices-include-tax")).toBeTruthy();
    expect(screen.queryByTestId("invoice-discount")).toBeNull();
    expect(screen.queryByTestId("invoice-tenders")).toBeNull();
    expect(screen.queryByTestId("invoice-credit-notes")).toBeNull();
    expect(screen.queryByTestId("invoice-notes")).toBeNull();
  });
});

describe("BillInvoiceView - footerMessage", () => {
  it("renders the footer message when present", async () => {
    stubFetch(() => jsonResponse(inInvoice({ footerMessage: "Follow us @restiqfoods" })));
    render(<BillInvoiceView billId={BILL_ID} />);

    await screen.findByTestId("bill-invoice-view");
    expect(screen.getByTestId("invoice-footer-message").textContent).toBe("Follow us @restiqfoods");
  });

  it("renders nothing when footerMessage is null", async () => {
    stubFetch(() => jsonResponse(inInvoice({ footerMessage: null })));
    render(<BillInvoiceView billId={BILL_ID} />);

    await screen.findByTestId("bill-invoice-view");
    expect(screen.queryByTestId("invoice-footer-message")).toBeNull();
  });
});

describe("BillInvoiceView - AU not GST registered (Receipt)", () => {
  it("shows Receipt, no tax-breakdown rows, and a prominent not-registered callout instead of a buried note", async () => {
    stubFetch(() =>
      jsonResponse(
        auInvoice({
          title: "Receipt",
          taxMinor: 0,
          taxBreakdown: [],
          totalMinor: 500,
          notes: ["Not registered for GST - this is a receipt, not a tax invoice"],
        }),
      ),
    );
    render(<BillInvoiceView billId={BILL_ID} />);

    await screen.findByTestId("bill-invoice-view");

    expect(screen.getByText("Receipt")).toBeTruthy();
    expect(screen.queryByTestId("invoice-tax-0")).toBeNull();
    expect(screen.getByTestId("invoice-not-registered-note").textContent).toContain("Not registered for GST");
    // The note is shown in its own callout, not duplicated in the generic notes block.
    expect(screen.queryByTestId("invoice-notes")).toBeNull();
  });

  it("keeps the tax-breakdown table for the ordinary Tax Invoice path", async () => {
    stubFetch(() => jsonResponse(auInvoice()));
    render(<BillInvoiceView billId={BILL_ID} />);

    await screen.findByTestId("bill-invoice-view");
    expect(screen.getByTestId("invoice-tax-0")).toBeTruthy();
    expect(screen.queryByTestId("invoice-not-registered-note")).toBeNull();
  });
});

describe("BillInvoiceView - not finalized", () => {
  it("shows a plain not-finalized state on a 409", async () => {
    stubFetch(() => jsonResponse({ error: { code: "not_finalized", message: "This bill is still open" } }, 409));
    render(<BillInvoiceView billId={BILL_ID} />);

    expect(await screen.findByTestId("invoice-not-finalized")).toBeTruthy();
    expect(screen.getByText("This bill isn't finalized yet.")).toBeTruthy();
    expect(screen.queryByTestId("invoice-error")).toBeNull();
  });
});

describe("BillInvoiceView - load error", () => {
  it("shows the retryable error panel on a 404", async () => {
    stubFetch(() => jsonResponse({ error: { code: "not_found", message: "No such bill" } }, 404));
    render(<BillInvoiceView billId={BILL_ID} />);

    expect(await screen.findByTestId("invoice-error")).toBeTruthy();
    expect(screen.queryByTestId("invoice-not-finalized")).toBeNull();
  });

  it("retries the fetch when Retry is clicked", async () => {
    let calls = 0;
    stubFetch(() => {
      calls += 1;
      return calls === 1 ? jsonResponse({ error: { code: "not_found" } }, 404) : jsonResponse(inInvoice());
    });
    render(<BillInvoiceView billId={BILL_ID} />);

    await screen.findByTestId("invoice-error");
    await userEvent.click(screen.getByTestId("invoice-error-retry"));

    await screen.findByTestId("bill-invoice-view");
  });
});
