import { checkAvailability } from "./availability";
import { UnavailableView } from "./unavailable-view";
import { WelcomeFlow } from "./welcome-flow";
import { fetchTableWelcome } from "./welcome";

// The table-QR entry URL (SPEC Assumptions: "a documented per-table URL
// pattern suffices for the demo") - CAP-1's Q1 Welcome / Q2 Session PIN.
// Server component so the qr_ordering capability gate is resolved before any
// guest-facing UI renders, never leaking the menu when ordering is disabled
// (SPEC success signal). The real backend has no per-table session-status
// lookup (see availability.ts) - whether a session is already open for this
// table is discovered reactively by WelcomeFlow itself, not here.
export default async function GuestTableEntryPage({
  params,
}: {
  params: Promise<{ outletId: string; tableId: string }>;
}) {
  const { outletId, tableId } = await params;
  const result = await checkAvailability(outletId, tableId);

  if (result.kind !== "available") {
    return <UnavailableView tableBusy={result.kind === "unavailable" && result.reason === "table_busy"} />;
  }

  return <WelcomeFlow outletId={outletId} tableId={tableId} welcome={await fetchTableWelcome(outletId, tableId)} />;
}
