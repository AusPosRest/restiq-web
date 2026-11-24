import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantListItem } from "./api";
import { Dashboard } from "./dashboard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function tenant(id: string, testMode: boolean): TenantListItem {
  return { id, name: `Tenant ${id}`, country: "IN", status: "active", plan: "standard", outletCount: 1, health: "healthy", testMode, createdAt: "2026-10-11T00:00:00.000Z" };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Dashboard recent onboardings", () => {
  it("badges a Test-mode restaurant and leaves a live one plain", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(JSON.stringify(url.includes("/tenants") ? { tenants: [tenant("t1", true), tenant("t2", false)], nextCursor: null, total: 2 } : { value: 0 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );
    render(<Dashboard />);
    await screen.findByTestId("recent-onboarding-t1");
    expect(screen.getByTestId("recent-onboarding-test-badge-t1").textContent).toBe("Test");
    expect(screen.queryByTestId("recent-onboarding-test-badge-t2")).toBeNull();
  });
});
