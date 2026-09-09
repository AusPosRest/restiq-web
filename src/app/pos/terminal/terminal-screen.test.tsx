import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TerminalScreen } from "./terminal-screen";
import type { PaymentIntentView } from "../api";

function intent(id: string, overrides: Partial<PaymentIntentView> = {}): PaymentIntentView {
  return {
    id,
    billId: "bill-1",
    shareGuestId: null,
    rail: "card_terminal",
    provider: "simulated",
    amountMinor: 52500,
    currency: "INR",
    status: "pending",
    failureReason: null,
    providerRef: null,
    client: { simulated: true },
    createdAt: "2026-09-09T06:00:00.000Z",
    expiresAt: "2026-09-09T06:05:00.000Z",
    succeededAt: null,
    tenderId: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TerminalScreen", () => {
  it("idles as Ready while nothing is waiting", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse([]))));
    render(<TerminalScreen outletId="outlet-1" outletName="One - BLR" />);

    await waitFor(() => expect(screen.getByTestId("terminal-status").textContent).toContain("Ready"));
    expect(screen.getByTestId("terminal-idle")).toBeTruthy();
  });

  it("shows the oldest pending amount and Approve posts the simulated success that writes the tender", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input, init) => {
      const url = String(input);
      if (url.includes("outlets/outlet-1/payment-intents")) return Promise.resolve(jsonResponse([intent("pi-1"), intent("pi-2", { amountMinor: 100 })]));
      if (url.includes("payment-intents/pi-1/simulate")) {
        expect(JSON.parse(String(init?.body))).toEqual({ outcome: "success" });
        return Promise.resolve(jsonResponse(intent("pi-1", { status: "succeeded", tenderId: "tender-1", succeededAt: "2026-09-09T06:01:00.000Z" })));
      }
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: url } }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<TerminalScreen outletId="outlet-1" outletName="One - BLR" />);

    await screen.findByTestId("terminal-request-pi-1");
    expect(screen.getByTestId("terminal-amount").textContent).toBe("₹525.00");
    expect(screen.getByTestId("terminal-queue-depth").textContent).toContain("1 more waiting");

    await userEvent.click(screen.getByTestId("terminal-approve"));

    await waitFor(() => expect(screen.getByTestId("terminal-last-result").textContent).toContain("Approved · ₹525.00"));
    // The next request in the queue is up straight away, without waiting for a poll.
    expect(screen.getByTestId("terminal-request-pi-2")).toBeTruthy();
    const simulate = fetchMock.mock.calls.find(([input]) => String(input).includes("payment-intents/pi-1/simulate"));
    expect(simulate?.[1]?.method).toBe("POST");
  });

  it("Decline posts the simulated failure and reports it", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input, init) => {
      const url = String(input);
      if (url.includes("outlets/outlet-1/payment-intents")) return Promise.resolve(jsonResponse([intent("pi-9")]));
      if (url.includes("payment-intents/pi-9/simulate")) {
        expect(JSON.parse(String(init?.body))).toEqual({ outcome: "failure" });
        return Promise.resolve(jsonResponse(intent("pi-9", { status: "failed", failureReason: "declined" })));
      }
      return Promise.resolve(jsonResponse({ error: { code: "not_found", message: url } }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<TerminalScreen outletId="outlet-1" outletName="One - BLR" />);

    await screen.findByTestId("terminal-request-pi-9");
    await userEvent.click(screen.getByTestId("terminal-decline"));

    await waitFor(() => expect(screen.getByTestId("terminal-last-result").textContent).toContain("Declined · ₹525.00"));
    expect(screen.getByTestId("terminal-idle")).toBeTruthy();
  });

  it("flips the status light when the poll fails and keeps whatever it last showed", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<TerminalScreen outletId="outlet-1" outletName="One - BLR" />);

    await waitFor(() => expect(screen.getByTestId("terminal-status").textContent).toContain("Reconnecting"));
    expect(screen.getByTestId("terminal-idle")).toBeTruthy();
  });
});
