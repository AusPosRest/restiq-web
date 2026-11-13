import { describe, expect, it } from "vitest";
import type { ContractView } from "../../api";
import { amountMinor, emptyRow, isChanged, lineTotalMinor, planRow, rowsFromView, totals, validateRows, type ContractRow } from "./contract-state";

const VIEW: ContractView = {
  currency: "AUD",
  billingPeriod: "monthly",
  items: [
    { id: "i1", description: "Restiq Standard plan", quantity: 2, unitAmountMinor: 4900, kind: "recurring", billedAt: null },
    { id: "i2", description: "Setup", quantity: 1, unitAmountMinor: 15000, kind: "one_time", billedAt: null },
    { id: "i3", description: "Old setup", quantity: 1, unitAmountMinor: 9900, kind: "one_time", billedAt: "2026-11-01T00:00:00.000Z" },
  ],
  source: "contract",
  recurringTotalMinor: "9800",
  nextInvoiceOneTimeMinor: "15000",
  planAmountMinor: "4900",
  appliesFromNextInvoice: false,
};

const row = (patch: Partial<ContractRow>): ContractRow => ({ ...emptyRow(), description: "Item", amount: "10", ...patch });

describe("contract-state", () => {
  it("parses major-unit amounts strictly", () => {
    expect(amountMinor("49")).toBe(4900);
    expect(amountMinor(" 12.5 ")).toBe(1250);
    expect(amountMinor("0.07")).toBe(7);
    for (const bad of ["", "-1", "1.234", "12abc", "1e3"]) expect(amountMinor(bad)).toBeNull();
  });

  it("maps the view to rows and back to the same items", () => {
    const rows = rowsFromView(VIEW);
    expect(rows.map((r) => r.amount)).toEqual(["49.00", "150.00", "99.00"]);
    expect(validateRows(rows)).toEqual({
      items: [
        { description: "Restiq Standard plan", quantity: 2, unitAmountMinor: 4900, kind: "recurring" },
        { description: "Setup", quantity: 1, unitAmountMinor: 15000, kind: "one_time" },
      ],
    });
  });

  it("totals unbilled rows by kind and skips invalid lines", () => {
    const rows = [...rowsFromView(VIEW), row({ quantity: "0" })];
    expect(totals(rows)).toEqual({ recurringMinor: 9800, oneTimeMinor: 15000 });
    expect(lineTotalMinor(row({ quantity: "3", amount: "2.50" }))).toBe(750);
  });

  it("validates description, quantity, amount and the line limit", () => {
    expect(validateRows([row({ description: "  " })])).toEqual({ error: "Line 1: enter a description of 1 to 120 characters." });
    expect(validateRows([row({}), row({ quantity: "1001" })])).toEqual({ error: "Line 2: the quantity is a whole number from 1 to 1000." });
    expect(validateRows([row({ quantity: "1.5" })])).toHaveProperty("error");
    expect(validateRows([row({ amount: "1000000.01" })])).toHaveProperty("error");
    expect(validateRows([row({ amount: "1000000" })])).toHaveProperty("items");
    expect(validateRows(Array.from({ length: 31 }, () => row({})))).toEqual({ error: "A contract can have at most 30 lines." });
    expect(validateRows([])).toEqual({ items: [] });
  });

  it("detects changes to editable rows only", () => {
    const rows = rowsFromView(VIEW);
    expect(isChanged(rows, VIEW)).toBe(false);
    expect(isChanged(rows.map((r) => (r.key === "i1" ? { ...r, amount: "49" } : r)), VIEW)).toBe(false);
    expect(isChanged(rows.map((r) => (r.key === "i1" ? { ...r, amount: "50" } : r)), VIEW)).toBe(true);
    expect(isChanged(rows.filter((r) => r.key !== "i2"), VIEW)).toBe(true);
  });

  it("builds the start-from-plan row", () => {
    expect(planRow("standard", "4900")).toMatchObject({ description: "Restiq Standard plan", quantity: "1", amount: "49.00", kind: "recurring", billedAt: null });
  });
});
