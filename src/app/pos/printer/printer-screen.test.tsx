import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrinterScreen } from "./printer-screen";
import type { InvoiceView, PrintJobView } from "../api";

const INVOICE: InvoiceView = {
  invoiceNumber: null,
  status: "open",
  title: "Bill",
  issuedAt: null,
  currency: "AUD",
  seller: {
    legalEntityName: "Bay Leaf Kitchens",
    registrationLabel: "ABN",
    registrationNumber: "12345678900",
    fssaiLicense: null,
    outletName: "One - BLR",
    outletAddress: "New one",
    phone: "+61 2 9000 0000",
    email: "hello@bayleaf.example",
  },
  lines: [{ name: "Flat white", quantity: 2, unitPriceMinor: 450, lineTotalMinor: 900 }],
  subtotalMinor: 900,
  discountMinor: null,
  discountReason: null,
  taxBreakdown: [{ label: "GST", ratePercent: 10, amountMinor: 82 }],
  taxMinor: 82,
  totalMinor: 900,
  pricesIncludeTax: true,
  tenders: [],
  creditNotes: [],
  notes: [],
  footerMessage: null,
};

function job(id: string): PrintJobView {
  return { id, billId: `bill-${id}`, payload: INVOICE, createdAt: "2026-09-09T00:00:00.000Z", printedAt: null };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PrinterScreen", () => {
  it("shows an empty roll while no jobs are spooled", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse([]))));
    render(<PrinterScreen outletId="outlet-1" outletName="One - BLR" />);

    await waitFor(() => expect(screen.getByTestId("printer-status").textContent).toContain("Ready"));
    expect(screen.getByTestId("printer-empty")).toBeTruthy();
  });

  it("prints each pending job onto the roll and acks it", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input) => {
      const url = String(input);
      if (url.includes("outlets/outlet-1/print-jobs")) return Promise.resolve(jsonResponse([job("j1")]));
      if (url.includes("print-jobs/j1/printed")) return Promise.resolve(jsonResponse({ ...job("j1"), printedAt: "2026-09-09T00:00:05.000Z" }));
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: url } }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PrinterScreen outletId="outlet-1" outletName="One - BLR" />);

    const receipt = await screen.findByTestId("printer-receipt-j1");
    expect(receipt.textContent).toContain("Flat white");
    expect(receipt.textContent).toContain("Bay Leaf Kitchens");
    const ack = fetchMock.mock.calls.find(([input]) => String(input).includes("print-jobs/j1/printed"));
    expect(ack?.[1]?.method).toBe("POST");
    expect(screen.queryByTestId("printer-empty")).toBeNull();
  });

  it("shows a job on the roll before its ack completes, so a torn-down effect never loses an acked job", async () => {
    let resolveAck: (value: Response) => void = () => undefined;
    const ackPending = new Promise<Response>((resolve) => {
      resolveAck = resolve;
    });
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>((input) => {
      const url = String(input);
      if (url.includes("outlets/outlet-1/print-jobs")) return Promise.resolve(jsonResponse([job("j2")]));
      if (url.includes("print-jobs/j2/printed")) return ackPending;
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: url } }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<PrinterScreen outletId="outlet-1" outletName="One - BLR" />);

    // The receipt is on the roll while the ack is still in flight.
    expect((await screen.findByTestId("printer-receipt-j2")).textContent).toContain("Flat white");
    unmount();
    resolveAck(jsonResponse({ ...job("j2"), printedAt: "2026-09-09T00:00:05.000Z" }));
  });

  it("keeps the roll and shows Reconnecting when a poll fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<PrinterScreen outletId="outlet-1" outletName="One - BLR" />);

    await waitFor(() => expect(screen.getByTestId("printer-status").textContent).toContain("Reconnecting"));
  });
});
