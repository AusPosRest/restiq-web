import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentsView } from "../../api";
import { ToastProvider } from "../../toast";
import { StripeAccountCard } from "./stripe-account-card";

const VIEW: PaymentsView = {
  tenantId: "t1",
  stripeAccountId: "acct_1",
  status: "restricted",
  requirementsDue: 1,
  cardPaymentsActive: true,
  payoutsActive: false,
  detailsSubmitted: true,
  requirements: [
    { code: "external_account", title: "Bank account", problem: "The account number is invalid.", urgency: "past_due", blocks: ["payouts"], waitingOn: "owner" },
  ],
  allowedMethods: ["card"],
  feePercentBps: 0,
  feeFixedMinor: "0",
  currency: "AUD",
};

function renderCard(view: PaymentsView, reload = vi.fn()) {
  render(
    <ToastProvider>
      <StripeAccountCard tenantId="t1" view={view} reload={reload} link={null} setLink={vi.fn()} />
    </ToastProvider>,
  );
  return reload;
}

describe("StripeAccountCard", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("shows the steps and what Stripe still needs", () => {
    renderCard(VIEW);
    expect(screen.getByTestId("payments-step-card_payments").dataset.state).toBe("done");
    expect(screen.getByTestId("payments-step-payouts").dataset.state).toBe("current");
    const row = screen.getByTestId("payments-requirement-external_account");
    expect(row.textContent).toContain("Overdue");
    expect(row.textContent).toContain("The account number is invalid.");
    expect(row.textContent).toContain("Blocks payouts");
    expect(row.textContent).toContain("Waiting on: Owner");
    expect(screen.getByTestId("payments-continue").textContent).toContain("Continue on Stripe");
    expect(screen.queryByTestId("payments-all-set")).toBeNull();
  });

  it("says All set and hides the buttons when active with nothing due", () => {
    renderCard({ ...VIEW, status: "active", requirementsDue: 0, payoutsActive: true, requirements: [] });
    expect(screen.getByTestId("payments-all-set")).toBeTruthy();
    expect(screen.queryByTestId("payments-requirements")).toBeNull();
    expect(screen.queryByTestId("payments-continue")).toBeNull();
  });

  it("labels the button Set up Stripe account before an account exists", () => {
    renderCard({ ...VIEW, status: "not_connected", stripeAccountId: null, detailsSubmitted: false, cardPaymentsActive: false, requirements: [] });
    expect(screen.getByTestId("payments-continue").textContent).toContain("Set up Stripe account");
  });

  it("Continue on Stripe opens the onboarding link in a new tab", async () => {
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() };
    vi.stubGlobal("open", vi.fn(() => tab));
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ url: "https://connect.stripe.test/a", expiresAt: "2026-11-13T00:00:00.000Z", payments: VIEW }), { status: 200, headers: { "content-type": "application/json" } })),
      ),
    );
    const reload = renderCard(VIEW);
    await userEvent.click(screen.getByTestId("payments-continue"));
    await waitFor(() => expect(tab.location.href).toBe("https://connect.stripe.test/a"));
    expect(reload).toHaveBeenCalled();
  });
});
