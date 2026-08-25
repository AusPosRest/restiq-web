// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POS_SESSION_COOKIE, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { POST } from "./route";

const API_URL = "https://api.example.test";
const TENANT_ID = "0193tttt-0000-7000-8000-000000000001";

function jsonRequest(body: unknown): Request {
  return new Request("https://web.example.test/pos/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function upstreamJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("POST /pos/auth/login", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
    process.env.POS_TENANT_ID = TENANT_ID;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a non-4-digit pin before ever calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(jsonRequest({ pin: "12" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends tenantId and pin to the real backend contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      upstreamJson(200, {
        status: "authenticated",
        token: "the-jwt",
        staff: { id: "s1", name: "Priya" },
        outlet: { id: "o1", name: "Spice Route" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await POST(jsonRequest({ pin: "1234" }));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_URL}/pos/v1/auth/login`);
    expect(JSON.parse(init.body as string)).toEqual({ tenantId: TENANT_ID, pin: "1234" });
  });

  it("sets an httpOnly pos_session cookie and strips the token from the response on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        upstreamJson(200, {
          status: "authenticated",
          token: "the-jwt",
          staff: { id: "s1", name: "Priya" },
          outlet: { id: "o1", name: "Spice Route" },
        }),
      ),
    );

    const res = await POST(jsonRequest({ pin: "1234" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("token");
    expect(body.staff).toEqual({ id: "s1", name: "Priya" });

    const cookie = res.cookies.get(POS_SESSION_COOKIE);
    expect(cookie?.value).toBe("the-jwt");
    expect(cookie?.httpOnly).toBe(true);

    const staffCookie = res.cookies.get(POS_STAFF_COOKIE);
    expect(JSON.parse(staffCookie?.value ?? "null")).toEqual({ staff: { id: "s1", name: "Priya" }, outlet: { id: "o1", name: "Spice Route" } });
    expect(staffCookie?.httpOnly).toBe(true);
  });

  it("passes through a select_outlet response with no cookies set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        upstreamJson(200, {
          status: "select_outlet",
          pendingToken: "pending-jwt",
          staff: { id: "s1", name: "Priya" },
          outlets: [{ id: "o1", name: "Spice Route" }],
        }),
      ),
    );

    const res = await POST(jsonRequest({ pin: "1234" }));
    expect(res.status).toBe(200);
    expect(res.cookies.get(POS_SESSION_COOKIE)).toBeUndefined();
    expect(res.cookies.get(POS_STAFF_COOKIE)).toBeUndefined();
    const body = (await res.json()) as { status: string; pendingToken: string };
    expect(body.status).toBe("select_outlet");
    expect(body.pendingToken).toBe("pending-jwt");
  });

  it("passes an upstream lockout error through untouched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(upstreamJson(429, { code: "locked_out", message: "Too many incorrect attempts - try again shortly" })),
    );

    const res = await POST(jsonRequest({ pin: "0000" }));
    expect(res.status).toBe(429);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("locked_out");
  });

  it("returns 502 when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const res = await POST(jsonRequest({ pin: "1234" }));
    expect(res.status).toBe(502);
  });

  it("returns 500 when POS_TENANT_ID is not configured", async () => {
    delete process.env.POS_TENANT_ID;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(jsonRequest({ pin: "1234" }));
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
