// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POS_SESSION_COOKIE, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { POST } from "./route";

const API_URL = "https://api.example.test";

function jsonRequest(body: unknown): Request {
  return new Request("https://web.example.test/pos/auth/select-outlet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function upstreamJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("POST /pos/auth/select-outlet", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a request missing pendingToken or outletId before calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await POST(jsonRequest({ outletId: "o1" }))).status).toBe(400);
    expect((await POST(jsonRequest({ pendingToken: "p1" }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards pendingToken and outletId to the real backend contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      upstreamJson(200, {
        status: "authenticated",
        token: "the-jwt",
        staff: { id: "s1", name: "Priya" },
        outlet: { id: "o2", name: "Spice Route - Koramangala" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await POST(jsonRequest({ pendingToken: "p1", outletId: "o2" }));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_URL}/pos/v1/auth/select-outlet`);
    expect(JSON.parse(init.body as string)).toEqual({ pendingToken: "p1", outletId: "o2" });
  });

  it("sets the session cookies and strips the token on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        upstreamJson(200, {
          status: "authenticated",
          token: "the-jwt",
          staff: { id: "s1", name: "Priya" },
          outlet: { id: "o2", name: "Spice Route - Koramangala" },
        }),
      ),
    );

    const res = await POST(jsonRequest({ pendingToken: "p1", outletId: "o2" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("token");
    expect(res.cookies.get(POS_SESSION_COOKIE)?.value).toBe("the-jwt");
    expect(res.cookies.get(POS_STAFF_COOKIE)).toBeTruthy();
  });

  it("passes an expired-pendingToken error through untouched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(upstreamJson(401, { code: "unauthorized", message: "This selection has expired - log in again" })),
    );

    const res = await POST(jsonRequest({ pendingToken: "expired", outletId: "o2" }));
    expect(res.status).toBe(401);
  });

  it("returns 502 when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const res = await POST(jsonRequest({ pendingToken: "p1", outletId: "o2" }));
    expect(res.status).toBe(502);
  });
});
