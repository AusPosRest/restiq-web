import { fetchTableStatus } from "./table-status";
import { UnavailableView } from "./unavailable-view";
import { WelcomeFlow } from "./welcome-flow";

// The table-QR entry URL (SPEC Assumptions: "a documented per-table URL
// pattern suffices for the demo") - CAP-1's Q1 Welcome / Q2 Session PIN.
// Server component so the qr_ordering capability gate and session-open
// status are resolved before any guest-facing UI renders, never leaking the
// menu when ordering is disabled (SPEC success signal).
export default async function GuestTableEntryPage({
  params,
}: {
  params: Promise<{ outletId: string; tableId: string }>;
}) {
  const { outletId, tableId } = await params;
  const result = await fetchTableStatus(outletId, tableId);

  if (result.kind === "not_found" || result.kind === "unreachable") {
    return <UnavailableView outletName={null} />;
  }
  if (!result.status.qrOrderingEnabled) {
    return <UnavailableView outletName={result.status.outlet.name} />;
  }

  return (
    <WelcomeFlow
      outletId={outletId}
      tableId={tableId}
      outletName={result.status.outlet.name}
      tableLabel={result.status.table.label}
      sessionOpen={result.status.sessionOpen}
    />
  );
}
