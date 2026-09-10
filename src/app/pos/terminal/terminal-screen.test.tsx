import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TerminalScreen } from "./terminal-screen";
import type { PaymentIntentView } from "../api";

// The card flow holds "Processing" for over a second on purpose, so every
// assertion past a settle waits longer than testing-library's 1 s default.
const SETTLED = { timeout: 5_000 };

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

/** One pending intent, and a simulate endpoint that echoes the posted outcome back as a settled intent. */
function stubTerminal(pending: PaymentIntentView[]) {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input, init) => {
    const url = String(input);
    if (url.includes("outlets/outlet-1/payment-intents")) return Promise.resolve(jsonResponse(pending));
    const simulate = /payment-intents\/([^/]+)\/simulate/.exec(url);
    if (simulate) {
      const outcome = (JSON.parse(String(init?.body)) as { outcome: string }).outcome;
      const source = pending.find((entry) => entry.id === simulate[1]) ?? pending[0];
      return Promise.resolve(
        jsonResponse(
          intent(simulate[1], {
            amountMinor: source.amountMinor,
            currency: source.currency,
            ...(outcome === "success" ? { status: "succeeded", tenderId: "tender-1" } : { status: "failed", failureReason: "declined" }),
          }),
        ),
      );
    }
    return Promise.resolve(jsonResponse({ error: { code: "not_found", message: url } }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The device opens on the rail chooser, exactly as a real terminal does. */
async function chooseCards() {
  await userEvent.click(screen.getByTestId("terminal-rail-cards"));
}

async function enterPin(digits: string) {
  for (const digit of digits) await userEvent.click(screen.getByTestId(`terminal-pin-${digit}`));
  await userEvent.click(screen.getByTestId("terminal-pin-confirm"));
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

  it("opens on the payment-method screen and only cards continue; the other rails say why", async () => {
    const fetchMock = stubTerminal([intent("pi-0")]);
    render(<TerminalScreen outletId="outlet-1" outletName="One - BLR" />);

    await screen.findByTestId("terminal-request-pi-0");
    for (const rail of ["upi", "cards", "wallets", "emi"]) expect(screen.getByTestId(`terminal-rail-${rail}`)).toBeTruthy();

    await userEvent.click(screen.getByTestId("terminal-rail-upi"));
    expect(screen.getByTestId("terminal-rail-note").textContent).toContain("card payments");
    expect(screen.queryByTestId("terminal-method-tap")).toBeNull();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/simulate"))).toBe(false);

    await chooseCards();
    expect(screen.getByTestId("terminal-method-tap")).toBeTruthy();
  });

  it("shows the oldest amount and a contactless tap under the floor limit approves with no PIN", async () => {
    const fetchMock = stubTerminal([intent("pi-1"), intent("pi-2", { amountMinor: 100 })]);
    render(<TerminalScreen outletId="outlet-1" outletName="One - BLR" />);

    await screen.findByTestId("terminal-request-pi-1");
    expect(screen.getByTestId("terminal-amount").textContent).toBe("₹525.00");
    expect(screen.getByTestId("terminal-queue-depth").textContent).toContain("1 more waiting");

    await chooseCards();
    await userEvent.click(screen.getByTestId("terminal-method-tap"));
    expect(screen.getByTestId("terminal-processing")).toBeTruthy();
    expect(screen.queryByTestId("terminal-pin-pad")).toBeNull();

    await waitFor(() => expect(screen.getByTestId("terminal-result").textContent).toContain("Approved"), SETTLED);
    expect(screen.getByTestId("terminal-last-result").textContent).toContain("Approved · ₹525.00");
    const simulate = fetchMock.mock.calls.find(([input]) => String(input).includes("payment-intents/pi-1/simulate"));
    expect(simulate?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(simulate?.[1]?.body))).toEqual({ outcome: "success" });
  });

  it("asks for a PIN on insert and only settles once four digits are confirmed", async () => {
    const fetchMock = stubTerminal([intent("pi-3")]);
    render(<TerminalScreen outletId="outlet-1" outletName="One - BLR" />);

    await screen.findByTestId("terminal-request-pi-3");
    await chooseCards();
    await userEvent.click(screen.getByTestId("terminal-method-insert"));

    expect(screen.getByTestId("terminal-pin-pad")).toBeTruthy();
    expect(screen.getByTestId("terminal-method-in-use").textContent).toContain("Chip");
    expect((screen.getByTestId("terminal-pin-confirm") as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(screen.getByTestId("terminal-pin-1"));
    await userEvent.click(screen.getByTestId("terminal-pin-2"));
    expect((screen.getByTestId("terminal-pin-confirm") as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/simulate"))).toBe(false);

    await userEvent.click(screen.getByTestId("terminal-pin-3"));
    await userEvent.click(screen.getByTestId("terminal-pin-4"));
    await userEvent.click(screen.getByTestId("terminal-pin-confirm"));

    await waitFor(() => expect(screen.getByTestId("terminal-result").textContent).toContain("Approved"), SETTLED);
  });

  it("asks for a PIN on a tap above the contactless floor limit", async () => {
    stubTerminal([intent("pi-4", { amountMinor: 600_000 })]);
    render(<TerminalScreen outletId="outlet-1" outletName="One - BLR" />);

    await screen.findByTestId("terminal-request-pi-4");
    await chooseCards();
    await userEvent.click(screen.getByTestId("terminal-method-tap"));

    expect(screen.getByTestId("terminal-pin-pad")).toBeTruthy();
    expect(screen.queryByTestId("terminal-processing")).toBeNull();
  });

  it("declines when the simulated bank answer is set to Decline", async () => {
    const fetchMock = stubTerminal([intent("pi-9")]);
    render(<TerminalScreen outletId="outlet-1" outletName="One - BLR" />);

    await screen.findByTestId("terminal-request-pi-9");
    await userEvent.click(screen.getByTestId("terminal-outcome-decline"));
    await chooseCards();
    await userEvent.click(screen.getByTestId("terminal-method-swipe"));
    await enterPin("1234");

    await waitFor(() => expect(screen.getByTestId("terminal-result").textContent).toContain("Declined"), SETTLED);
    expect(screen.getByTestId("terminal-last-result").textContent).toContain("Declined · ₹525.00");
    const simulate = fetchMock.mock.calls.find(([input]) => String(input).includes("payment-intents/pi-9/simulate"));
    expect(JSON.parse(String(simulate?.[1]?.body))).toEqual({ outcome: "failure" });
  });

  it("steps back through PIN and card screens, and only declines from the first screen", async () => {
    const fetchMock = stubTerminal([intent("pi-5")]);
    render(<TerminalScreen outletId="outlet-1" outletName="One - BLR" />);

    await screen.findByTestId("terminal-request-pi-5");
    await chooseCards();
    await userEvent.click(screen.getByTestId("terminal-method-insert"));

    // Cancel PIN → back to the card screen, nothing sent.
    await userEvent.click(screen.getByTestId("terminal-cancel"));
    expect(screen.getByTestId("terminal-method-tap")).toBeTruthy();

    // Back → the payment-method screen, still nothing sent.
    await userEvent.click(screen.getByTestId("terminal-cancel"));
    expect(screen.getByTestId("terminal-rail-cards")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/simulate"))).toBe(false);

    // Cancel payment on the first screen declines the intent.
    await userEvent.click(screen.getByTestId("terminal-cancel"));
    await waitFor(() => expect(screen.getByTestId("terminal-result").textContent).toContain("Declined"), SETTLED);
  });

  it("flips the status light when the poll fails and keeps whatever it last showed", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<TerminalScreen outletId="outlet-1" outletName="One - BLR" />);

    await waitFor(() => expect(screen.getByTestId("terminal-status").textContent).toContain("Reconnecting"));
    expect(screen.getByTestId("terminal-idle")).toBeTruthy();
  });
});
