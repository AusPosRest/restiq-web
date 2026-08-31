import { describe, expect, it } from "vitest";
import { decideAdminRoute, sanitizeAdminNextPath } from "./admin-session";

function fakeToken(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ sub: "owner-1", aud: "admin", exp })).toString("base64url");
  return `header.${payload}.signature`;
}

const inOneHour = Math.floor(Date.now() / 1000) + 3600;
const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

describe("decideAdminRoute", () => {
  it("allows an invite acceptance link of any token without a session", () => {
    expect(decideAdminRoute("/admin/invite/abc123", "", undefined)).toEqual({ allow: true });
    expect(decideAdminRoute("/admin/invite/abc123", "", fakeToken(oneHourAgo))).toEqual({ allow: true });
  });

  it("allows the login page and the accept-invite route handler without a session", () => {
    expect(decideAdminRoute("/admin/login", "", undefined)).toEqual({ allow: true });
    expect(decideAdminRoute("/admin/auth/accept-invite", "", undefined)).toEqual({ allow: true });
  });

  it("redirects unauthenticated /admin requests to login with the return URL", () => {
    const decision = decideAdminRoute("/admin/onboarding", "?step=menu", undefined);
    expect(decision).toEqual({
      allow: false,
      redirectTo: `/admin/login?next=${encodeURIComponent("/admin/onboarding?step=menu")}`,
    });
  });

  it("allows /admin/onboarding with a live session token", () => {
    expect(decideAdminRoute("/admin/onboarding", "", fakeToken(inOneHour))).toEqual({ allow: true });
  });

  it("redirects an expired session with expired=1 for the banner", () => {
    const decision = decideAdminRoute("/admin/onboarding", "", fakeToken(oneHourAgo));
    expect(decision).toEqual({
      allow: false,
      redirectTo: `/admin/login?next=${encodeURIComponent("/admin/onboarding")}&expired=1`,
    });
  });

  it("treats a malformed cookie as expired rather than letting it through", () => {
    const decision = decideAdminRoute("/admin/onboarding", "", "not-a-jwt");
    expect(decision.allow).toBe(false);
  });
});

describe("sanitizeAdminNextPath", () => {
  it("keeps in-console paths", () => {
    expect(sanitizeAdminNextPath("/admin/onboarding?step=2")).toBe("/admin/onboarding?step=2");
    expect(sanitizeAdminNextPath("/admin")).toBe("/admin");
  });

  it("drops external and non-admin targets, including the /ops realm", () => {
    expect(sanitizeAdminNextPath("https://evil.example/admin")).toBe("/admin");
    expect(sanitizeAdminNextPath("//evil.example")).toBe("/admin");
    expect(sanitizeAdminNextPath("/ops")).toBe("/admin");
    expect(sanitizeAdminNextPath(undefined)).toBe("/admin");
    expect(sanitizeAdminNextPath("/adminx")).toBe("/admin");
  });
});
