// The qr_ordering-disabled state (SPEC Constraints, EXPERIENCE.md "The
// unavailable outlet") - a warm page, never an error tone, never the menu.
// Reused when the outlet/table can't be found or the API is unreachable,
// since all three cases must fail the same way: no menu leak, no raw error
// screen. The real availability endpoint (GET /guest/v1/outlets/:id/
// availability) returns only `{ available, reason }` - no outlet display
// name - so unlike the pre-reconciliation guess, this never had a name to
// show in the first place.
// CU-21: a table staff already have an order on gets its own line - the diner
// learns it here, not after filling a cart.
export function UnavailableView({ tableBusy = false }: Readonly<{ tableBusy?: boolean }>) {
  if (tableBusy) {
    return (
      <main data-testid="qr-table-busy" className="flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="font-headline text-xl font-semibold text-foreground">This table already has an order</h1>
        <p className="mt-4 max-w-sm text-base text-muted-foreground">Our staff are looking after this table - please ask your server to add anything you&apos;d like.</p>
      </main>
    );
  }
  return (
    <main
      data-testid="qr-unavailable"
      className="flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-12 text-center"
    >
      <h1 className="font-headline text-xl font-semibold text-foreground">This restaurant</h1>
      <p className="mt-4 max-w-sm text-base text-muted-foreground">
        Ordering at the table isn&apos;t available right now - please order with our staff.
      </p>
    </main>
  );
}
