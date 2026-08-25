import { describe, expect, it } from "vitest";
import { decidePosRoute, sanitizePosNextPath } from "./pos-session";

function fakeToken(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ sub: "staff-1", aud: "pos", exp })).toString("base64url");
  return `header.${payload}.signature`;
}

const inOneHour = Math.floor(Date.now() / 1000) + 3600;
const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

describe("decidePosRoute", () => {
  it("allows the login page without a session", () => {
    expect(decidePosRoute("/pos/login", "", undefined)).toEqual({ allow: true });
  });

  it("redirects unauthenticated /pos requests to login with the return URL", () => {
    const decision = decidePosRoute("/pos/table-map", "?floor=ground", undefined);
    expect(decision).toEqual({
      allow: false,
      redirectTo: `/pos/login?next=${encodeURIComponent("/pos/table-map?floor=ground")}`,
    });
  });

  it("allows /pos/table-map with a live session token", () => {
    expect(decidePosRoute("/pos/table-map", "", fakeToken(inOneHour))).toEqual({ allow: true });
  });

  it("redirects an expired session with expired=1 for the banner", () => {
    const decision = decidePosRoute("/pos/table-map", "", fakeToken(oneHourAgo));
    expect(decision).toEqual({
      allow: false,
      redirectTo: `/pos/login?next=${encodeURIComponent("/pos/table-map")}&expired=1`,
    });
  });

  it("treats a malformed cookie as expired rather than letting it through", () => {
    const decision = decidePosRoute("/pos/table-map", "", "not-a-jwt");
    expect(decision.allow).toBe(false);
  });
});

describe("sanitizePosNextPath", () => {
  it("keeps in-surface paths", () => {
    expect(sanitizePosNextPath("/pos/table-map")).toBe("/pos/table-map");
    expect(sanitizePosNextPath("/pos")).toBe("/pos");
  });

  it("drops external and other-realm targets", () => {
    expect(sanitizePosNextPath("https://evil.example/pos")).toBe("/pos");
    expect(sanitizePosNextPath("//evil.example")).toBe("/pos");
    expect(sanitizePosNextPath("/admin")).toBe("/pos");
    expect(sanitizePosNextPath(undefined)).toBe("/pos");
    expect(sanitizePosNextPath("/posx")).toBe("/pos");
  });
});
