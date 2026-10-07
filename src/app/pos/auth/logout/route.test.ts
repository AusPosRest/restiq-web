import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const fetchMock = vi.fn();

describe("POST /pos/auth/logout (#290)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api.test";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const request = (cookie?: string) => new NextRequest("http://web.test/pos/auth/logout", { method: "POST", headers: cookie ? { cookie } : {} });

  it("ends the session at the API, then clears both cookies", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await POST(request("pos_session=tok-123"));
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/pos/v1/auth/logout", expect.objectContaining({ method: "POST", headers: { authorization: "Bearer tok-123" } }));
    expect(res.status).toBe(204);
    expect(res.cookies.get("pos_session")?.value).toBe("");
    expect(res.cookies.get("pos_staff")?.value).toBe("");
  });

  it("still signs the device out when the API is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const res = await POST(request("pos_session=tok-123"));
    expect(res.status).toBe(204);
    expect(res.cookies.get("pos_session")?.value).toBe("");
  });

  it("does not call the API without a session", async () => {
    await POST(request());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
