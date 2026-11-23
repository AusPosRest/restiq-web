// @vitest-environment node
// Issue #389: the kiosk heartbeat route forwards outlet + device to the
// public backend heartbeat and answers with the backend's own status.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const API_URL = "https://api.example.test";

function jsonRequest(body: unknown): Request {
  return new Request("https://web.example.test/qr/auth/kiosk/heartbeat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /qr/auth/kiosk/heartbeat", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rejects missing ids before calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await POST(jsonRequest({ outletId: "o1" }))).status).toBe(400);
    expect((await POST(jsonRequest({ outletId: "", deviceId: "d1" }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the ids and answers 204 with no body when the backend does", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(jsonRequest({ outletId: "o1", deviceId: "d1" }));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_URL}/guest/v1/kiosk/heartbeat`);
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(JSON.parse(init.body as string)).toEqual({ outletId: "o1", deviceId: "d1" });
  });

  it("passes a not_found refusal through untouched", async () => {
    const body = { error: { code: "not_found", message: "No such outlet or kiosk" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 404 })));
    const res = await POST(jsonRequest({ outletId: "o1", deviceId: "d1" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(body);
  });

  it("answers 502 when the backend cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const res = await POST(jsonRequest({ outletId: "o1", deviceId: "d1" }));
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("upstream_unreachable");
  });

  it("answers 500 without an API URL", async () => {
    vi.stubEnv("RESTIQ_API_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const res = await POST(jsonRequest({ outletId: "o1", deviceId: "d1" }));
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("misconfigured");
  });
});
