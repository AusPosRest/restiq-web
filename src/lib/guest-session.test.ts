import { describe, expect, it } from "vitest";
import { decideGuestRoute } from "./guest-session";

describe("decideGuestRoute", () => {
  it("always allows the table entry point, with or without a session", () => {
    expect(decideGuestRoute("/qr/t/o1/t1", "", undefined)).toEqual({ allow: true });
    expect(decideGuestRoute("/qr/t/o1/t1", "", "some-token")).toEqual({ allow: true });
  });

  it("always allows the auth route handlers", () => {
    expect(decideGuestRoute("/qr/auth/start", "", undefined)).toEqual({ allow: true });
    expect(decideGuestRoute("/qr/auth/join", "", undefined)).toEqual({ allow: true });
  });

  it("redirects to /qr when a future gated path has no session token", () => {
    expect(decideGuestRoute("/qr/menu", "", undefined)).toEqual({ allow: false, redirectTo: "/qr" });
  });

  it("redirects to /qr when a future gated path has an expired token", () => {
    const expired = `x.${Buffer.from(JSON.stringify({ exp: 1 })).toString("base64")}.x`;
    expect(decideGuestRoute("/qr/menu", "", expired)).toEqual({ allow: false, redirectTo: "/qr" });
  });

  it("allows a future gated path with a live token", () => {
    const live = `x.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64")}.x`;
    expect(decideGuestRoute("/qr/menu", "", live)).toEqual({ allow: true });
  });
});
