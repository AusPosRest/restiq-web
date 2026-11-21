// restiq-web#449 service mode: the bar every signed-in owner-console page shows while an operator is inside.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminTenantProvider, minutesLeft, ServiceModeBar, SignOutButton } from "./service-mode";

function renderWithTenant(tenant: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(tenant), { status: 200 })));
  return render(
    <AdminTenantProvider>
      <ServiceModeBar />
      <SignOutButton />
    </AdminTenantProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("ServiceModeBar", () => {
  it("names the restaurant, the operator and the minutes left, with an exit form", async () => {
    const expiresAt = new Date(Date.now() + 42 * 60_000 - 1000).toISOString();
    renderWithTenant({ name: "Bay Leaf Kitchens", testMode: false, service: { operatorEmail: "op@restiq.test", expiresAt } });
    const bar = await screen.findByTestId("service-mode-banner");
    expect(bar.getAttribute("role")).toBe("status");
    expect(bar.textContent).toContain("You are inside Bay Leaf Kitchens as op@restiq.test.");
    expect(screen.getByTestId("service-mode-remaining").textContent).toBe("Ends in 42 min");
    const exit = screen.getByTestId("service-mode-exit");
    expect(exit.closest("form")?.getAttribute("action")).toBe("/admin/auth/logout");
    expect(screen.getByTestId("admin-sign-out").textContent).toBe("Exit service mode");
  });

  it("renders nothing for the owner, or an older API without the field", async () => {
    renderWithTenant({ name: "Bay Leaf Kitchens", testMode: false, service: null });
    expect((await screen.findByTestId("admin-sign-out")).textContent).toBe("Sign out");
    // Let the tenant load land, then check the bar stayed away.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId("service-mode-banner")).toBeNull();
    cleanup();

    renderWithTenant({ name: "Bay Leaf Kitchens", testMode: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId("service-mode-banner")).toBeNull();
  });
});

describe("minutesLeft", () => {
  it("rounds to the nearest minute and never goes below zero", () => {
    const now = Date.parse("2026-11-21T10:00:00.000Z");
    expect(minutesLeft("2026-11-21T10:59:30.000Z", now)).toBe(60);
    // restiq-web#451: a browser clock a few seconds behind the server must not turn a fresh 60 minutes into 61.
    expect(minutesLeft("2026-11-21T11:00:20.000Z", now)).toBe(60);
    expect(minutesLeft("2026-11-21T09:00:00.000Z", now)).toBe(0);
  });
});
