// @vitest-environment node
// Issue #214: the kiosk start route exchanges outlet + enrolled device for a
// guest session cookie, passing backend refusals through untouched.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_DISPLAY_COOKIE, GUEST_SESSION_COOKIE } from "@/lib/guest-session";
import { POST } from "./route";
import { POST as END } from "./end/route";

const API_URL = "https://api.example.test";

function jsonRequest(body: unknown): Request {
  return new Request("https://web.example.test/qr/auth/kiosk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function upstreamJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("POST /qr/auth/kiosk", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rejects a missing device before calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await POST(jsonRequest({ outletId: "o1" }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts the session upstream and sets the guest cookies with no table or PIN", async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstreamJson(201, { token: "guest-jwt", session: { sessionId: "s1", table: null } }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(jsonRequest({ outletId: "o1", deviceId: "d1" }));
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_URL}/guest/v1/kiosk/sessions`);
    expect(JSON.parse(init.body as string)).toEqual({ outletId: "o1", deviceId: "d1" });
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith(`${GUEST_SESSION_COOKIE}=guest-jwt`) && /httponly/i.test(c))).toBe(true);
    const display = cookies.find((c) => c.startsWith(`${GUEST_DISPLAY_COOKIE}=`)) ?? "";
    expect(decodeURIComponent(display)).toContain('"tableId":""');
  });

  it("passes a kiosk_disabled refusal through with the backend's message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamJson(403, { error: { code: "kiosk_disabled", message: "Kiosk ordering is not available" } })));
    const res = await POST(jsonRequest({ outletId: "o1", deviceId: "d1" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "kiosk_disabled", message: "Kiosk ordering is not available" } });
  });

  it("end clears both guest cookies", async () => {
    const res = await END();
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith(`${GUEST_SESSION_COOKIE}=;`) && /max-age=0/i.test(c))).toBe(true);
    expect(cookies.some((c) => c.startsWith(`${GUEST_DISPLAY_COOKIE}=;`) && /max-age=0/i.test(c))).toBe(true);
  });
});
