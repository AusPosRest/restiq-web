import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MenuImport } from "../../../menu-import";

// PE-11: inside the owner console shell (sidebar + header), like every other
// console page. ?from=setup is set by the go-live checklist's link, so the way
// back (and the success screen) returns there instead of to the menu.
export default async function AdminMenuImportPage({ searchParams }: Readonly<{ searchParams: Promise<{ from?: string }> }>) {
  const { from } = await searchParams;
  const fromSetup = from === "setup";
  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href={fromSetup ? "/admin/onboarding" : "/admin/menu"}
        data-testid="menu-import-back-link"
        className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> {fromSetup ? "Back to setup" : "Back to menu"}
      </Link>
      <MenuImport fromSetup={fromSetup} resume />
    </div>
  );
}
