import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContractView } from "../../api";
import { ToastProvider } from "../../toast";
import { ContractCard } from "./contract-card";

const URL_END = "/ops/api/tenants/t1/subscription/contract";

const VIEW: ContractView = {
  currency: "AUD",
  billingPeriod: "monthly",
  items: [
    { id: "i1", description: "Restiq Standard plan", quantity: 2, unitAmountMinor: 4900, kind: "recurring", billedAt: null },
    { id: "i3", description: "Old setup", quantity: 1, unitAmountMinor: 9900, kind: "one_time", billedAt: "2026-11-01T00:00:00.000Z" },
  ],
  source: "contract",
  recurringTotalMinor: "9800",
  nextInvoiceOneTimeMinor: "0",
  planAmountMinor: "4900",
  appliesFromNextInvoice: false,
};

const EMPTY: ContractView = { ...VIEW, items: [], source: "plan", recurringTotalMinor: "4900" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function renderCard(view: ContractView, put: () => Response = () => jsonResponse(view)) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith(URL_END) && init?.method === "PUT") return Promise.resolve(put());
    if (url.endsWith(URL_END)) return Promise.resolve(jsonResponse(view));
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  const onSaved = vi.fn();
  render(
    <ToastProvider>
      <ContractCard tenantId="t1" plan="standard" onSaved={onSaved} />
    </ToastProvider>,
  );
  return { fetchMock, onSaved };
}

function putBody(fetchMock: ReturnType<typeof renderCard>["fetchMock"]): unknown {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
  return call ? JSON.parse(call[1]?.body as string) : undefined;
}

const save = () => screen.getByTestId("contract-save") as HTMLButtonElement;

describe("ContractCard", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("loads and renders rows, totals and the read-only billed row", async () => {
    renderCard(VIEW);
    expect(((await screen.findByTestId("contract-description-0")) as HTMLInputElement).value).toBe("Restiq Standard plan");
    expect((screen.getByTestId("contract-amount-0") as HTMLInputElement).value).toBe("49.00");
    expect(screen.getByTestId("contract-line-total-0").textContent).toBe("A$98.00");
    expect(screen.getByTestId("contract-recurring-total").textContent).toBe("A$98.00");
    const billed = screen.getByTestId("contract-billed-i3");
    expect(billed.textContent).toContain("Billed");
    expect(billed.querySelector("input, select, button")).toBeNull();
    expect(screen.queryByTestId("contract-save")).toBeNull();
    expect(screen.queryByTestId("contract-next-invoice-note")).toBeNull();
  });

  it("shows the plan-price message when there is no contract", async () => {
    renderCard(EMPTY);
    expect((await screen.findByTestId("contract-plan-source")).textContent).toContain("standard plan price (A$49.00 per month)");
  });

  it("adds, edits and removes a row; Save sends the items and reason", async () => {
    const { fetchMock, onSaved } = renderCard(VIEW);
    await screen.findByTestId("contract-row-0");
    await userEvent.click(screen.getByTestId("contract-add"));
    await userEvent.type(screen.getByTestId("contract-description-1"), "Setup fee");
    await userEvent.type(screen.getByTestId("contract-amount-1"), "150");
    await userEvent.selectOptions(screen.getByTestId("contract-kind-1"), "one_time");
    expect(screen.getByTestId("contract-one-time-total").textContent).toBe("A$150.00");
    await userEvent.clear(screen.getByTestId("contract-quantity-0"));
    await userEvent.type(screen.getByTestId("contract-quantity-0"), "3");
    await userEvent.click(screen.getByTestId("contract-add"));
    await userEvent.click(screen.getByLabelText("Remove line 3"));
    expect(screen.queryByTestId("contract-row-2")).toBeNull();

    expect(save().disabled).toBe(true); // no reason yet
    await userEvent.type(screen.getByTestId("contract-reason"), "Signed deal");
    expect(save().disabled).toBe(false);
    await userEvent.click(save());

    await screen.findByTestId("toast-success");
    expect(putBody(fetchMock)).toEqual({
      items: [
        { description: "Restiq Standard plan", quantity: 3, unitAmountMinor: 4900, kind: "recurring" },
        { description: "Setup fee", quantity: 1, unitAmountMinor: 15000, kind: "one_time" },
      ],
      reason: "Signed deal",
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("start from plan price adds a recurring plan row", async () => {
    const { fetchMock } = renderCard(EMPTY);
    await userEvent.click(await screen.findByTestId("contract-start-from-plan"));
    expect((screen.getByTestId("contract-description-0") as HTMLInputElement).value).toBe("Restiq Standard plan");
    expect((screen.getByTestId("contract-kind-0") as HTMLSelectElement).value).toBe("recurring");
    await userEvent.type(screen.getByTestId("contract-reason"), "Custom price");
    await userEvent.click(save());
    await waitFor(() => expect(putBody(fetchMock)).toEqual({ items: [{ description: "Restiq Standard plan", quantity: 1, unitAmountMinor: 4900, kind: "recurring" }], reason: "Custom price" }));
  });

  it("start from plan price is disabled without a plan price", async () => {
    renderCard({ ...EMPTY, planAmountMinor: null });
    expect(((await screen.findByTestId("contract-start-from-plan")) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("contract-plan-source").textContent).toContain("no price set");
  });

  it("validation blocks Save", async () => {
    const { fetchMock } = renderCard(VIEW);
    await screen.findByTestId("contract-row-0");
    await userEvent.clear(screen.getByTestId("contract-quantity-0"));
    await userEvent.type(screen.getByTestId("contract-quantity-0"), "0");
    await userEvent.type(screen.getByTestId("contract-reason"), "Typo");
    expect(screen.getByTestId("contract-validation-error").textContent).toContain("Line 1");
    expect(save().disabled).toBe(true);
    await userEvent.click(save());
    expect(putBody(fetchMock)).toBeUndefined();
  });

  it("shows the next-invoice note when card billing is active", async () => {
    renderCard({ ...VIEW, appliesFromNextInvoice: true });
    expect((await screen.findByTestId("contract-next-invoice-note")).textContent).toContain("apply from the next invoice");
  });

  it("shows stripe_sync_failed inline and keeps Save available to retry", async () => {
    const message = "The contract is saved but Stripe could not be updated. Save again to retry.";
    const { onSaved } = renderCard(VIEW, () => jsonResponse({ error: { code: "stripe_sync_failed", message } }, 502));
    await screen.findByTestId("contract-row-0");
    await userEvent.click(screen.getByTestId("contract-remove-0"));
    await userEvent.type(screen.getByTestId("contract-reason"), "Back to plan");
    await userEvent.click(save());
    expect((await screen.findByTestId("contract-save-error")).textContent).toBe(message);
    expect(save().disabled).toBe(false);
    expect(onSaved).toHaveBeenCalled();
  });
});
