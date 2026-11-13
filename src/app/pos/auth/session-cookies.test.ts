// @vitest-environment node
import { describe, expect, it } from "vitest";
import { POS_SESSION_COOKIE, POS_STAFF_COOKIE } from "@/lib/pos-session";
import { posLoginResponse } from "./session-cookies";

const result = { status: "authenticated", token: "jwt", staff: { id: "s1", name: "Priya" }, outlet: { id: "o1", name: "Spice Route" } } as const;

function setCookies(url: string, headers: Record<string, string> = {}): string[] {
  return posLoginResponse(result, new Request(url, { method: "POST", headers })).headers.getSetCookie();
}

describe("posLoginResponse cookie security (W1)", () => {
  it("sets non-secure cookies over plain http on a shop LAN", () => {
    const cookies = setCookies("http://192.168.1.20:3000/pos/auth/login");
    expect(cookies.some((c) => c.startsWith(`${POS_SESSION_COOKIE}=`))).toBe(true);
    expect(cookies.some((c) => c.startsWith(`${POS_STAFF_COOKIE}=`))).toBe(true);
    for (const c of cookies) expect(c).not.toMatch(/;\s*secure/i);
  });

  it("sets secure cookies over https", () => {
    const cookies = setCookies("https://web.example.test/pos/auth/login");
    expect(cookies).toHaveLength(2);
    for (const c of cookies) expect(c).toMatch(/;\s*secure/i);
  });

  it("sets secure cookies behind a TLS-terminating proxy", () => {
    for (const c of setCookies("http://internal:3000/pos/auth/login", { "x-forwarded-proto": "https" })) expect(c).toMatch(/;\s*secure/i);
  });
});
