import { describe, expect, it } from "vitest";
import { formatAsOf } from "./dashboard-state";

describe("formatAsOf", () => {
  const now = new Date("2026-08-24T15:00:00.000Z");

  it("shows just the time when the snapshot is from today", () => {
    expect(formatAsOf("2026-08-24T09:05:00.000Z", now)).toBe("9:05am");
    expect(formatAsOf("2026-08-24T00:00:00.000Z", now)).toBe("12:00am");
    expect(formatAsOf("2026-08-24T12:30:00.000Z", now)).toBe("12:30pm");
  });

  it("prefixes the date when the snapshot is from an earlier day", () => {
    expect(formatAsOf("2026-08-20T09:05:00.000Z", now)).toBe("20 Aug, 9:05am");
  });
});
