// restiq-web#371: the till's request helper sends an ended session to sign-in (see src/lib/session-ended.ts).
import { afterEach, describe, expect, it, vi } from "vitest";
import { posApi } from "./api";

function stubPage(pathname: string) {
  const assign = vi.fn();
  vi.stubGlobal("location", { pathname, search: "", assign, href: `http://localhost${pathname}` });
  return assign;
}

function stubRefusal(status: number, code: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code, message: "nope" } }), { status })));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the till's request helper", () => {
  it("goes to sign-in when the API says the session is over, and still rejects", async () => {
    const assign = stubPage("/pos/shift");
    stubRefusal(401, "session_revoked");
    await expect(posApi("menu")).rejects.toThrow("This session has ended");
    expect(assign).toHaveBeenCalledWith("/pos/login?next=%2Fpos%2Fshift&expired=1");
  });

  it("goes to sign-in when an expired cookie got the request redirected to the sign-in page, instead of reading it as an empty answer", async () => {
    const assign = stubPage("/pos/shift");
    // What fetch hands back after following src/proxy.ts's redirect: the sign-in page's HTML, 200.
    const html = { ok: true, status: 200, redirected: true, url: "http://localhost/pos/login?next=%2Fapi", json: () => Promise.reject(new SyntaxError("not JSON")) };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(html));
    await expect(posApi("menu")).rejects.toThrow("This session has ended");
    expect(assign).toHaveBeenCalledWith("/pos/login?next=%2Fpos%2Fshift&expired=1");
  });

  it("a refused manager PIN does not sign the cashier out", async () => {
    const assign = stubPage("/pos/orders/o-1/settle");
    stubRefusal(401, "invalid_pin");
    await expect(posApi("bills/b-1/refund", { method: "POST" })).rejects.toThrow("nope");
    expect(assign).not.toHaveBeenCalled();
  });
});
