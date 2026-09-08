import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MenuImport } from "../../menu-import";

// Rendered outside the owner shell (no sidebar), so it carries its own way
// back to the menu.
export default function AdminMenuImportPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-1 flex-col justify-center px-6 py-12">
      <Link
        href="/admin/menu"
        data-testid="menu-import-back-link"
        className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to menu
      </Link>
      <MenuImport />
    </main>
  );
}
