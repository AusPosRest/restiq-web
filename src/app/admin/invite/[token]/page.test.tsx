import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminInvitePage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

function answer(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));
}

async function renderPage() {
  render(await AdminInvitePage({ params: Promise.resolve({ token: "tok" }) }));
}

// PE-31: a used or invalid link says so before the owner types a password.
describe("AdminInvitePage", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.test";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("shows the password form for a valid invite", async () => {
    answer(200, { restaurantName: "Bay Leaf", email: "anita@bayleaf.example", firstName: "Anita" });
    await renderPage();
    expect(screen.getByTestId("admin-invite-heading").textContent).toBe("Set up Bay Leaf");
    expect(screen.getByTestId("admin-accept-invite-password")).toBeTruthy();
  });

  it("sends an already-accepted invite to sign in, with no password form", async () => {
    answer(409, { error: { code: "invite_already_used", message: "This invite has already been used" } });
    await renderPage();
    expect(screen.getByTestId("admin-invite-heading").textContent).toBe("You've already set up your account");
    expect(screen.getByTestId("admin-invite-sign-in").getAttribute("href")).toBe("/admin/login");
    expect(screen.queryByTestId("admin-accept-invite-password")).toBeNull();
  });

  it("says a garbage or expired link doesn't work, with no password form", async () => {
    answer(400, { error: { code: "invite_invalid", message: "This invite link is not valid" } });
    await renderPage();
    expect(screen.getByTestId("admin-invite-heading").textContent).toBe("This invite link doesn't work");
    expect(screen.queryByTestId("admin-accept-invite-password")).toBeNull();
  });

  it("falls back to the form when the API can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("down")));
    await renderPage();
    expect(screen.getByTestId("admin-accept-invite-password")).toBeTruthy();
  });
});
