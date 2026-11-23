// restiq-web#371: the owner console's request helper sends an ended session to sign-in (see src/lib/session-ended.ts).
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminApi } from "./api";

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

describe("the owner console's request helper", () => {
  it("goes to sign-in when the API says the session is over, and still rejects", async () => {
    const assign = stubPage("/admin/staff");
    stubRefusal(401, "session_revoked");
    await expect(adminApi("staff")).rejects.toThrow("This session has ended");
    expect(assign).toHaveBeenCalledWith("/admin/login?next=%2Fadmin%2Fstaff&expired=1");
  });

  it("goes to sign-in when an expired cookie got the request redirected to the sign-in page, instead of reading it as an empty answer", async () => {
    const assign = stubPage("/admin/staff");
    // What fetch hands back after following src/proxy.ts's redirect: the sign-in page's HTML, 200.
    const html = { ok: true, status: 200, redirected: true, url: "http://localhost/admin/login?next=%2Fapi", json: () => Promise.reject(new SyntaxError("not JSON")) };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(html));
    await expect(adminApi("staff")).rejects.toThrow("This session has ended");
    expect(assign).toHaveBeenCalledWith("/admin/login?next=%2Fadmin%2Fstaff&expired=1");
  });
});
