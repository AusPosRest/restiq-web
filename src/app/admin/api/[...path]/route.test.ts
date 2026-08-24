// @vitest-environment node
// NextRequest's FormData/fetch plumbing is undici's, which doesn't line up
// with jsdom's File/FormData globals (the default test environment) - the
// node environment matches what this route handler actually runs under.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { PATCH, POST } from "./route";

const API_URL = "https://api.example.test";

function requestWithCookie(url: string, init: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  const request = new NextRequest(url, init);
  request.cookies.set(ADMIN_SESSION_COOKIE, "a-jwt");
  return request;
}

describe("admin API pass-through", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards a multipart upload with its original boundary and raw bytes intact", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3, 4])], "menu.pdf", { type: "application/pdf" }));

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ importId: "i1", items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = requestWithCookie("https://web.example.test/admin/api/menu-import/upload", { method: "POST", body: form });
    const originalContentType = request.headers.get("content-type");

    const res = await POST(request, { params: Promise.resolve({ path: ["menu-import", "upload"] }) });

    expect(res.status).toBe(200);
    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(upstreamUrl).toBe(`${API_URL}/admin/v1/menu-import/upload`);
    expect((upstreamInit.headers as Record<string, string>)["content-type"]).toBe(originalContentType);
    // the forwarded body must still contain the uploaded file's raw bytes, not a JSON/text re-encoding
    expect(Buffer.from(upstreamInit.body as ArrayBuffer).includes(Buffer.from([1, 2, 3, 4]))).toBe(true);
  });

  it("still forwards JSON bodies as text with a JSON content-type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = requestWithCookie("https://web.example.test/admin/api/menu-import/imp1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: "1", field: "name", value: "Paneer Tikka" }),
    });

    await PATCH(request, { params: Promise.resolve({ path: ["menu-import", "imp1"] }) });

    const [, upstreamInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((upstreamInit.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(upstreamInit.body).toBe(JSON.stringify({ itemId: "1", field: "name", value: "Paneer Tikka" }));
  });
});
