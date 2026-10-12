// Owner forgot-password (restiq-web#300): the page says the same thing whether or not the email is
// registered; the only differences are a malformed email and rate limiting.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "./forgot-password-form";

function response(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function submit(email: string) {
  await userEvent.type(screen.getByTestId("admin-forgot-email"), email);
  await userEvent.click(screen.getByTestId("admin-forgot-submit"));
}

describe("ForgotPasswordForm", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(cleanup);

  it("posts the email and shows the same confirmation whatever the email is", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(202, { accepted: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ForgotPasswordForm />);

    await submit("  anita@bayleaf.example ");

    expect((await screen.findByTestId("admin-forgot-sent")).textContent).toContain("If that email belongs to an owner account");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/admin/auth/forgot-password");
    expect(JSON.parse(init.body as string)).toEqual({ email: "anita@bayleaf.example" });
    expect(screen.getByTestId("admin-forgot-back").getAttribute("href")).toBe("/admin/login");
  });

  it("says when requests are being limited, and keeps the form so the owner can try later", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(429, { error: { code: "locked_out", message: "slow down" } })));
    render(<ForgotPasswordForm />);
    await submit("anita@bayleaf.example");
    expect((await screen.findByTestId("admin-forgot-error")).textContent).toContain("Too many requests");
    expect(screen.queryByTestId("admin-forgot-sent")).toBeNull();
  });

  it("explains a rejected email and a failed connection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(400)));
    render(<ForgotPasswordForm />);
    await submit("not-an-email");
    expect((await screen.findByTestId("admin-forgot-error")).textContent).toContain("valid email");
    cleanup();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<ForgotPasswordForm />);
    await submit("anita@bayleaf.example");
    expect((await screen.findByTestId("admin-forgot-error")).textContent).toContain("Check your connection");
  });
});
