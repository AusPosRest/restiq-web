// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_SESSION_COOKIE } from "@/lib/guest-session";
import { POST } from "./route";

const API_URL = "https://api.example.test";

function jsonRequest(body: unknown): Request {
  return new Request("https://web.example.test/qr/auth/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function upstreamJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("POST /qr/auth/start", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a missing name before calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(jsonRequest({ outletId: "o1", tableId: "t1", name: "", phone: "9876543210" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-10-digit phone before calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(jsonRequest({ outletId: "o1", tableId: "t1", name: "Rahul", phone: "123" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends outletId, tableId, name, phone to the backend", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(upstreamJson(201, { token: "guest-jwt", pin: "4729", session: { outletId: "o1", tableId: "t1" } }));
    vi.stubGlobal("fetch", fetchMock);

    await POST(jsonRequest({ outletId: "o1", tableId: "t1", name: "Rahul", phone: "9876543210" }));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_URL}/guest/v1/sessions`);
    expect(JSON.parse(init.body as string)).toEqual({ outletId: "o1", tableId: "t1", name: "Rahul", phone: "9876543210" });
  });

  it("sets an httpOnly guest_session cookie and returns the shareable pin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(upstreamJson(201, { token: "guest-jwt", pin: "4729", session: { outletId: "o1", tableId: "t1" } })),
    );

    const res = await POST(jsonRequest({ outletId: "o1", tableId: "t1", name: "Rahul", phone: "9876543210" }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { pin: string };
    expect(body.pin).toBe("4729");
    expect(body).not.toHaveProperty("token");

    const cookie = res.cookies.get(GUEST_SESSION_COOKIE);
    expect(cookie?.value).toBe("guest-jwt");
    expect(cookie?.httpOnly).toBe(true);
  });

  it("passes through an upstream capability-disabled error untouched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(upstreamJson(403, { error: { code: "capability_disabled", message: "Ordering is off" } })),
    );
    const res = await POST(jsonRequest({ outletId: "o1", tableId: "t1", name: "Rahul", phone: "9876543210" }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("capability_disabled");
  });

  it("returns 502 when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const res = await POST(jsonRequest({ outletId: "o1", tableId: "t1", name: "Rahul", phone: "9876543210" }));
    expect(res.status).toBe(502);
  });

  it("returns 500 when NEXT_PUBLIC_API_URL is not configured", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(jsonRequest({ outletId: "o1", tableId: "t1", name: "Rahul", phone: "9876543210" }));
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
