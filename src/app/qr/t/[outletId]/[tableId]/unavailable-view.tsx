// The qr_ordering-disabled state (SPEC Constraints, EXPERIENCE.md "The
// unavailable outlet") - a warm page, never an error tone, never the menu.
// Reused when the outlet/table can't be found or the API is unreachable,
// since all three cases must fail the same way: no menu leak, no raw error
// screen. The real availability endpoint (GET /guest/v1/outlets/:id/
// availability) returns only `{ available, reason }` - no outlet display
// name - so unlike the pre-reconciliation guess, this never had a name to
// show in the first place.
export function UnavailableView() {
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
