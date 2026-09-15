import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav } from "./sidebar-nav";
import { SignOutButton } from "./sign-out-button";
import { TenantSearch } from "./tenant-search";
import { ToastProvider } from "./toast";

// Console Dark app shell (AD-4): fixed left sidebar + top bar, persistent
// across every post-auth screen. O1 login renders outside this group. Below md
// (issue #228) the sidebar hides and the top bar's MobileNav drawer carries
// the same nav + sign-out.
export default function OpsShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const signOut = (
    <div className="mt-auto border-t border-border/40 p-3">
      <SignOutButton />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border/40 bg-card md:flex">
        <div className="px-6 py-6">
          <p className="font-headline text-2xl font-bold tracking-tight text-primary">RESTIQ</p>
          <p className="font-label mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Platform Console
          </p>
        </div>
        <SidebarNav />
        {signOut}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <ToastProvider>
          <header className="flex h-14 items-center justify-between gap-3 border-b border-border/40 bg-card px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <MobileNav title="RESTIQ" subtitle="Platform Console" themeClass="ops-theme">
                <SidebarNav />
                {signOut}
              </MobileNav>
              <TenantSearch />
            </div>
            <span className="font-label hidden items-center gap-2 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:inline-flex">
              <span className="size-1.5 rounded-full bg-status-healthy" aria-hidden="true" />
              {process.env.NEXT_PUBLIC_ENV_LABEL ?? "Development"}
            </span>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </ToastProvider>
      </div>
    </div>
  );
}
