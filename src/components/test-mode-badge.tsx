// restiq-web#346: marks a tenant in Test mode (payments and emails simulated) on every surface - the ops
// console, the owner console, the POS and the KDS. Fixed amber so it reads the same on every theme.
export function TestModeBadge({ testId }: Readonly<{ testId?: string }>) {
  return (
    <span
      data-testid={testId}
      title="Test mode: payments and emails are simulated"
      className="inline-flex shrink-0 items-center rounded-[6px] border border-amber-500 bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-900"
    >
      Test
    </span>
  );
}
