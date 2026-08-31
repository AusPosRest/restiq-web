import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionsIndex } from "./subscriptions-index";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("SubscriptionsIndex", () => {
  beforeEach(() => {
    push.mockReset();
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("lists tenants and jumps to a tenant's Subscription tab on row click", async () => {
    const tenant = { id: "0192dddd-0000-7000-8000-000000000004", name: "Spice Route", country: "IN", status: "active", plan: "standard", outletCount: 1, health: "unknown", createdAt: "2026-08-01T00:00:00.000Z" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ tenants: [tenant], nextCursor: null, total: 1 })),
    );
    render(<SubscriptionsIndex />);

    const row = await screen.findByTestId(`subscriptions-index-row-${tenant.id}`);
    expect(row.textContent).toContain("Spice Route");
    await userEvent.click(row);
    expect(push).toHaveBeenCalledWith(`/ops/tenants/${tenant.id}?tab=subscription`);
  });

  it("shows the true-empty state when there are no tenants", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ tenants: [], nextCursor: null, total: 0 })));
    render(<SubscriptionsIndex />);
    expect(await screen.findByTestId("subscriptions-index-empty")).toBeTruthy();
  });
});
