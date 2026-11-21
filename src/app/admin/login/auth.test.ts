import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS, decideAdminRoute } from "@/lib/admin-session";
import { POST as login } from "../auth/login/route";
import { POST as logout } from "../auth/logout/route";
import { POST as serviceHandoff } from "../auth/service/route";

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

  it("clears the admin cookie and redirects a logout POST to the login page on the same host", async () => {
    const response = await logout(new NextRequest("https://web.example.test/admin/auth/logout", { method: "POST" }));
    expect(response.status).toBe(303);
    // restiq-web#342 (SE-10): relative, so the browser stays on the restaurant's own address, never the internal one.
    expect(response.headers.get("location")).toBe("/admin/login");
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)).toMatchObject({ value: "", httpOnly: true, path: "/", maxAge: 0 });
    expect(response.cookies.get("ops_session")).toBeUndefined();
  });

  it("ends the owner session at the API on logout (restiq-web#342, SE-9)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await logout(new NextRequest("https://web.example.test/admin/auth/logout", { method: "POST", headers: { cookie: `${ADMIN_SESSION_COOKIE}=tok-1` } }));
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/admin/v1/auth/logout", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ authorization: "Bearer tok-1" }) }));
    expect(response.status).toBe(303);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.value).toBe("");
  });

  it("still signs the browser out when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const response = await logout(new NextRequest("https://web.example.test/admin/auth/logout", { method: "POST", headers: { cookie: `${ADMIN_SESSION_COOKIE}=tok-1` } }));
    expect(response.status).toBe(303);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.value).toBe("");
  });

  it("ends a service-mode session without calling the API logout (restiq-web#449)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const svc = `h.${Buffer.from(JSON.stringify({ sub: "op-1", svc: true })).toString("base64url")}.s`;
    const response = await logout(new NextRequest("https://web.example.test/admin/auth/logout", { method: "POST", headers: { cookie: `${ADMIN_SESSION_COOKIE}=${svc}` } }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/admin/login?service=ended");
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)).toMatchObject({ value: "", maxAge: 0 });
  });
});

describe("Service-mode handoff (restiq-web#449)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function handoffRequest(code?: string) {
    const body = new URLSearchParams();
    if (code !== undefined) body.set("code", code);
    return new Request("https://bayleaf.example.test/admin/auth/service", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  }

  it("redeems the code in a JSON body, sets the capped admin cookie and redirects relatively", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = stubResponse(200, { token: "svc-jwt", tenant: { id: "t-1", name: "Bay Leaf" }, operatorEmail: "op@restiq.test", expiresInSeconds: 7200 });
    const response = await serviceHandoff(handoffRequest("hc_123"));

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/admin/v1/auth/service-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "hc_123" }),
      cache: "no-store",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/admin");
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)).toMatchObject({
      value: "svc-jwt", httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 3600,
    });
  });

  it("keeps a shorter expiry from the API", async () => {
    stubResponse(200, { token: "svc-jwt", expiresInSeconds: 900 });
    const response = await serviceHandoff(handoffRequest("hc_123"));
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.maxAge).toBe(900);
  });

  it.each([["missing", undefined], ["empty", ""], ["oversized", "x".repeat(2049)]])("rejects a %s code before calling the API", async (_label, code) => {
    const fetchMock = stubResponse(200, { token: "svc-jwt", expiresInSeconds: 3600 });
    const response = await serviceHandoff(handoffRequest(code));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/admin/login?service=expired");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    [401, { error: { code: "handoff_invalid" } }],
    [403, { error: { code: "tenant_mismatch" } }],
  ])("sends a refused code (%s) to the expired notice without a session", async (status, body) => {
    stubResponse(status, body);
    const response = await serviceHandoff(handoffRequest("hc_123"));
    expect(response.headers.get("location")).toBe("/admin/login?service=expired");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sends an unreachable API to the expired notice without a session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const response = await serviceHandoff(handoffRequest("hc_123"));
    expect(response.headers.get("location")).toBe("/admin/login?service=expired");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
