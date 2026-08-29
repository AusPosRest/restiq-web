// The qr_ordering-disabled state (SPEC Constraints, EXPERIENCE.md "The
// unavailable outlet") - a warm page naming the restaurant, never an error
// tone, never the menu. Reused (with a generic name) when the table itself
// can't be found or the API is unreachable, since both cases must fail the
// same way: no menu leak, no raw error screen.
export function UnavailableView({ outletName }: Readonly<{ outletName: string | null }>) {
  return (
    <main
      data-testid="qr-unavailable"
      className="flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-12 text-center"
    >
      <h1 className="font-headline text-xl font-semibold text-foreground">
        {outletName ?? "This restaurant"}
      </h1>
      <p className="mt-4 max-w-sm text-base text-muted-foreground">
        Ordering at the table isn&apos;t available right now - please order with our staff.
      </p>
    </main>
  );
}
