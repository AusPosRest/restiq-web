// CAP-5: suspend/reactivate are pessimistic (busy state, then toast) and the
// status badge maps suspended/arrears to the right semantic color
// (EXPERIENCE.md, DESIGN.md).
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubscriptionView } from "../../api";
import { ToastProvider } from "../../toast";
import { SubscriptionTab } from "./subscription-tab";

const TENANT_ID = "0192cccc-0000-7000-8000-000000000003";

function subscription(overrides: Partial<SubscriptionView> = {}): SubscriptionView {
  return {
    tenantId: TENANT_ID,
    status: "active",
    plan: "standard",
    billingPeriod: "monthly",
    currentPeriodStart: "2026-08-01T00:00:00.000Z",
    currentPeriodEnd: "2026-08-31T00:00:00.000Z",
    suspendedAt: null,
    graceWindowHours: 72,
    cardBilling: { status: "not_set_up", amountMinor: "4900", currency: "AUD" },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function renderTab(sub: SubscriptionView, extraRoutes?: (url: string, init?: RequestInit) => Response | undefined) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const extra = extraRoutes?.(url, init);
    if (extra) return Promise.resolve(extra);
    if (url.endsWith(`/ops/api/tenants/${TENANT_ID}/subscription`)) return Promise.resolve(jsonResponse(sub));
    if (url.endsWith(`/ops/api/tenants/${TENANT_ID}/subscription/invoices`)) return Promise.resolve(jsonResponse({ invoices: [] }));
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <ToastProvider>
      <SubscriptionTab tenantId={TENANT_ID} />
    </ToastProvider>,
  );
  return fetchMock;
}

describe("SubscriptionTab", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("shows a loading skeleton before data lands", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    render(
      <ToastProvider>
        <SubscriptionTab tenantId={TENANT_ID} />
      </ToastProvider>,
    );
    expect(screen.getByTestId("subscription-loading")).toBeTruthy();
  });

  it("renders the plan, period and status badge for an active subscription", async () => {
    renderTab(subscription());
    await screen.findByTestId("subscription-tab");
    expect(screen.getByTestId("subscription-status").textContent).toBe("active");
    expect(screen.getByText("standard · monthly")).toBeTruthy();
    expect(screen.getByTestId("subscription-grace-window").textContent).toBe("72h");
    expect(screen.getByTestId("subscription-suspend")).toBeTruthy();
    expect(screen.queryByTestId("subscription-reactivate")).toBeNull();
  });

  it("maps suspended to the critical badge and shows the read-only banner", async () => {
    renderTab(subscription({ status: "suspended", suspendedAt: "2026-08-20T00:00:00.000Z" }));
    await screen.findByTestId("subscription-tab");
    const badge = screen.getByTestId("subscription-status");
    expect(badge.textContent).toBe("suspended");
    expect(badge.className).toContain("status-critical");
    expect(screen.getByTestId("subscription-suspended-banner")).toBeTruthy();
    expect(screen.getByTestId("subscription-reactivate")).toBeTruthy();
    expect(screen.queryByTestId("subscription-suspend")).toBeNull();
  });

  it("card billing: shows status and amount, creates a billing link", async () => {
    renderTab(subscription(), (url, init) =>
      url.endsWith("/subscription/billing-link") && init?.method === "POST"
        ? jsonResponse({ url: "https://checkout.stripe.test/x", expiresAt: "2026-08-24T00:00:00.000Z" })
        : undefined,
    );
    await screen.findByTestId("subscription-tab");
    expect(screen.getByTestId("card-billing-status").textContent).toBe("not set up");
    expect(screen.getByTestId("card-billing-amount").textContent).toContain("49.00");
    await userEvent.click(screen.getByTestId("card-billing-copy"));
    expect((await screen.findByTestId("card-billing-link-result-url") as HTMLInputElement).value).toBe("https://checkout.stripe.test/x");
  });

  it("card billing: Open checkout opens the tab inside the click, then points it at Checkout", async () => {
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() };
    const open = vi.fn(() => tab);
    vi.stubGlobal("open", open);
    renderTab(subscription(), (url, init) =>
      url.endsWith("/subscription/billing-link") && init?.method === "POST"
        ? jsonResponse({ url: "https://checkout.stripe.test/x", expiresAt: "2026-08-24T00:00:00.000Z" })
        : undefined,
    );
    await screen.findByTestId("subscription-tab");
    await userEvent.click(screen.getByTestId("card-billing-open"));
    await waitFor(() => expect(tab.location.href).toBe("https://checkout.stripe.test/x"));
    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(tab.opener).toBeNull();
    expect(screen.queryByTestId("card-billing-link-result")).toBeNull();
  });

  it("card billing: closes the opened tab when the link can't be made", async () => {
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() };
    vi.stubGlobal("open", vi.fn(() => tab));
    renderTab(subscription(), (url, init) =>
      url.endsWith("/subscription/billing-link") && init?.method === "POST"
        ? jsonResponse({ error: { code: "price_not_set", message: "No monthly price is set." } }, 409)
        : undefined,
    );
    await screen.findByTestId("subscription-tab");
    await userEvent.click(screen.getByTestId("card-billing-open"));
    await screen.findByTestId("card-billing-error");
    expect(tab.close).toHaveBeenCalled();
  });

  it("card billing: price_not_set points to the Plans page", async () => {
    renderTab(subscription(), (url, init) =>
      url.endsWith("/subscription/billing-link") && init?.method === "POST"
        ? jsonResponse({ error: { code: "price_not_set", message: "No monthly price is set." } }, 409)
        : undefined,
    );
    await screen.findByTestId("subscription-tab");
    await userEvent.click(screen.getByTestId("card-billing-copy"));
    expect((await screen.findByTestId("card-billing-error")).textContent).toContain("Plans page");
  });

  it("maps arrears to the warning badge", async () => {
    renderTab(subscription({ status: "arrears" }));
    await screen.findByTestId("subscription-tab");
    expect(screen.getByTestId("subscription-status").className).toContain("status-warning");
  });

  it("suspend: pessimistic - stays busy until the API resolves, then toasts and refetches", async () => {
    let resolveSuspend: (value: Response) => void = () => undefined;
    const suspendPromise = new Promise<Response>((resolve) => {
      resolveSuspend = resolve;
    });
    const fetchMock = renderTab(subscription());
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith(`/ops/api/tenants/${TENANT_ID}/subscription/suspend`)) return suspendPromise;
      if (url.endsWith(`/ops/api/tenants/${TENANT_ID}/subscription`)) {
        return Promise.resolve(jsonResponse(subscription({ status: "suspended", suspendedAt: "2026-08-24T00:00:00.000Z" })));
      }
      if (url.endsWith(`/ops/api/tenants/${TENANT_ID}/subscription/invoices`)) return Promise.resolve(jsonResponse({ invoices: [] }));
      return Promise.resolve(jsonResponse({}));
    });

    await screen.findByTestId("subscription-tab");
    await userEvent.click(screen.getByTestId("subscription-suspend"));
    expect(screen.getByTestId("confirm-dialog").textContent).toContain("Suspend this subscription");
    expect((screen.getByTestId("confirm-submit") as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByTestId("confirm-reason"), "Non-payment beyond arrears window");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    // Busy: the button shows the working state while the request is in flight.
    await waitFor(() => expect(screen.getByTestId("confirm-submit").textContent).toContain("Working"));
    expect(screen.queryByTestId("toast-success")).toBeNull();

    resolveSuspend(jsonResponse({ subscription: subscription({ status: "suspended" }) }));

    expect(await screen.findByTestId("toast-success")).toBeTruthy();
    const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(`/ops/api/tenants/${TENANT_ID}/subscription/suspend`))!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ reason: "Non-payment beyond arrears window" });
  });

  it("reactivate: posts the reason and refetches to active", async () => {
    const fetchMock = renderTab(subscription({ status: "suspended", suspendedAt: "2026-08-20T00:00:00.000Z" }), (url) => {
      if (url.endsWith(`/ops/api/tenants/${TENANT_ID}/subscription/reactivate`)) {
        return jsonResponse({ subscription: subscription({ status: "active" }) });
      }
      return undefined;
    });
    await screen.findByTestId("subscription-tab");

    await userEvent.click(screen.getByTestId("subscription-reactivate"));
    await userEvent.type(screen.getByTestId("confirm-reason"), "Payment received");
    await userEvent.click(screen.getByTestId("confirm-submit"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(`/ops/api/tenants/${TENANT_ID}/subscription/reactivate`));
      expect(call).toBeTruthy();
    });
    expect(await screen.findByTestId("toast-success")).toBeTruthy();
  });

  it("does not call the API when the confirm dialog is cancelled", async () => {
    const fetchMock = renderTab(subscription());
    await screen.findByTestId("subscription-tab");
    await userEvent.click(screen.getByTestId("subscription-suspend"));
    await userEvent.click(screen.getByTestId("confirm-cancel"));
    expect(fetchMock.mock.calls.some(([url]) => (url as string).includes("/suspend"))).toBe(false);
  });
});
