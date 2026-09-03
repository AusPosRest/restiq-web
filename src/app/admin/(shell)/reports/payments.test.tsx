import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutletProvider } from "../outlet-context";
import { ToastProvider } from "../toast";
import { Payments } from "./payments";
import type { PaymentRow, PaymentsResponse } from "./payments-state";

const OUTLETS = [{ id: "outlet-1", name: "Indiranagar", address: "100 Ft Road", type: "dine_in", timezone: "Asia/Kolkata" }];

// "Today" in Asia/Kolkata (UTC+5:30, no DST) for this fixed system time is
// 2026-09-03 - the default filter range payments-state.ts's outletLocalDate
// should land on, and the ISO instants payments-state.test.ts already proves
// that date converts to.
const SYSTEM_TIME = "2026-09-03T10:00:00.000Z";
const DEFAULT_FROM_ISO = "2026-09-02T18:30:00.000Z";
const DEFAULT_TO_ISO = "2026-09-03T18:29:59.999Z";

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    billId: "bill-1",
    billNumber: 501,
    finalizedAt: "2026-09-03T08:05:00.000Z",
    outletId: "outlet-1",
    outletName: "Indiranagar",
    orderId: "order-1",
    source: "pos",
    tableLabel: "T4",
    tokenNumber: null,
    cashierName: "Asha",
    subtotalMinor: 100000,
    discountMinor: 5000,
    discountReason: "Loyalty",
    taxMinor: 5000,
    taxBreakdown: [
      { label: "CGST", ratePercent: 2.5, amountMinor: 2500 },
      { label: "SGST", ratePercent: 2.5, amountMinor: 2500 },
    ],
    totalMinor: 100000,
    tenders: [
      { method: "cash", amountMinor: 60000, createdAt: "2026-09-03T08:05:00.000Z" },
      { method: "card", amountMinor: 40000, createdAt: "2026-09-03T08:05:00.000Z" },
    ],
    creditNotes: [{ id: "cn-1", amountMinor: 1000, reason: "Wrong item", createdAt: "2026-09-03T08:10:00.000Z" }],
    ...overrides,
  };
}

const TOTALS = { count: 2, subtotalMinor: 150000, discountMinor: 5000, taxMinor: 8000, totalMinor: 233000, tenderedMinor: 233000, refundedMinor: 1000 };

function firstPageResponse(): PaymentsResponse {
  return {
    items: [
      paymentRow(),
      paymentRow({
        billId: "bill-2",
        billNumber: 502,
        tableLabel: null,
        tokenNumber: 7,
        source: "qr",
        cashierName: null,
        discountMinor: null,
        discountReason: null,
        taxMinor: 3000,
        taxBreakdown: undefined,
        totalMinor: 133000,
        tenders: [{ method: "upi", amountMinor: 133000, createdAt: "2026-09-03T09:00:00.000Z" }],
        creditNotes: [],
      }),
    ],
    nextCursor: "cursor-2",
    totals: TOTALS,
  };
}

function secondPageResponse(): PaymentsResponse {
  return {
    items: [paymentRow({ billId: "bill-3", billNumber: 503, tableLabel: "T9", taxBreakdown: undefined, tenders: [], creditNotes: [] })],
    nextCursor: null,
    totals: { ...TOTALS, count: 3 },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="${filename}"` },
  });
}

function stubFetch(overrides: { payments?: () => Response; export?: () => Response } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/admin/api/outlets")) return Promise.resolve(jsonResponse(OUTLETS));
    if (url.includes("/reports/payments/export")) {
      return Promise.resolve(overrides.export ? overrides.export() : csvResponse("bill,total\n501,1000", "payments.csv"));
    }
    if (url.includes("/reports/payments")) {
      if (overrides.payments) return Promise.resolve(overrides.payments());
      if (url.includes("cursor=cursor-2")) return Promise.resolve(jsonResponse(secondPageResponse()));
      return Promise.resolve(jsonResponse(firstPageResponse()));
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: "unhandled" } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPayments() {
  return render(
    <ToastProvider>
      <OutletProvider>
        <Payments />
      </OutletProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(SYSTEM_TIME));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Payments", () => {
  it("loads the default (today, outlet-local) range and renders totals and rows, including tax breakdown and tender chips", async () => {
    const fetchMock = stubFetch();
    renderPayments();

    expect(await screen.findByTestId("payments-row-bill-1")).toBeTruthy();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/reports/payments?outletId=outlet-1&from=${encodeURIComponent(DEFAULT_FROM_ISO)}&to=${encodeURIComponent(DEFAULT_TO_ISO)}`),
        expect.anything(),
      );
    });

    expect(screen.getByTestId("payments-totals-count").textContent).toContain("2");
    expect(screen.getByTestId("payments-totals-total").textContent).toContain("2330");
    expect(screen.getByTestId("payments-totals-refunded").textContent).toContain("10");

    const row = screen.getByTestId("payments-row-bill-1");
    expect(within(row).getByTestId("payments-row-bill-1-link").textContent).toBe("#501");
    expect(within(row).getByTestId("payments-row-bill-1-link").getAttribute("href")).toBe("/pos/bills/bill-1/invoice");
    expect(row.textContent).toContain("CGST (2.5%)");
    expect(row.textContent).toContain("SGST (2.5%)");
    expect(row.textContent).toContain("cash=");
    expect(row.textContent).toContain("card=");

    const tokenRow = screen.getByTestId("payments-row-bill-2");
    expect(tokenRow.textContent).toContain("Token #7");
    expect(tokenRow.textContent).toContain("QR");
    expect(tokenRow.textContent).toContain("upi=");
  });

  it("Load more appends rows using nextCursor and reflects the new page's totals", async () => {
    const fetchMock = stubFetch();
    renderPayments();
    await screen.findByTestId("payments-row-bill-1");

    expect(screen.getByTestId("payments-load-more")).toBeTruthy();
    await userEvent.click(screen.getByTestId("payments-load-more"));

    expect(await screen.findByTestId("payments-row-bill-3")).toBeTruthy();
    expect(screen.getByTestId("payments-row-bill-1")).toBeTruthy();
    expect(screen.getByTestId("payments-row-bill-2")).toBeTruthy();
    expect(screen.queryByTestId("payments-load-more")).toBeNull();
    expect(screen.getByTestId("payments-totals-count").textContent).toContain("3");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("cursor=cursor-2"), expect.anything());
    });
  });

  it("changing the date filters refetches with the new query", async () => {
    const fetchMock = stubFetch();
    renderPayments();
    await screen.findByTestId("payments-row-bill-1");

    const fromInput = screen.getByTestId("payments-filter-from") as HTMLInputElement;
    fireEvent.change(fromInput, { target: { value: "2026-09-01" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`from=${encodeURIComponent("2026-08-31T18:30:00.000Z")}`), expect.anything());
    });
  });

  it("Export CSV fetches the export endpoint and triggers a browser download", async () => {
    const fetchMock = stubFetch();
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderPayments();
    await screen.findByTestId("payments-row-bill-1");

    await userEvent.click(screen.getByTestId("payments-export"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/reports/payments/export?outletId=outlet-1&from=${encodeURIComponent(DEFAULT_FROM_ISO)}`),
      );
    });
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    expect(await screen.findByTestId("toast-success")).toBeTruthy();
    expect(screen.getByTestId("toast-success").textContent).toContain("payments.csv");
  });

  it("shows an empty state when there are no payments in range", async () => {
    stubFetch({ payments: () => jsonResponse({ items: [], nextCursor: null, totals: { count: 0, subtotalMinor: 0, discountMinor: 0, taxMinor: 0, totalMinor: 0, tenderedMinor: 0, refundedMinor: 0 } }) });
    renderPayments();

    expect(await screen.findByTestId("payments-empty")).toBeTruthy();
    expect(screen.queryByTestId("payments-table")).toBeNull();
  });

  it("shows a retryable error panel on failure", async () => {
    const fetchMock = stubFetch({ payments: () => jsonResponse({ error: { code: "error", message: "nope" } }, 500) });
    renderPayments();

    expect(await screen.findByTestId("payments-load-error")).toBeTruthy();
    const callsBeforeRetry = fetchMock.mock.calls.length;
    await userEvent.click(screen.getByTestId("payments-load-error-retry"));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry));
  });
});
