// Pure helper for the per-table self-order QR (issue #131). Kept free of
// React/qrcode so the URL-building logic is unit-testable without mocking
// the qrcode package - mirrors floor-plan-state.ts's split between logic
// and UI. Must match the guest entry route exactly:
// src/app/qr/t/[outletId]/[tableId]/page.tsx.

export function guestOrderUrl(origin: string, outletId: string, tableId: string): string {
  return `${origin}/qr/t/${outletId}/${tableId}`;
}
