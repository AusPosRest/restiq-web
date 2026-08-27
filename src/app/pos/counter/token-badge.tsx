// TokenBadge (DESIGN.md: "large sequential number, QSR counter mode") - a
// large, high-contrast display of the counter order's token number, per
// SPEC CAP-6's success criterion ("issues a sequential token number") and
// the P7 mock's bottom-right token display. Pure presentational, same split
// as every other DESIGN.md-named leaf component (PosItemTile, TableShape).
export function TokenBadge({ tokenNumber }: Readonly<{ tokenNumber: number }>) {
  return (
    <div data-testid="token-badge" className="flex flex-col items-center gap-0.5 rounded-lg bg-primary px-4 py-2 text-primary-foreground">
      <p className="font-label text-[10px] font-semibold uppercase tracking-wider">Token</p>
      <p data-testid="token-badge-number" className="font-headline text-2xl font-bold tabular-nums">
        #{tokenNumber}
      </p>
    </div>
  );
}
