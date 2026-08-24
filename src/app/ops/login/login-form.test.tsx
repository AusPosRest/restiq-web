import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

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
  afterEach(cleanup);

  it("renders email, password and submit with test ids, no expired banner by default", () => {
    render(<LoginForm nextPath="/ops" sessionExpired={false} />);
    expect(screen.getByTestId("ops-login-email")).toBeTruthy();
    expect(screen.getByTestId("ops-login-password")).toBeTruthy();
    expect(screen.getByTestId("ops-login-submit")).toBeTruthy();
    expect(screen.queryByTestId("ops-login-expired-banner")).toBeNull();
    expect(screen.queryByTestId("ops-login-error")).toBeNull();
    expect(screen.getByText("Internal RESTIQ staff only")).toBeTruthy();
  });

  it("shows the session-expired banner when redirected with ?expired=1", () => {
    render(<LoginForm nextPath="/ops" sessionExpired={true} />);
    expect(screen.getByTestId("ops-login-expired-banner").textContent).toContain("Session expired");
  });

  it("posts credentials and returns to the requested URL on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { operator: { id: "1", email: "a@b.c" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginForm nextPath="/ops/sync-health" sessionExpired={false} />);

    await userEvent.type(screen.getByTestId("ops-login-email"), "operator@restiq.example");
    await userEvent.type(screen.getByTestId("ops-login-password"), "hunter2hunter2");
    await userEvent.click(screen.getByTestId("ops-login-submit"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ops/sync-health"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/ops/auth/login");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "operator@restiq.example",
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
    render(<LoginForm nextPath="/ops" sessionExpired={false} />);

    await userEvent.type(screen.getByTestId("ops-login-email"), "operator@restiq.example");
    await userEvent.type(screen.getByTestId("ops-login-password"), "wrong");
    await userEvent.click(screen.getByTestId("ops-login-submit"));

    const error = await screen.findByTestId("ops-login-error");
    expect(error.textContent).toBe("Incorrect email or password");
    expect((screen.getByTestId("ops-login-email") as HTMLInputElement).value).toBe("operator@restiq.example");
    expect(replace).not.toHaveBeenCalled();
    expect((screen.getByTestId("ops-login-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows a retryable failure message when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    render(<LoginForm nextPath="/ops" sessionExpired={false} />);

    await userEvent.type(screen.getByTestId("ops-login-email"), "operator@restiq.example");
    await userEvent.type(screen.getByTestId("ops-login-password"), "hunter2hunter2");
    await userEvent.click(screen.getByTestId("ops-login-submit"));

    const error = await screen.findByTestId("ops-login-error");
    expect(error.textContent).toContain("Sign-in failed");
  });
});
