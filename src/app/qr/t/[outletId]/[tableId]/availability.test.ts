// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAvailability } from "./availability";

const API_URL = "https://api.example.test";

function upstreamJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("checkAvailability", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the outlet's availability from the backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstreamJson(200, { available: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkAvailability("o1");
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/guest/v1/outlets/o1/availability`, expect.anything());
    expect(result).toEqual({ kind: "available" });
  });

  it("reports unavailable with the reason when qr_ordering is disabled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamJson(200, { available: false, reason: "qr_ordering_disabled" })));
    expect(await checkAvailability("o1")).toEqual({ kind: "unavailable", reason: "qr_ordering_disabled" });
  });

  it("reports unavailable with a not_found reason for a missing outlet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamJson(200, { available: false, reason: "not_found" })));
    expect(await checkAvailability("missing")).toEqual({ kind: "unavailable", reason: "not_found" });
  });

  it("reports unreachable when the fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    expect(await checkAvailability("o1")).toEqual({ kind: "unreachable" });
  });

  it("reports unreachable on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamJson(500, { error: { code: "error" } })));
    expect(await checkAvailability("o1")).toEqual({ kind: "unreachable" });
  });

  it("reports unreachable when NEXT_PUBLIC_API_URL is not configured", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkAvailability("o1")).toEqual({ kind: "unreachable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
