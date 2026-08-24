import { describe, expect, it } from "vitest";
import { formatClockSkew, formatLag } from "./format";

describe("formatLag", () => {
  it("shows 'just now' under a minute", () => {
    expect(formatLag(0)).toBe("just now");
    expect(formatLag(59)).toBe("just now");
  });

  it("shows minutes only under an hour", () => {
    expect(formatLag(60)).toBe("1m ago");
    expect(formatLag(60 * 12)).toBe("12m ago");
  });

  it("shows hours only on an exact hour", () => {
    expect(formatLag(3600)).toBe("1h ago");
  });

  it("shows hours and minutes otherwise", () => {
    expect(formatLag(2 * 3600 + 14 * 60)).toBe("2h 14m ago");
    expect(formatLag(50 * 3600 + 5 * 60)).toBe("50h 5m ago");
  });
});

describe("formatClockSkew", () => {
  it("signs positive and negative skew, and zero has no sign", () => {
    expect(formatClockSkew(38)).toBe("+38s");
    expect(formatClockSkew(-1)).toBe("-1s");
    expect(formatClockSkew(0)).toBe("0s");
  });
});
