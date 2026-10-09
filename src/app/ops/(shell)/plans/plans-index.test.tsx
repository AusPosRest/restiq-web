import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlanPriceView } from "../api";
import { ToastProvider } from "../toast";
import { PlansIndex } from "./plans-index";

const PRICES: PlanPriceView[] = [
  { country: "IN", plan: "standard", monthlyPriceMinor: 49900, annualDiscountPercent: 20, currency: "INR", updatedAt: "" },
  { country: "IN", plan: "enterprise", monthlyPriceMinor: 99900, annualDiscountPercent: 20, currency: "INR", updatedAt: "" },
];

const PRICES_WITH_AU: PlanPriceView[] = [
  ...PRICES,
  { country: "AU", plan: "standard", monthlyPriceMinor: 4900, annualDiscountPercent: 20, currency: "AUD", updatedAt: "" },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PlansIndex", () => {
  it("edits a price and saves it with a reason", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { monthlyPriceMinor: number; annualDiscountPercent: number };
        return Promise.resolve(json({ price: { ...PRICES[0], ...body } }));
      }
      return Promise.resolve(json({ prices: PRICES }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ToastProvider>
        <PlansIndex />
      </ToastProvider>,
    );
    const user = userEvent.setup();

    const price = await screen.findByTestId("plan-price-IN-standard");
    expect((price as HTMLInputElement).value).toBe("499");
    expect((screen.getByTestId("plan-save-IN-standard") as HTMLButtonElement).disabled).toBe(true);

    await user.clear(price);
    await user.type(price, "599");
    await user.click(screen.getByTestId("plan-save-IN-standard"));
    await user.type(screen.getByTestId("confirm-reason"), "New price list");
    await user.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => expect((screen.getByTestId("plan-save-IN-standard") as HTMLButtonElement).disabled).toBe(true));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(String(put?.[0])).toContain("/ops/api/plan-prices/IN/standard");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ monthlyPriceMinor: 59900, annualDiscountPercent: 20, reason: "New price list" });
  });

  it("blocks a bad price", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ prices: PRICES }))));
    render(
      <ToastProvider>
        <PlansIndex />
      </ToastProvider>,
    );
    const user = userEvent.setup();
    const price = await screen.findByTestId("plan-price-IN-enterprise");
    await user.clear(price);
    await user.type(price, "-5");
    expect(screen.getByTestId("plan-error-IN-enterprise")).toBeTruthy();
    expect((screen.getByTestId("plan-save-IN-enterprise") as HTMLButtonElement).disabled).toBe(true);
  });

  it("splits countries into their own sections", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(json({ prices: PRICES_WITH_AU }))));
    render(
      <ToastProvider>
        <PlansIndex />
      </ToastProvider>,
    );
    const inSection = await screen.findByTestId("plans-country-IN");
    const auSection = screen.getByTestId("plans-country-AU");

    expect(within(inSection).getByTestId("plan-row-IN-standard")).toBeTruthy();
    expect(within(inSection).queryByTestId("plan-row-AU-standard")).toBeNull();
    expect(within(auSection).getByTestId("plan-row-AU-standard")).toBeTruthy();

    expect(within(inSection).getByText("India")).toBeTruthy();
    expect(within(auSection).getByText("Australia")).toBeTruthy();
    expect(within(auSection).getByText("Prices in AUD (A$)")).toBeTruthy();
  });
});
