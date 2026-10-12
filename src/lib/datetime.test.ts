import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./datetime";

describe("datetime (PE-7)", () => {
  it("is day-first, never the US month-first default", () => {
    const iso = "2026-10-11T12:43:08.000Z";
    expect(formatDate(iso)).toBe("11 Oct 2026");
    expect(formatDateTime(iso)).toMatch(/^11 Oct 2026, \d{1,2}:\d{2}\s?[ap]m$/i);
    expect(formatDate(iso, "en-AU")).toBe("11 Oct 2026");
  });
});
