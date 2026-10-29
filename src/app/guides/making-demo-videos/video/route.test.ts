import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, parseRange } from "./route";

const BYTES = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));

function get(range?: string) {
  return GET(new Request("https://app.dailypos.shop/guides/making-demo-videos/video", range ? { headers: { range } } : {}));
}

describe("parseRange", () => {
  it("handles open, closed and suffix ranges", () => {
    expect(parseRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=95-500", 100)).toEqual({ start: 95, end: 99 });
  });
  it("rejects malformed or unsatisfiable ranges", () => {
    expect(parseRange("bytes=-", 100)).toBeNull();
    expect(parseRange("bytes=200-300", 100)).toBeNull();
    expect(parseRange("bytes=9-3", 100)).toBeNull();
    expect(parseRange("bytes=0-1,5-6", 100)).toBeNull();
    expect(parseRange("items=0-1", 100)).toBeNull();
  });
});

describe("GET guide video", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns 206 with Content-Range for a range request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(BYTES)));
    const res = await get("bytes=10-19");
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 10-19/100");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it("returns the whole file without a range, and 416 for an unsatisfiable one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(BYTES)));
    const full = await get();
    expect(full.status).toBe(200);
    expect(full.headers.get("content-length")).toBe("100");
    const bad = await get("bytes=500-");
    expect(bad.status).toBe(416);
    expect(bad.headers.get("content-range")).toBe("bytes */100");
  });

  it("returns 502 when the static file can't be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    expect((await get()).status).toBe(502);
  });
});
