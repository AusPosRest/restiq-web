import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TenantTestBadge } from "./tenant-test-badge";

function respond(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe("TenantTestBadge (#213)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("shows TEST when the tenant is in Test mode", async () => {
    respond(200, { name: "Demo Diner", country: "IN", testMode: true });
    render(<TenantTestBadge endpoint="/pos/api/tenant" testId="badge" />);
    expect((await screen.findByTestId("badge")).textContent).toBe("Test");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/pos/api/tenant");
  });

  it("shows nothing for a Live tenant or a failed lookup", async () => {
    respond(200, { name: "Real Diner", country: "IN", testMode: false });
    render(<TenantTestBadge endpoint="/admin/api/tenant" testId="badge" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByTestId("badge")).toBeNull();
    cleanup();

    respond(401, { error: { code: "unauthorized" } });
    render(<TenantTestBadge endpoint="/admin/api/tenant" testId="badge" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByTestId("badge")).toBeNull();
  });
});
