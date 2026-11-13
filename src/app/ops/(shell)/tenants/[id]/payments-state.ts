// Payments tab (issue #425): form <-> API shaping. Percent is typed as %, sent as basis
// points; the fixed fee is typed in major units, sent as a minor-unit string. Parsed from
// the text (no float maths) so 0.07 never becomes 6.999.
import type { PaymentMethod, PaymentsView, StripeRequirement } from "../../api";

export interface PaymentsForm {
  methods: PaymentMethod[];
  /** Percent as typed, e.g. "2.5". */
  percent: string;
  /** Major units as typed, e.g. "0.30". */
  fixed: string;
}

export const METHOD_LABELS: Record<PaymentMethod, string> = { card: "Card", apple_pay: "Apple Pay", google_pay: "Google Pay" };
export const ALL_METHODS: PaymentMethod[] = ["card", "apple_pay", "google_pay"];

/** restiq-backend#284: the wallets are card payments underneath. */
export const CARD_REQUIRED = "Apple Pay and Google Pay run on card payments, so Card must stay on";

const DECIMAL = /^(\d+)(?:\.(\d{1,2}))?$/;

/** "2.5" -> 250; null when not a number from 0 to 100 with at most 2 decimals. */
export function percentToBps(text: string): number | null {
  const m = DECIMAL.exec(text.trim());
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return bps <= 10000 ? bps : null;
}

/** "0.30" -> "30"; null when not a non-negative amount with at most 2 decimals. */
export function majorToMinor(text: string): string | null {
  const m = DECIMAL.exec(text.trim());
  if (!m) return null;
  return `${m[1]}${(m[2] ?? "").padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
}

export function bpsToPercent(bps: number): string {
  return String(bps / 100);
}

export function minorToMajor(minor: string): string {
  const padded = minor.padStart(3, "0");
  const whole = padded.slice(0, -2);
  const cents = padded.slice(-2);
  return cents === "00" ? whole : `${whole}.${cents}`;
}

export function formFromPayments(view: PaymentsView): PaymentsForm {
  return { methods: view.allowedMethods, percent: bpsToPercent(view.feePercentBps), fixed: minorToMajor(view.feeFixedMinor) };
}

export interface PaymentsPatch {
  allowedMethods: PaymentMethod[];
  feePercentBps: number;
  feeFixedMinor: string;
}

export function validatePaymentsForm(form: PaymentsForm): PaymentsPatch | { error: string } {
  if (!form.methods.includes("card")) return { error: CARD_REQUIRED };
  const feePercentBps = percentToBps(form.percent);
  if (feePercentBps === null) return { error: "The percentage fee is a number from 0 to 100 with up to 2 decimals." };
  const feeFixedMinor = majorToMinor(form.fixed);
  if (feeFixedMinor === null) return { error: "The fixed fee is an amount of 0 or more with up to 2 decimals." };
  return { allowedMethods: ALL_METHODS.filter((m) => form.methods.includes(m)), feePercentBps, feeFixedMinor };
}

export function isDirty(form: PaymentsForm, view: PaymentsView): boolean {
  const original = formFromPayments(view);
  const methods = (list: PaymentMethod[]) => [...list].sort().join();
  return methods(form.methods) !== methods(original.methods) || form.percent.trim() !== original.percent || form.fixed.trim() !== original.fixed;
}

// --- Stripe account progress (restiq-backend#284 onboarding UX).

export type StepState = "done" | "current" | "waiting";

export interface StripeStep {
  key: "created" | "details" | "card_payments" | "payouts";
  title: string;
  detail: string;
  state: StepState;
}

/** The four steps from "no account" to "money reaches the bank". The first step not done is current. */
export function stripeSteps(view: PaymentsView): StripeStep[] {
  const blocks = (capability: StripeRequirement["blocks"][number]) => view.requirements.some((r) => r.blocks.includes(capability));
  const held = (capability: StripeRequirement["blocks"][number], what: string) =>
    !view.detailsSubmitted
      ? "Turns on once the owner's details are in"
      : blocks(capability)
        ? `Stripe holds ${what} until the items below are fixed`
        : "Stripe is checking the details";
  const created = view.status !== "not_connected";
  const steps: Array<Omit<StripeStep, "state"> & { done: boolean }> = [
    {
      key: "created",
      title: "Stripe account created",
      done: created,
      detail: created ? "The restaurant has its own Stripe account" : "The first button press below creates it",
    },
    {
      key: "details",
      title: "Owner details sent to Stripe",
      done: view.detailsSubmitted,
      detail: view.detailsSubmitted ? "The owner has been through Stripe's form" : "The owner fills in business, identity and bank details on Stripe",
    },
    {
      key: "card_payments",
      title: "Card payments",
      done: view.cardPaymentsActive,
      detail: view.cardPaymentsActive ? "Guests can pay by card" : held("card_payments", "card payments"),
    },
    {
      key: "payouts",
      title: "Payouts to the bank",
      done: view.payoutsActive,
      detail: view.payoutsActive ? "Stripe pays takings into the owner's bank" : held("payouts", "payouts"),
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  return steps.map(({ done, ...step }, i) => ({ ...step, state: done ? "done" : i === current ? "current" : "waiting" }));
}

export const URGENCY_LABELS: Record<StripeRequirement["urgency"], string> = {
  past_due: "Overdue",
  currently_due: "Due now",
  eventually_due: "Later",
};

const URGENCY_ORDER: StripeRequirement["urgency"][] = ["past_due", "currently_due", "eventually_due"];

/** Most urgent first; the owner's items ahead of Stripe's within the same urgency. */
export function sortRequirements(requirements: StripeRequirement[]): StripeRequirement[] {
  const rank = (r: StripeRequirement) => URGENCY_ORDER.indexOf(r.urgency) * 2 + (r.waitingOn === "owner" ? 0 : 1);
  return [...requirements].sort((a, b) => rank(a) - rank(b));
}

/** "Blocks card payments and payouts"; null when it blocks nothing yet. */
export function blocksLabel(blocks: StripeRequirement["blocks"]): string | null {
  const names = (["card_payments", "payouts"] as const).filter((b) => blocks.includes(b)).map((b) => (b === "card_payments" ? "card payments" : "payouts"));
  return names.length ? `Blocks ${names.join(" and ")}` : null;
}

export function waitingOnLabel(waitingOn: StripeRequirement["waitingOn"]): string {
  return waitingOn === "owner" ? "Owner" : "Stripe is reviewing";
}
