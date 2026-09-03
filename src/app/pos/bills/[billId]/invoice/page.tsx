import { BillInvoiceView } from "./bill-invoice-view";

export default async function PosBillInvoicePage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  return <BillInvoiceView billId={billId} />;
}
