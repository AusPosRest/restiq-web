import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OwnerSetupHeader } from "./owner-setup-header";

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

// PE-32: the setup pages outside the shell still show the wordmark and greet the restaurant.
describe("OwnerSetupHeader", () => {
  it("greets the restaurant by name and badges a Test-mode tenant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: "Bay Leaf Kitchens", country: "IN", testMode: true }), { status: 200 })));
    render(<OwnerSetupHeader />);
    expect((await screen.findByTestId("owner-setup-greeting")).textContent).toBe("Welcome, Bay Leaf Kitchens");
    expect(screen.getByTestId("owner-setup-test-badge")).toBeTruthy();
    expect(screen.getByTestId("owner-setup-header").textContent).toContain("RESTIQ");
  });
});
