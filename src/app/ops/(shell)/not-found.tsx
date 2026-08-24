// Ops-scoped not-found: unknown /ops paths stay inside the console shell
// instead of falling through to the app's bare 404.
import { SearchX } from "lucide-react";
import Link from "next/link";

export default function OpsNotFound() {
  return (
    <section data-testid="ops-not-found" className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
      <h1 className="font-headline mt-4 text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">This console page does not exist.</p>
      <Link
        href="/ops"
        data-testid="ops-not-found-home"
        className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Back to Dashboard
      </Link>
    </section>
  );
}
