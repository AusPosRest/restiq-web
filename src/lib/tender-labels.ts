// Plain names for tender methods on owner screens (PE-23) - never the raw
// wire keys ("upi_manual", "card_terminal").
const LABELS: Record<string, string> = {
  cash: "Cash",
  upi_manual: "UPI",
  upi_intent: "UPI app",
  upi_qr: "UPI QR",
  card_online: "Card (online)",
  card_terminal: "Card terminal",
  external: "Other",
};

export function tenderMethodLabel(method: string): string {
  return LABELS[method] ?? method.replaceAll("_", " ");
}
