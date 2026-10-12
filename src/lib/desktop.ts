// The Windows POS app (AusPosRest/restiq-desktop) exposes `window.restiqDesktop`
// on the RESTIQ origin. In a normal browser it's absent and nothing changes.
interface RestiqDesktop {
  print(): Promise<void>;
  openDrawer(): Promise<void>;
}

function desktop(): RestiqDesktop | undefined {
  return typeof window === "undefined" ? undefined : (window as Window & { restiqDesktop?: RestiqDesktop }).restiqDesktop;
}

/** Silent print on the device's receipt printer inside the app, the browser's print dialog elsewhere. */
export function printPage(): Promise<void> {
  const app = desktop();
  if (app) return app.print();
  window.print();
  return Promise.resolve();
}

/** Opens the cash drawer after a bill with a cash tender is finalised (app only). */
export function openDrawerForTenders(tenders: ReadonlyArray<{ method: string }>): void {
  if (!tenders.some((tender) => tender.method === "cash")) return;
  // ponytail: the bill is already final, so a drawer failure is only logged - the cashier sees the drawer stay shut.
  desktop()
    ?.openDrawer()
    .catch((error: unknown) => console.warn("Cash drawer didn't open", error));
}
