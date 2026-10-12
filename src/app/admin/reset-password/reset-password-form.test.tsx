// Owner reset password (restiq-web#300): checks the new password before it is sent, shows a way
// forward for a used, unknown or expired link, and sends the owner to sign in on success.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "./reset-password-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

function response(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function fillAndSubmit(password: string, confirm: string) {
  await userEvent.type(screen.getByTestId("admin-reset-password"), password);
  await userEvent.type(screen.getByTestId("admin-reset-confirm"), confirm);
  await userEvent.click(screen.getByTestId("admin-reset-submit"));
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("sends the token and new password, then goes to sign-in with a notice", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ResetPasswordForm token="rst_abc" />);

    await fillAndSubmit("A-brand-new-one-2", "A-brand-new-one-2");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login?reset=1"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/admin/auth/reset-password");
    expect(JSON.parse(init.body as string)).toEqual({ token: "rst_abc", password: "A-brand-new-one-2" });
  });

  it("refuses a short password or a mismatch without calling the server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ResetPasswordForm token="rst_abc" />);

    await fillAndSubmit("short", "short");
    expect(screen.getByTestId("admin-reset-field-error").textContent).toContain("at least 10");
    await userEvent.clear(screen.getByTestId("admin-reset-password"));
    await userEvent.clear(screen.getByTestId("admin-reset-confirm"));
    await fillAndSubmit("A-brand-new-one-2", "Something-else-entirely");
    expect(screen.getByTestId("admin-reset-field-error").textContent).toContain("do not match");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a way to ask again when the link is expired, used or unknown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(400, { error: { code: "reset_expired", message: "expired" } })));
    render(<ResetPasswordForm token="rst_abc" />);
    await fillAndSubmit("A-brand-new-one-2", "A-brand-new-one-2");
    expect((await screen.findByTestId("admin-reset-link-problem")).textContent).toContain("expired");
    expect(screen.getByTestId("admin-reset-request-new").getAttribute("href")).toBe("/admin/forgot-password");
    cleanup();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(400, { error: { code: "reset_invalid", message: "no" } })));
    render(<ResetPasswordForm token="rst_abc" />);
    await fillAndSubmit("A-brand-new-one-2", "A-brand-new-one-2");
    expect((await screen.findByTestId("admin-reset-link-problem")).textContent).toContain("already been used");
  });

  it("without a token in the link, goes straight to asking for a new one", () => {
    render(<ResetPasswordForm token="" />);
    expect(screen.getByTestId("admin-reset-link-problem").textContent).toContain("needs the link from your reset email");
    expect(screen.queryByTestId("admin-reset-submit")).toBeNull();
  });

  it("keeps the form and says so when the connection fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<ResetPasswordForm token="rst_abc" />);
    await fillAndSubmit("A-brand-new-one-2", "A-brand-new-one-2");
    expect((await screen.findByTestId("admin-reset-error")).textContent).toContain("Check your connection");
    expect(screen.getByTestId("admin-reset-submit")).toBeTruthy();
  });
});
