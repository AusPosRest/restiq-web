// restiq-web#371: a session that is over sends the browser to its sign-in page, and nothing else
// that answers 401 does. Each console's own api.test.ts checks its request helper calls this.
import { afterEach, describe, expect, it, vi } from "vitest";
import { leaveIfSessionEnded } from "./session-ended";

function stubLocation(pathname: string, search = "") {
  const assign = vi.fn();
  vi.stubGlobal("location", { pathname, search, assign, href: `http://localhost${pathname}${search}` });
  return assign;
}

const refused = (status: number, code?: string) => [{ status, redirected: false, url: "" }, { error: { code, message: "nope" } }] as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("leaveIfSessionEnded", () => {
  it("goes to sign-in with the page to come back to, when the API says the session is over", () => {
    const assign = stubLocation("/admin/staff", "?tab=roles");
    expect(leaveIfSessionEnded(...refused(401, "session_revoked"), "/admin/login")).toBe(true);
    expect(assign).toHaveBeenCalledWith("/admin/login?next=%2Fadmin%2Fstaff%3Ftab%3Droles&expired=1");
    assign.mockClear();
    expect(leaveIfSessionEnded(...refused(401, "unauthorized"), "/admin/login")).toBe(true);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("goes to sign-in when an expired cookie got the request redirected to the sign-in page", () => {
    const assign = stubLocation("/kds");
    const res = { status: 200, redirected: true, url: "http://localhost/pos/login?next=%2Fkds%2Fapi%2Fstations" };
    expect(leaveIfSessionEnded(res, null, "/pos/login")).toBe(true);
    expect(assign).toHaveBeenCalledWith("/pos/login?next=%2Fkds&expired=1");
  });

  it("stays put for a 401 that is not the session ending, for other errors and for other redirects", () => {
    const assign = stubLocation("/pos/orders/o-1/settle");
    expect(leaveIfSessionEnded(...refused(401, "invalid_pin"), "/pos/login")).toBe(false);
    expect(leaveIfSessionEnded(...refused(401, "invalid_credentials"), "/pos/login")).toBe(false);
    expect(leaveIfSessionEnded(...refused(401), "/pos/login")).toBe(false);
    expect(leaveIfSessionEnded(...refused(403, "unauthorized"), "/pos/login")).toBe(false);
    expect(leaveIfSessionEnded(...refused(500, "session_revoked"), "/pos/login")).toBe(false);
    expect(leaveIfSessionEnded({ status: 200, redirected: true, url: "http://localhost/pos/table-map" }, null, "/pos/login")).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not loop on the sign-in page itself", () => {
    const assign = stubLocation("/ops/login");
    expect(leaveIfSessionEnded(...refused(401, "unauthorized"), "/ops/login")).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
