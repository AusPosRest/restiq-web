// @vitest-environment node
import { describe, expect, it } from "vitest";
import { guestSessionResponse } from "./session-cookies";

const display = { outletId: "o1", tableId: "t1", guestName: "Asha", pin: "1234" };

describe("guestSessionResponse cookie security (W1)", () => {
  it("is not secure over http and secure over https", () => {
    const http = guestSessionResponse("a.b.c", display, new Request("http://192.168.1.20:3000/qr/auth/kiosk", { method: "POST" })).headers.getSetCookie();
    const https = guestSessionResponse("a.b.c", display, new Request("https://web.example.test/qr/auth/kiosk", { method: "POST" })).headers.getSetCookie();
    expect(http).toHaveLength(2);
    for (const c of http) expect(c).not.toMatch(/;\s*secure/i);
    for (const c of https) expect(c).toMatch(/;\s*secure/i);
  });
});
