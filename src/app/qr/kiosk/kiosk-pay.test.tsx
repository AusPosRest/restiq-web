// Issue #220: pay by card on the kiosk, then print the receipt out of the kiosk's slot.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KioskPay } from "./kiosk-pay";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const BILL = {
  id: "b1", orderId: "o1", billNumber: null, subtotalMinor: 1000, taxMinor: 100, discountMinor: null, discountReason: null, totalMinor: 1100,
  status: "open", createdAt: "", finalizedAt: null, tenders: [], shares: [],
};
const INVOICE = {
  invoiceNumber: "INV-7", title: "Tax Invoice", issuedAt: "2026-09-12T10:00:00.000Z", currency: "AUD",
  seller: { legalEntityName: "Bay Leaf", registrationLabel: "ABN", registrationNumber: "123", outletName: "One", outletAddress: "1 Street" },
  lines: [{ name: "Garden Salad", quantity: 1, unitPriceMinor: 1000, lineTotalMinor: 1000 }],
  subtotalMinor: 1000, discountMinor: null, taxBreakdown: [{ label: "GST", ratePercent: 10, amountMinor: 100 }], taxMinor: 100, totalMinor: 1100,
  tenders: [{ method: "card_terminal", amountMinor: 1100, createdAt: "" }], footerMessage: null,
};

function routeFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    if (key === "POST /qr/api/orders/o1/bill") return Promise.resolve(json(BILL, 201));
    if (key === "POST /qr/api/bills/b1/pay-all") return Promise.resolve(json({ ...BILL, status: "finalized" }));
    if (key === "GET /qr/api/bills/b1/invoice") return Promise.resolve(json(INVOICE));
    return Promise.resolve(json({ error: { message: `unhandled ${key}` } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.getElementById("kiosk-receipt-tray")?.remove();
});

describe("KioskPay", () => {
  it("pays by card on the kiosk, then prints the receipt out of the kiosk's slot", async () => {
    const fetchMock = routeFetch();
    const tray = document.createElement("div");
    tray.id = "kiosk-receipt-tray";
    document.body.appendChild(tray);
    render(<KioskPay orderId="o1" tokenNumber={24} currency="AUD" />);

    await userEvent.click(screen.getByTestId("kiosk-pay-start"));
    expect((await screen.findByTestId("kiosk-pay-total")).textContent).toContain("11");
    await userEvent.click(screen.getByTestId("kiosk-pay-approve"));
    await screen.findByTestId("kiosk-pay-paid");
    const payCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/pay-all"));
    expect(JSON.parse(String(payCall?.[1]?.body))).toEqual({ simulatedOutcome: "success" });

    await userEvent.click(screen.getByTestId("kiosk-pay-print"));
    const receipt = screen.getByTestId("kiosk-receipt");
    expect(tray.contains(receipt)).toBe(true);
    expect(screen.getByTestId("kiosk-receipt-token").textContent).toBe("#24");
    expect(receipt.textContent).toContain("1 x Garden Salad");
    expect(receipt.textContent).toContain("Paid - Card");
    expect(screen.getByTestId("kiosk-pay-print").textContent).toContain("Print another copy");
  });

  it("a declined card charges nothing and lets the guest try again", async () => {
    const fetchMock = routeFetch();
    render(<KioskPay orderId="o1" tokenNumber={24} currency="AUD" />);

    await userEvent.click(screen.getByTestId("kiosk-pay-start"));
    await userEvent.click(await screen.findByTestId("kiosk-pay-decline"));
    expect(screen.getByTestId("kiosk-pay-declined").textContent).toContain("declined");
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/pay-all"))).toBe(false);
    expect(screen.getByTestId("kiosk-pay-approve")).toBeTruthy();
  });

  it("shows the backend's refusal and goes back to the offer on retry", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ error: { code: "session_closed", message: "This table session has ended" } }, 410))));
    render(<KioskPay orderId="o1" tokenNumber={24} currency="AUD" />);

    await userEvent.click(screen.getByTestId("kiosk-pay-start"));
    expect((await screen.findByTestId("kiosk-pay-error")).textContent).toContain("This table session has ended");
    await userEvent.click(screen.getByTestId("kiosk-pay-retry"));
    expect(screen.getByTestId("kiosk-pay-start")).toBeTruthy();
  });
});
