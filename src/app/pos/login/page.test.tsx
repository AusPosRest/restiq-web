import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PosLoginPage from "./page";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/tenant-by-host", () => ({ fetchTenantByHost: async () => null, hostOf: () => "" }));
vi.mock("./pin-pad", () => ({ PinPad: () => null }));
vi.mock("./live-clock", () => ({ LiveClock: () => null }));

async function renderPage(searchParams: { next?: string; expired?: string; removed?: string }) {
  render(await PosLoginPage({ searchParams: Promise.resolve(searchParams) }));
}

afterEach(cleanup);

// restiq-web#389: a device the owner removed is told so, with the way to set it up again.
describe("PosLoginPage notices", () => {
  it("shows the removed notice with a link to set the device up again", async () => {
    await renderPage({ removed: "1" });
    const banner = screen.getByTestId("pos-login-removed-banner");
    expect(banner.getAttribute("role")).toBe("alert");
    expect(banner.textContent).toContain("This device was removed by the owner.");
    expect(screen.getByTestId("pos-login-removed-setup").getAttribute("href")).toBe("/device");
    expect(screen.queryByTestId("pos-login-expired-banner")).toBeNull();
  });

  it("prefers the removed notice when both are present", async () => {
    await renderPage({ removed: "1", expired: "1" });
    expect(screen.getByTestId("pos-login-removed-banner")).toBeTruthy();
    expect(screen.queryByTestId("pos-login-expired-banner")).toBeNull();
  });

  it("shows the expired notice alone for expired=1", async () => {
    await renderPage({ expired: "1" });
    expect(screen.getByTestId("pos-login-expired-banner")).toBeTruthy();
    expect(screen.queryByTestId("pos-login-removed-banner")).toBeNull();
  });
});
