// Placeholder empty state for console destinations whose stories haven't
// landed yet (EXPERIENCE.md: true-empty pattern - icon, one line, no dead end).
// Mirrors /ops's coming-soon.tsx.
import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  title,
  description,
  icon: Icon,
  testId,
}: Readonly<{
  title: string;
  description: string;
  icon: LucideIcon;
  testId: string;
}>) {
  return (
    <section data-testid={testId} className="flex flex-1 flex-col">
      <h1 className="font-headline text-2xl font-semibold">{title}</h1>
      <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center">
        <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-headline mt-4 text-lg font-medium">Coming soon</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </section>
  );
}
