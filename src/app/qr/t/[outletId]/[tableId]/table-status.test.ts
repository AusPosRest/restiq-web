// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTableStatus } from "./table-status";

const API_URL = "https://api.example.test";

function upstreamJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetchTableStatus", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the outlet+table status from the backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      upstreamJson(200, {
        outlet: { id: "o1", name: "Spice Route" },
        table: { id: "t1", label: "12" },
        qrOrderingEnabled: true,
        sessionOpen: false,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTableStatus("o1", "t1");
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/guest/v1/tables/o1/t1`, expect.anything());
    expect(result).toEqual({
      kind: "ok",
      status: { outlet: { id: "o1", name: "Spice Route" }, table: { id: "t1", label: "12" }, qrOrderingEnabled: true, sessionOpen: false },
    });
  });

  it("reports not_found on a 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamJson(404, { error: { code: "not_found" } })));
    expect(await fetchTableStatus("o1", "missing-table")).toEqual({ kind: "not_found" });
  });

  it("reports unreachable when the fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    expect(await fetchTableStatus("o1", "t1")).toEqual({ kind: "unreachable" });
  });

  it("reports unreachable when NEXT_PUBLIC_API_URL is not configured", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchTableStatus("o1", "t1")).toEqual({ kind: "unreachable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
