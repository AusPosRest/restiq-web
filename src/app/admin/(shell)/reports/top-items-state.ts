// Contract: GET /admin/v1/reports/top-items (restiq-backend#288) - same
// outletId/from/to filter as payments, finalized bills only, already sorted
// quantity desc then sales desc. salesMinor is quantity x (unit price +
// modifiers): before the bill-level discount and before refunds.
export interface TopItemRow {
  id: string;
  variantId: string | null;
  name: string;
  portionName: string | null;
  quantity: number;
  salesMinor: number;
}

export interface TopItemsResponse {
  currency: string;
  items: TopItemRow[];
}

/** "Biryani (Half)" - the same item+portion naming the invoice uses. */
export function topItemLabel(row: Pick<TopItemRow, "name" | "portionName">): string {
  return row.portionName ? `${row.name} (${row.portionName})` : row.name;
}
