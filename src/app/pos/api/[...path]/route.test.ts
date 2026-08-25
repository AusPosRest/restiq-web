// @vitest-environment node
// NextRequest's fetch plumbing is undici's, not jsdom's - the node
// environment matches what this route handler actually runs under (mirrors
// /admin/api/[...path]/route.test.ts).
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POS_SESSION_COOKIE } from "@/lib/pos-session";
import { GET, POST } from "./route";

const API_URL = "https://api.example.test";

function requestWithCookie(url: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  const request = new NextRequest(url, init);
  request.cookies.set(POS_SESSION_COOKIE, "a-jwt");
  return request;
}

describe("pos API pass-through", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a request with no pos session", async () => {
    const request = new NextRequest("https://web.example.test/pos/api/table-map");
    const res = await GET(request, { params: Promise.resolve({ path: ["table-map"] }) });
    expect(res.status).toBe(401);
  });

  it("forwards a GET to the pos/v1 upstream with the session as a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ outletId: "o1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = requestWithCookie("https://web.example.test/pos/api/table-map");
    const res = await GET(request, { params: Promise.resolve({ path: ["table-map"] }) });

    expect(res.status).toBe(200);
    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(upstreamUrl).toBe(`${API_URL}/pos/v1/table-map`);
    expect((upstreamInit.headers as Record<string, string>).authorization).toBe("Bearer a-jwt");
  });

  it("forwards a POST body as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = requestWithCookie("https://web.example.test/pos/api/orders/o1/transfer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Covering the section" }),
    });

    await POST(request, { params: Promise.resolve({ path: ["orders", "o1", "transfer"] }) });

    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(upstreamUrl).toBe(`${API_URL}/pos/v1/orders/o1/transfer`);
    expect((upstreamInit.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(upstreamInit.body).toBe(JSON.stringify({ reason: "Covering the section" }));
  });

  it("rejects a path segment outside the allowed charset", async () => {
    const request = requestWithCookie("https://web.example.test/pos/api/..%2Fadmin");
    const res = await GET(request, { params: Promise.resolve({ path: ["../admin"] }) });
    expect(res.status).toBe(404);
  });
});
