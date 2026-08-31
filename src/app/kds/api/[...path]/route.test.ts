// @vitest-environment node
// NextRequest's fetch plumbing is undici's, not jsdom's - mirrors
// /pos/api/[...path]/route.test.ts.
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

describe("kds API pass-through", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a request with no pos session", async () => {
    const request = new NextRequest("https://web.example.test/kds/api/outlets/o1/stations");
    const res = await GET(request, { params: Promise.resolve({ path: ["outlets", "o1", "stations"] }) });
    expect(res.status).toBe(401);
  });

  it("forwards a GET to the kitchen/v1 upstream with the pos session as a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = requestWithCookie("https://web.example.test/kds/api/outlets/o1/stations");
    const res = await GET(request, { params: Promise.resolve({ path: ["outlets", "o1", "stations"] }) });

    expect(res.status).toBe(200);
    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(upstreamUrl).toBe(`${API_URL}/kitchen/v1/outlets/o1/stations`);
    expect((upstreamInit.headers as Record<string, string>).authorization).toBe("Bearer a-jwt");
  });

  it("forwards the queue read for the synthetic unrouted station segment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = requestWithCookie("https://web.example.test/kds/api/outlets/o1/stations/unrouted/queue");
    await GET(request, { params: Promise.resolve({ path: ["outlets", "o1", "stations", "unrouted", "queue"] }) });

    const [upstreamUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(upstreamUrl).toBe(`${API_URL}/kitchen/v1/outlets/o1/stations/unrouted/queue`);
  });

  it("forwards a bump POST with no body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "t1", status: "bumped" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = requestWithCookie("https://web.example.test/kds/api/tickets/t1/bump", { method: "POST" });
    const res = await POST(request, { params: Promise.resolve({ path: ["tickets", "t1", "bump"] }) });

    expect(res.status).toBe(200);
    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(upstreamUrl).toBe(`${API_URL}/kitchen/v1/tickets/t1/bump`);
    expect(upstreamInit.method).toBe("POST");
  });

  it("rejects a path segment outside the allowed charset", async () => {
    const request = requestWithCookie("https://web.example.test/kds/api/..%2Fadmin");
    const res = await GET(request, { params: Promise.resolve({ path: ["../admin"] }) });
    expect(res.status).toBe(404);
  });

  it("passes an upstream 502 through when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const request = requestWithCookie("https://web.example.test/kds/api/tickets/t1/bump", { method: "POST" });
    const res = await POST(request, { params: Promise.resolve({ path: ["tickets", "t1", "bump"] }) });
    expect(res.status).toBe(502);
  });
});
