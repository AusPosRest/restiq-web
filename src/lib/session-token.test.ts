import { describe, expect, it } from "vitest";
import { tokenIsExpired } from "./session-token";

function fakeToken(exp: number): string {
  const payload = Buffer.from(JSON.stringify({ sub: "x", exp })).toString("base64url");
  return `header.${payload}.signature`;
}

describe("tokenIsExpired", () => {
  it("is false for a token with a future exp", () => {
    expect(tokenIsExpired(fakeToken(Math.floor(Date.now() / 1000) + 3600))).toBe(false);
  });

  it("is true for a token with a past exp", () => {
    expect(tokenIsExpired(fakeToken(Math.floor(Date.now() / 1000) - 3600))).toBe(true);
  });

  it("is true for a malformed token", () => {
    expect(tokenIsExpired("not-a-jwt")).toBe(true);
  });

  it("is true when the payload has no numeric exp", () => {
    const payload = Buffer.from(JSON.stringify({ sub: "x" })).toString("base64url");
    expect(tokenIsExpired(`header.${payload}.signature`)).toBe(true);
  });
});
