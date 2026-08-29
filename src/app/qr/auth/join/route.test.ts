// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_SESSION_COOKIE } from "@/lib/guest-session";
import { POST } from "./route";

const API_URL = "https://api.example.test";

function jsonRequest(body: unknown): Request {
  return new Request("https://web.example.test/qr/auth/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function upstreamJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("POST /qr/auth/join", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a non-4-digit pin before calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(jsonRequest({ outletId: "o1", tableId: "t1", pin: "12", name: "Priya" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing name before calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(jsonRequest({ outletId: "o1", tableId: "t1", pin: "4729", name: "" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sets an httpOnly guest_session cookie on a correct pin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(upstreamJson(200, { token: "guest-jwt", session: { outletId: "o1", tableId: "t1" } })),
    );

    const res = await POST(jsonRequest({ outletId: "o1", tableId: "t1", pin: "4729", name: "Priya" }));
    expect(res.status).toBe(200);

    const cookie = res.cookies.get(GUEST_SESSION_COOKIE);
    expect(cookie?.value).toBe("guest-jwt");
    expect(cookie?.httpOnly).toBe(true);
  });

  it("passes through a wrong-pin error untouched, without setting a cookie", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        upstreamJson(401, { error: { code: "invalid_pin", message: "That PIN didn't match - ask your table for the 4-digit code" } }),
      ),
    );

    const res = await POST(jsonRequest({ outletId: "o1", tableId: "t1", pin: "0000", name: "Priya" }));
    expect(res.status).toBe(401);
    expect(res.cookies.get(GUEST_SESSION_COOKIE)).toBeUndefined();
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_pin");
  });

  it("returns 502 when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const res = await POST(jsonRequest({ outletId: "o1", tableId: "t1", pin: "4729", name: "Priya" }));
    expect(res.status).toBe(502);
  });
});
