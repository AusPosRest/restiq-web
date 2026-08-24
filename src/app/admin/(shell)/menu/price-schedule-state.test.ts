import { describe, expect, it } from "vitest";
import { initialPriceScheduleForm, priceScheduleEffectiveAt, priceScheduleFormIsValid, validatePriceScheduleForm } from "./price-schedule-state";

const TODAY = new Date("2026-08-24T12:00:00.000Z");

describe("initialPriceScheduleForm", () => {
  it("seeds the form from the current price in major units, defaulting to today", () => {
    const form = initialPriceScheduleForm({ dineInPriceMinor: 18000, deliveryPriceMinor: 20000 });
    expect(form).toEqual({ mode: "today", effectiveDate: "", dineIn: "180.00", delivery: "200.00", reason: "" });
  });
});

describe("validatePriceScheduleForm", () => {
  const valid = { mode: "today" as const, effectiveDate: "", dineIn: "180", delivery: "200", reason: "Menu refresh" };

  it("is valid for a same-day change with a reason", () => {
    expect(validatePriceScheduleForm(valid, TODAY)).toEqual({});
  });

  it("requires a reason - price changes are security-relevant per SPEC", () => {
    expect(validatePriceScheduleForm({ ...valid, reason: "  " }, TODAY).reason).toBe("Add a reason for this price change.");
  });

  it("rejects a negative or non-numeric dine-in price", () => {
    expect(validatePriceScheduleForm({ ...valid, dineIn: "-5" }, TODAY).dineIn).toBeDefined();
    expect(validatePriceScheduleForm({ ...valid, dineIn: "abc" }, TODAY).dineIn).toBeDefined();
  });

  it("requires a date when scheduling for later", () => {
    expect(validatePriceScheduleForm({ ...valid, mode: "schedule", effectiveDate: "" }, TODAY).effectiveDate).toBe(
      "Pick a date for this change.",
    );
  });

  it("rejects today or a past date when scheduling for later", () => {
    expect(validatePriceScheduleForm({ ...valid, mode: "schedule", effectiveDate: "2026-08-24" }, TODAY).effectiveDate).toBe(
      "Pick a date after today.",
    );
    expect(validatePriceScheduleForm({ ...valid, mode: "schedule", effectiveDate: "2026-08-01" }, TODAY).effectiveDate).toBe(
      "Pick a date after today.",
    );
  });

  it("accepts a future date when scheduling for later", () => {
    expect(validatePriceScheduleForm({ ...valid, mode: "schedule", effectiveDate: "2026-09-01" }, TODAY)).toEqual({});
  });
});

describe("priceScheduleFormIsValid", () => {
  it("mirrors validatePriceScheduleForm", () => {
    const valid = { mode: "today" as const, effectiveDate: "", dineIn: "180", delivery: "200", reason: "Menu refresh" };
    expect(priceScheduleFormIsValid(valid, TODAY)).toBe(true);
    expect(priceScheduleFormIsValid({ ...valid, reason: "" }, TODAY)).toBe(false);
  });
});

describe("priceScheduleEffectiveAt", () => {
  it("returns null for an immediate (today) change", () => {
    expect(priceScheduleEffectiveAt({ mode: "today", effectiveDate: "", dineIn: "1", delivery: "1", reason: "x" })).toBeNull();
  });

  it("returns an ISO timestamp for a scheduled date", () => {
    const iso = priceScheduleEffectiveAt({ mode: "schedule", effectiveDate: "2026-09-01", dineIn: "1", delivery: "1", reason: "x" });
    expect(iso).toBe("2026-09-01T00:00:00.000Z");
  });
});
