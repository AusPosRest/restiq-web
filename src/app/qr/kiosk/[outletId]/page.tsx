import { Suspense } from "react";
import { KioskStart } from "./kiosk-start";

// The kiosk attract screen (issue #214): public (decideGuestRoute), reached
// from an enrolled kiosk tab's "Continue" and from the landing page. The
// device id rides in ?device= so a fresh tab still knows which kiosk it is.
export default async function KioskPage({ params }: Readonly<{ params: Promise<{ outletId: string }> }>) {
  const { outletId } = await params;
  return (
    <Suspense>
      <KioskStart outletId={outletId} />
    </Suspense>
  );
}
