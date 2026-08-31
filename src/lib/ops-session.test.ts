import { describe, expect, it } from "vitest";
import { decideOpsRoute, sanitizeNextPath } from "./ops-session";

function fakeToken(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ sub: "op-1", aud: "ops", exp })).toString("base64url");
  return `header.${payload}.signature`;
}

const inOneHour = Math.floor(Date.now() / 1000) + 3600;
const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

describe("decideOpsRoute", () => {
  it("allows the login page and the login route handler without a session", () => {
    expect(decideOpsRoute("/ops/login", "", undefined)).toEqual({ allow: true });
    expect(decideOpsRoute("/ops/auth/login", "", undefined)).toEqual({ allow: true });
  });

  it("redirects unauthenticated /ops requests to login with the return URL", () => {
    const decision = decideOpsRoute("/ops/tenants", "?status=active", undefined);
    expect(decision).toEqual({
      allow: false,
      redirectTo: `/ops/login?next=${encodeURIComponent("/ops/tenants?status=active")}`,
    });
  });

  it("allows /ops with a live session token", () => {
    expect(decideOpsRoute("/ops", "", fakeToken(inOneHour))).toEqual({ allow: true });
  });

  it("redirects an expired session with expired=1 for the banner", () => {
    const decision = decideOpsRoute("/ops/devices", "", fakeToken(oneHourAgo));
    expect(decision).toEqual({
      allow: false,
      redirectTo: `/ops/login?next=${encodeURIComponent("/ops/devices")}&expired=1`,
    });
  });

  it("treats a malformed cookie as expired rather than letting it through", () => {
    const decision = decideOpsRoute("/ops", "", "not-a-jwt");
    expect(decision.allow).toBe(false);
  });
});

describe("sanitizeNextPath", () => {
  it("keeps in-console paths", () => {
    expect(sanitizeNextPath("/ops/sync-health?outlet=7")).toBe("/ops/sync-health?outlet=7");
    expect(sanitizeNextPath("/ops")).toBe("/ops");
  });

  it("drops external and non-ops targets", () => {
    expect(sanitizeNextPath("https://evil.example/ops")).toBe("/ops");
    expect(sanitizeNextPath("//evil.example")).toBe("/ops");
    expect(sanitizeNextPath("/account")).toBe("/ops");
    expect(sanitizeNextPath(undefined)).toBe("/ops");
    expect(sanitizeNextPath("/opsx")).toBe("/ops");
  });
});
