import { SidebarNav } from "./sidebar-nav";
import { SignOutButton } from "./sign-out-button";
import { TenantSearch } from "./tenant-search";
import { ToastProvider } from "./toast";

// Console Dark app shell (AD-4): fixed left sidebar + top bar, persistent
// across every post-auth screen. O1 login renders outside this group.
export default function OpsShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border/40 bg-card">
        <div className="px-6 py-6">
          <p className="font-headline text-2xl font-bold tracking-tight text-primary">RESTIQ</p>
          <p className="font-label mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Platform Console
          </p>
        </div>
        <SidebarNav />
        <div className="mt-auto border-t border-border/40 p-3">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <ToastProvider>
          <header className="flex h-14 items-center justify-between gap-3 border-b border-border/40 bg-card px-6">
            <TenantSearch />
            <span className="font-label inline-flex items-center gap-2 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="size-1.5 rounded-full bg-status-healthy" aria-hidden="true" />
              {process.env.NEXT_PUBLIC_ENV_LABEL ?? "Development"}
            </span>
          </header>
          <main className="flex-1 p-8">{children}</main>
        </ToastProvider>
      </div>
    </div>
  );
}
