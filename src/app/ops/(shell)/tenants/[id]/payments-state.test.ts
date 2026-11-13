import { describe, expect, it } from "vitest";
import type { PaymentsView, StripeRequirement } from "../../api";
import {
  blocksLabel,
  CARD_REQUIRED,
  formFromPayments,
  isDirty,
  majorToMinor,
  minorToMajor,
  percentToBps,
  sortRequirements,
  stripeSteps,
  validatePaymentsForm,
  waitingOnLabel,
} from "./payments-state";

const VIEW: PaymentsView = {
  tenantId: "t1",
  stripeAccountId: "acct_1",
  status: "active",
  requirementsDue: 0,
  cardPaymentsActive: true,
  payoutsActive: true,
  detailsSubmitted: true,
  requirements: [],
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

  it("refuses no methods, no card and bad fees", () => {
    expect(validatePaymentsForm({ methods: [], percent: "0", fixed: "0" })).toHaveProperty("error");
    expect(validatePaymentsForm({ methods: ["apple_pay", "google_pay"], percent: "0", fixed: "0" })).toEqual({ error: CARD_REQUIRED });
    expect(validatePaymentsForm({ methods: ["card"], percent: "101", fixed: "0" })).toHaveProperty("error");
    expect(validatePaymentsForm({ methods: ["card"], percent: "0", fixed: "abc" })).toHaveProperty("error");
  });

  it("knows when the form was edited", () => {
    expect(isDirty(formFromPayments(VIEW), VIEW)).toBe(false);
    expect(isDirty({ ...formFromPayments(VIEW), methods: ["card"] }, VIEW)).toBe(true);
    expect(isDirty({ ...formFromPayments(VIEW), percent: "3" }, VIEW)).toBe(true);
  });

  it("walks the Stripe steps: first not-done step is current, the rest wait", () => {
    const states = (v: PaymentsView) => stripeSteps(v).map((s) => s.state);
    const fresh: PaymentsView = { ...VIEW, status: "not_connected", stripeAccountId: null, detailsSubmitted: false, cardPaymentsActive: false, payoutsActive: false };
    expect(states(fresh)).toEqual(["current", "waiting", "waiting", "waiting"]);
    expect(states({ ...fresh, status: "onboarding", stripeAccountId: "acct_1" })).toEqual(["done", "current", "waiting", "waiting"]);
    expect(states({ ...VIEW, status: "restricted", payoutsActive: false })).toEqual(["done", "done", "done", "current"]);
    expect(states(VIEW)).toEqual(["done", "done", "done", "done"]);
    expect(stripeSteps(VIEW)[2].detail).toBe("Guests can pay by card");
  });

  it("explains why a capability is held", () => {
    const req: StripeRequirement = { code: "external_account", title: "Bank account", problem: null, urgency: "currently_due", blocks: ["payouts"], waitingOn: "owner" };
    const view: PaymentsView = { ...VIEW, status: "restricted", payoutsActive: false, cardPaymentsActive: false, requirements: [req] };
    const [, , card, payouts] = stripeSteps(view);
    expect(payouts.detail).toBe("Stripe holds payouts until the items below are fixed");
    expect(card.detail).toBe("Stripe is checking the details");
    expect(stripeSteps({ ...view, detailsSubmitted: false })[3].detail).toBe("Turns on once the owner's details are in");
  });

  it("orders requirements by urgency, owner first, and labels them", () => {
    const r = (code: string, urgency: StripeRequirement["urgency"], waitingOn: StripeRequirement["waitingOn"]): StripeRequirement => ({ code, title: code, problem: null, urgency, blocks: [], waitingOn });
    const sorted = sortRequirements([r("a", "eventually_due", "owner"), r("b", "currently_due", "stripe"), r("c", "currently_due", "owner"), r("d", "past_due", "stripe")]);
    expect(sorted.map((x) => x.code)).toEqual(["d", "c", "b", "a"]);
    expect(blocksLabel(["payouts", "card_payments"])).toBe("Blocks card payments and payouts");
    expect(blocksLabel(["payouts"])).toBe("Blocks payouts");
    expect(blocksLabel([])).toBeNull();
    expect(waitingOnLabel("stripe")).toBe("Stripe is reviewing");
  });
});
