// Subscription tab > Billing contract (restiq-web#433): editable line items <-> the PUT body.
// Amounts are per billing period, typed in major units; billed one-time rows are read-only
// and never sent (the backend keeps them).
import type { ContractItemInput, ContractView } from "../../api";

export const MAX_ITEMS = 30;
const MAX_UNIT_MINOR = 100_000_000;
const AMOUNT = /^\d+(\.\d{1,2})?$/;

export interface ContractRow {
  key: string;
  description: string;
  quantity: string;
  /** Major units as typed. */
  amount: string;
  kind: ContractItemInput["kind"];
  /** Set on a billed one-time row: read-only. */
  billedAt: string | null;
}

let nextKey = 0;
function newKey(): string {
  nextKey += 1;
  return `new-${nextKey}`;
}

export function emptyRow(): ContractRow {
  return { key: newKey(), description: "", quantity: "1", amount: "", kind: "recurring", billedAt: null };
}

export function planRow(plan: string, planAmountMinor: string): ContractRow {
  const name = plan.charAt(0).toUpperCase() + plan.slice(1);
  return { ...emptyRow(), description: `Restiq ${name} plan`, amount: (Number(planAmountMinor) / 100).toFixed(2) };
}

export function rowsFromView(view: ContractView): ContractRow[] {
  return view.items.map((item) => ({
    key: item.id,
    description: item.description,
    quantity: String(item.quantity),
    amount: (Number(item.unitAmountMinor) / 100).toFixed(2),
    kind: item.kind,
    billedAt: item.billedAt,
  }));
}

/** Null when the text isn't a 0+ amount with at most two decimals. */
export function amountMinor(amount: string): number | null {
  const trimmed = amount.trim();
  return AMOUNT.test(trimmed) ? Math.round(Number(trimmed) * 100) : null;
}

/** qty x unit, or null while either is invalid. */
export function lineTotalMinor(row: ContractRow): number | null {
  const unit = amountMinor(row.amount);
  const quantity = Number(row.quantity);
  return unit === null || !Number.isInteger(quantity) || quantity < 1 ? null : unit * quantity;
}

export function totals(rows: readonly ContractRow[]): { recurringMinor: number; oneTimeMinor: number } {
  let recurringMinor = 0;
  let oneTimeMinor = 0;
  for (const row of rows) {
    if (row.billedAt) continue;
    const total = lineTotalMinor(row) ?? 0;
    if (row.kind === "recurring") recurringMinor += total;
    else oneTimeMinor += total;
  }
  return { recurringMinor, oneTimeMinor };
}

export function validateRows(rows: readonly ContractRow[]): { items: ContractItemInput[] } | { error: string } {
  const editable = rows.filter((row) => !row.billedAt);
  if (editable.length > MAX_ITEMS) return { error: `A contract can have at most ${MAX_ITEMS} lines.` };
  const items: ContractItemInput[] = [];
  for (const [index, row] of editable.entries()) {
    const line = `Line ${index + 1}`;
    const description = row.description.trim();
    if (!description || description.length > 120) return { error: `${line}: enter a description of 1 to 120 characters.` };
    const quantity = Number(row.quantity.trim());
    if (!/^\d+$/.test(row.quantity.trim()) || quantity < 1 || quantity > 1000) return { error: `${line}: the quantity is a whole number from 1 to 1000.` };
    const unitAmountMinor = amountMinor(row.amount);
    if (unitAmountMinor === null || unitAmountMinor > MAX_UNIT_MINOR) return { error: `${line}: enter an amount from 0 to 1,000,000 with at most 2 decimals.` };
    items.push({ description, quantity, unitAmountMinor, kind: row.kind });
  }
  return { items };
}

function signature(rows: readonly ContractRow[]): string {
  return JSON.stringify(rows.filter((row) => !row.billedAt).map((row) => [row.description.trim(), row.quantity.trim(), amountMinor(row.amount), row.kind]));
}

/** True when the editable rows differ from what the server holds. */
export function isChanged(rows: readonly ContractRow[], view: ContractView): boolean {
  return signature(rows) !== signature(rowsFromView(view));
}
