// Inert placeholder for the KDS modes this story establishes the shell/nav
// for but doesn't build (Expo/Bumped/All-Day - CAP-3/4/5, later sibling
// stories). Mirrors /pos's (shell)/coming-soon.tsx pattern - a real screen
// under the real header/nav, not a dead link or a disabled button.
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
    <section data-testid={testId} className="flex flex-1 flex-col p-8">
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/50 px-8 py-16 text-center">
        <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-headline mt-4 text-lg font-medium text-foreground">{title} - coming soon</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </section>
  );
}
