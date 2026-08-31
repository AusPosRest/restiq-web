import { describe, expect, it } from "vitest";
import { decodeTokenSubject, tokenIsExpired } from "./session-token";

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

describe("decodeTokenSubject", () => {
  it("returns the sub claim from a well-formed token", () => {
    expect(decodeTokenSubject(fakeToken(Math.floor(Date.now() / 1000) + 3600))).toBe("x");
  });

  it("returns null for a malformed token", () => {
    expect(decodeTokenSubject("not-a-jwt")).toBeNull();
  });

  it("returns null when the payload has no sub", () => {
    const payload = Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url");
    expect(decodeTokenSubject(`header.${payload}.signature`)).toBeNull();
  });
});
