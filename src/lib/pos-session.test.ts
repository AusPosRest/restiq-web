import { describe, expect, it } from "vitest";
import { decidePosRoute, parsePosStaffDisplay, sanitizePosNextPath } from "./pos-session";

function fakeToken(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ sub: "staff-1", aud: "pos", exp })).toString("base64url");
  return `header.${payload}.signature`;
}

const inOneHour = Math.floor(Date.now() / 1000) + 3600;
const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

describe("decidePosRoute", () => {
  it("allows the login page and both auth route handlers without a session", () => {
    expect(decidePosRoute("/pos/login", "", undefined)).toEqual({ allow: true });
    expect(decidePosRoute("/pos/auth/login", "", undefined)).toEqual({ allow: true });
    expect(decidePosRoute("/pos/auth/select-outlet", "", undefined)).toEqual({ allow: true });
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

  it("redirects an unauthenticated /kds request to /pos/login with a /kds return URL (issue #66 - proxy.ts calls this straight for both prefixes)", () => {
    const decision = decidePosRoute("/kds/station/tandoor", "", undefined);
    expect(decision).toEqual({
      allow: false,
      redirectTo: `/pos/login?next=${encodeURIComponent("/kds/station/tandoor")}`,
    });
  });

  it("allows /kds with a live session token", () => {
    expect(decidePosRoute("/kds", "", fakeToken(inOneHour))).toEqual({ allow: true });
  });
});

describe("sanitizePosNextPath", () => {
  it("keeps in-surface paths", () => {
    expect(sanitizePosNextPath("/pos/table-map")).toBe("/pos/table-map");
    expect(sanitizePosNextPath("/pos")).toBe("/pos");
  });

  it("also keeps /kds paths (issue #66 - KDS reuses this same login page)", () => {
    expect(sanitizePosNextPath("/kds")).toBe("/kds");
    expect(sanitizePosNextPath("/kds/station/tandoor")).toBe("/kds/station/tandoor");
  });

  it("drops external and other-realm targets", () => {
    expect(sanitizePosNextPath("https://evil.example/pos")).toBe("/pos");
    expect(sanitizePosNextPath("//evil.example")).toBe("/pos");
    expect(sanitizePosNextPath("/admin")).toBe("/pos");
    expect(sanitizePosNextPath(undefined)).toBe("/pos");
    expect(sanitizePosNextPath("/posx")).toBe("/pos");
  });
});

describe("parsePosStaffDisplay", () => {
  const valid = { staff: { id: "s1", name: "Priya Nair" }, outlet: { id: "o1", name: "Spice Route" } };

  it("parses a well-formed cookie value", () => {
    expect(parsePosStaffDisplay(JSON.stringify(valid))).toEqual(valid);
  });

  it("returns null for missing, malformed, or incomplete values", () => {
    expect(parsePosStaffDisplay(undefined)).toBeNull();
    expect(parsePosStaffDisplay("not-json")).toBeNull();
    expect(parsePosStaffDisplay(JSON.stringify({ staff: { id: "s1", name: "Priya" } }))).toBeNull();
  });
});
