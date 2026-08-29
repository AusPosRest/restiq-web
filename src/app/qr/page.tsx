// Bare /qr has no table context - it's only reached via an expired-session
// redirect (decideGuestRoute) or a mistyped URL, never how a real guest
// arrives (they always land on /qr/t/[outletId]/[tableId] from the table's
// printed QR code). Warm, not an error page - mirrors the unavailable
// screen's tone.
export default function GuestEntryPage() {
  return (
    <main data-testid="qr-no-table" className="flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="font-headline text-xl font-semibold text-foreground">Scan your table&apos;s QR code</h1>
      <p className="mt-4 max-w-sm text-base text-muted-foreground">
        Look for the QR code on your table to start ordering - this link on its own doesn&apos;t know which table you&apos;re at.
      </p>
    </main>
  );
}
