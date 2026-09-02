// @vitest-environment node
// NextRequest's fetch plumbing is undici's, not jsdom's - the node
// environment matches what this route handler actually runs under (mirrors
// /pos/api/[...path]/route.test.ts).
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const API_URL = "https://api.example.test";

describe("device API pass-through", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards a POST to the device/v1 upstream with no auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ device: { id: "d1" } }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("https://web.example.test/device/api/enroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "ABC-123", hardwareKeyFingerprint: "web-1" }),
    });
    const res = await POST(request, { params: Promise.resolve({ path: ["enroll"] }) });

    expect(res.status).toBe(201);
    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(upstreamUrl).toBe(`${API_URL}/device/v1/enroll`);
    expect((upstreamInit.headers as Record<string, string>).authorization).toBeUndefined();
    expect(upstreamInit.body).toBe(JSON.stringify({ code: "ABC-123", hardwareKeyFingerprint: "web-1" }));
  });

  it("passes the backend's error body and status straight through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "code_expired", message: "This enrolment code has expired" }), { status: 400 })),
    );
    const request = new NextRequest("https://web.example.test/device/api/enroll", { method: "POST" });
    const res = await POST(request, { params: Promise.resolve({ path: ["enroll"] }) });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "code_expired", message: "This enrolment code has expired" });
  });

  it("rejects a path segment outside the allowed charset", async () => {
    const request = new NextRequest("https://web.example.test/device/api/..%2Fadmin", { method: "POST" });
    const res = await POST(request, { params: Promise.resolve({ path: ["../admin"] }) });
    expect(res.status).toBe(404);
  });

  it("passes an upstream 502 through when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const request = new NextRequest("https://web.example.test/device/api/enroll", { method: "POST" });
    const res = await POST(request, { params: Promise.resolve({ path: ["enroll"] }) });
    expect(res.status).toBe(502);
  });

  it("500s when NEXT_PUBLIC_API_URL is not set", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const request = new NextRequest("https://web.example.test/device/api/enroll", { method: "POST" });
    const res = await POST(request, { params: Promise.resolve({ path: ["enroll"] }) });
    expect(res.status).toBe(500);
  });
});
