import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import AdminLoginPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("LoginForm", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("renders email, password and submit with test ids, no expired banner by default", () => {
    render(<LoginForm nextPath="/admin" sessionExpired={false} />);
    expect(screen.getByTestId("admin-login-email")).toBeTruthy();
    expect(screen.getByTestId("admin-login-password")).toBeTruthy();
    expect(screen.getByTestId("admin-login-submit")).toBeTruthy();
    expect(screen.queryByTestId("admin-login-expired-banner")).toBeNull();
    expect(screen.queryByTestId("admin-login-error")).toBeNull();
    expect(screen.getByText("Got an invite link? Open it to set your password.")).toBeTruthy();
  });

  it("shows the session-expired banner when redirected with ?expired=1", () => {
    render(<LoginForm nextPath="/admin" sessionExpired={true} />);
    expect(screen.getByTestId("admin-login-expired-banner").textContent).toContain("Session expired");
  });

  it("posts credentials and returns to the requested URL on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { owner: { id: "1", email: "a@b.c" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginForm nextPath="/admin/menu?category=starters" sessionExpired={false} />);

    await userEvent.type(screen.getByTestId("admin-login-email"), "owner@restiq.example");
    await userEvent.type(screen.getByTestId("admin-login-password"), "hunter2hunter2");
    await userEvent.click(screen.getByTestId("admin-login-submit"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/menu?category=starters"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/admin/auth/login");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "owner@restiq.example",
      password: "hunter2hunter2",
    });
  });

  it("shows the generic inline error on bad credentials and keeps the input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, { error: { code: "invalid_credentials", message: "Incorrect email or password" } }),
      ),
    );
    render(<LoginForm nextPath="/admin" sessionExpired={false} />);

    await userEvent.type(screen.getByTestId("admin-login-email"), "owner@restiq.example");
    await userEvent.type(screen.getByTestId("admin-login-password"), "wrong");
    await userEvent.click(screen.getByTestId("admin-login-submit"));

    const error = await screen.findByTestId("admin-login-error");
    expect(error.textContent).toBe("Incorrect email or password");
    expect((screen.getByTestId("admin-login-email") as HTMLInputElement).value).toBe("owner@restiq.example");
    expect(replace).not.toHaveBeenCalled();
    expect((screen.getByTestId("admin-login-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows a retryable failure message when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    render(<LoginForm nextPath="/admin" sessionExpired={false} />);

    await userEvent.type(screen.getByTestId("admin-login-email"), "owner@restiq.example");
    await userEvent.type(screen.getByTestId("admin-login-password"), "hunter2hunter2");
    await userEvent.click(screen.getByTestId("admin-login-submit"));

    const error = await screen.findByTestId("admin-login-error");
    expect(error.textContent).toContain("Sign-in failed");
  });

  it.each([
    [undefined, "/admin"],
    ["/admin/menu?category=starters", "/admin/menu?category=starters"],
    ["https://example.test/admin", "/admin"],
    ["//example.test/admin", "/admin"],
    ["/ops", "/admin"],
  ])("sanitizes the page's next=%s and navigates to %s", async (next, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { owner: { id: "1" } })));
    render(await AdminLoginPage({ searchParams: Promise.resolve({ next }) }));

    await userEvent.type(screen.getByTestId("admin-login-email"), "anita@bayleaf.example");
    await userEvent.type(screen.getByTestId("admin-login-password"), "BayLeaf#2026Demo");
    await userEvent.click(screen.getByTestId("admin-login-submit"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(expected));
  });

  it.each([
    [429, "locked_out", "Too many sign-in attempts. Please try again later."],
    [409, "ambiguous_owner", "Incorrect email or password"],
  ])("shows safe inline copy for %s without navigating", async (status, code, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(status, { error: { code } })));
    render(<LoginForm nextPath="/admin" sessionExpired={false} />);

    await userEvent.type(screen.getByTestId("admin-login-email"), "anita@bayleaf.example");
    await userEvent.type(screen.getByTestId("admin-login-password"), "wrong");
    await userEvent.click(screen.getByTestId("admin-login-submit"));

    expect((await screen.findByTestId("admin-login-error")).textContent).toBe(message);
    expect(replace).not.toHaveBeenCalled();
    expect((screen.getByTestId("admin-login-submit") as HTMLButtonElement).disabled).toBe(false);
  });

});
