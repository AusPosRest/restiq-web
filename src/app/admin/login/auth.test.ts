import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS, decideAdminRoute } from "@/lib/admin-session";
import { POST as login } from "../auth/login/route";
import { POST as logout } from "../auth/logout/route";

const owner = { id: "owner-1", tenantId: "tenant-1", email: "anita@bayleaf.example", firstName: "Anita", lastName: "Rao" };
const credentials = { email: owner.email, password: "BayLeaf#2026Demo" };

function loginRequest(body: unknown = credentials) {
  return new Request("https://web.example.test/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function stubResponse(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Owner auth", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("allows the login endpoint through the guard without a valid session", () => {
    expect(decideAdminRoute("/admin/auth/login", "", undefined)).toEqual({ allow: true });
    expect(decideAdminRoute("/admin/auth/login", "", "expired-token")).toEqual({ allow: true });
    expect(decideAdminRoute("/admin/menu", "", undefined).allow).toBe(false);
  });

  it("exchanges credentials and returns only the owner while setting the secure admin cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = stubResponse(200, { token: "admin-jwt", owner });
    const response = await login(loginRequest());

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/admin/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
      cache: "no-store",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ owner });
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)).toMatchObject({
      value: "admin-jwt", httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    expect(response.cookies.get("ops_session")).toBeUndefined();
  });

  it.each([
    [401, { error: { code: "invalid_credentials", message: "Incorrect email or password" } }],
    [429, { error: { code: "locked_out", message: "Try again later" } }],
    [409, { error: { code: "ambiguous_owner" } }],
  ])("preserves the backend's %s response without setting a session", async (status, body) => {
    stubResponse(status, body);
    const response = await login(loginRequest());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects missing credentials before calling the backend", async () => {
    const fetchMock = stubResponse(200, {});
    expect((await login(loginRequest({ email: owner.email }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an unreachable backend without setting a session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const response = await login(loginRequest());
    expect(response.status).toBe(502);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("clears the admin cookie and redirects a logout POST to the login page", async () => {
    const response = await logout(new NextRequest("https://web.example.test/admin/auth/logout", { method: "POST" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://web.example.test/admin/login");
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)).toMatchObject({ value: "", httpOnly: true, path: "/", maxAge: 0 });
    expect(response.cookies.get("ops_session")).toBeUndefined();
  });
});
