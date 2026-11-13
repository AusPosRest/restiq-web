import { describe, expect, it } from "vitest";
import type { PaymentsView } from "../../api";
import { formFromPayments, isDirty, majorToMinor, minorToMajor, percentToBps, validatePaymentsForm } from "./payments-state";

const VIEW: PaymentsView = {
  tenantId: "t1",
  stripeAccountId: "acct_1",
  status: "active",
  requirementsDue: 0,
  allowedMethods: ["card", "apple_pay", "google_pay"],
  feePercentBps: 250,
  feeFixedMinor: "30",
  currency: "AUD",
};

describe("payments-state", () => {
  it("converts percent to basis points without float drift", () => {
    expect(percentToBps("2.5")).toBe(250);
    expect(percentToBps("0.07")).toBe(7);
    expect(percentToBps("100")).toBe(10000);
    expect(percentToBps("0")).toBe(0);
    expect(percentToBps("100.01")).toBeNull();
    expect(percentToBps("1.234")).toBeNull();
    expect(percentToBps("-1")).toBeNull();
    expect(percentToBps("")).toBeNull();
  });

  it("converts major units to a minor-unit string and back", () => {
    expect(majorToMinor("0.30")).toBe("30");
    expect(majorToMinor("1.5")).toBe("150");
    expect(majorToMinor("12")).toBe("1200");
    expect(majorToMinor("-1")).toBeNull();
    expect(majorToMinor("1.999")).toBeNull();
    expect(minorToMajor("30")).toBe("0.30");
    expect(minorToMajor("1200")).toBe("12");
  });

  it("builds the form from the view and validates it into a patch", () => {
    const form = formFromPayments(VIEW);
    expect(form).toEqual({ methods: ["card", "apple_pay", "google_pay"], percent: "2.5", fixed: "0.30" });
    expect(validatePaymentsForm(form)).toEqual({ allowedMethods: ["card", "apple_pay", "google_pay"], feePercentBps: 250, feeFixedMinor: "30" });
  });

  it("refuses no methods and bad fees", () => {
    expect(validatePaymentsForm({ methods: [], percent: "0", fixed: "0" })).toHaveProperty("error");
    expect(validatePaymentsForm({ methods: ["card"], percent: "101", fixed: "0" })).toHaveProperty("error");
    expect(validatePaymentsForm({ methods: ["card"], percent: "0", fixed: "abc" })).toHaveProperty("error");
  });

  it("knows when the form was edited", () => {
    expect(isDirty(formFromPayments(VIEW), VIEW)).toBe(false);
    expect(isDirty({ ...formFromPayments(VIEW), methods: ["card"] }, VIEW)).toBe(true);
    expect(isDirty({ ...formFromPayments(VIEW), percent: "3" }, VIEW)).toBe(true);
  });
});
