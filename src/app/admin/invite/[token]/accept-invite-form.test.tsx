import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AcceptInviteForm } from "./accept-invite-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function fillAndSubmit(password: string, confirm: string) {
  await userEvent.type(screen.getByTestId("admin-accept-invite-password"), password);
  await userEvent.type(screen.getByTestId("admin-accept-invite-confirm-password"), confirm);
  await userEvent.click(screen.getByTestId("admin-accept-invite-submit"));
}

describe("AcceptInviteForm", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.unstubAllGlobals();
  });
  afterEach(cleanup);

  it("renders the password fields and submit with test ids", () => {
    render(<AcceptInviteForm token="tok-1" />);
    expect(screen.getByTestId("admin-accept-invite-password")).toBeTruthy();
    expect(screen.getByTestId("admin-accept-invite-confirm-password")).toBeTruthy();
    expect(screen.getByTestId("admin-accept-invite-submit")).toBeTruthy();
  });

  it("rejects a password shorter than 10 characters without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AcceptInviteForm token="tok-1" />);

    await fillAndSubmit("short1", "short1");

    expect(await screen.findByTestId("admin-accept-invite-field-error")).toHaveProperty(
      "textContent",
      "Password must be at least 10 characters.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AcceptInviteForm token="tok-1" />);

    await fillAndSubmit("longenough1", "longenough2");

    expect(await screen.findByTestId("admin-accept-invite-field-error")).toHaveProperty(
      "textContent",
      "Passwords do not match.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits token and password, then redirects into onboarding on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { token: "jwt", owner: { email: "a@b.c" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AcceptInviteForm token="invite-tok-42" />);

    await fillAndSubmit("longenough1", "longenough1");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/onboarding"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/admin/auth/accept-invite");
    expect(JSON.parse(init.body as string)).toEqual({ token: "invite-tok-42", password: "longenough1" });
  });

  it("shows a no-dead-end message with a support link when the token is expired", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(410, { error: { code: "invite_expired", message: "This invite has expired" } }),
      ),
    );
    render(<AcceptInviteForm token="tok-1" />);

    await fillAndSubmit("longenough1", "longenough1");

    expect(await screen.findByTestId("admin-accept-invite-invalid")).toBeTruthy();
    expect(screen.getByTestId("admin-accept-invite-support-link")).toBeTruthy();
    expect(screen.queryByTestId("admin-accept-invite-password")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows the same no-dead-end message when the token was already used", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(404, { error: { code: "invite_not_found", message: "Unknown invite" } })),
    );
    render(<AcceptInviteForm token="tok-1" />);

    await fillAndSubmit("longenough1", "longenough1");

    expect(await screen.findByTestId("admin-accept-invite-invalid")).toBeTruthy();
  });

  it("shows a retryable failure message and keeps the form when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    render(<AcceptInviteForm token="tok-1" />);

    await fillAndSubmit("longenough1", "longenough1");

    const error = await screen.findByTestId("admin-accept-invite-error");
    expect(error.textContent).toContain("Something went wrong");
    expect(screen.getByTestId("admin-accept-invite-password")).toBeTruthy();
  });

  it("shows a validation error inline (not the dead-end state) for a non-invite 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: { code: "weak_password", message: "Too weak" } })),
    );
    render(<AcceptInviteForm token="tok-1" />);

    await fillAndSubmit("longenough1", "longenough1");

    expect(await screen.findByTestId("admin-accept-invite-error")).toBeTruthy();
    expect(screen.queryByTestId("admin-accept-invite-invalid")).toBeNull();
    expect(screen.getByTestId("admin-accept-invite-password")).toBeTruthy();
  });
});
