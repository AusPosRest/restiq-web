import { LogOut } from "lucide-react";
import { OutletProvider } from "./outlet-context";
import { OutletSwitcher } from "./outlet-switcher";
import { SidebarNav } from "./sidebar-nav";
import { ToastProvider } from "./toast";

// Owner console app shell (EXPERIENCE.md IA): fixed left sidebar + top bar,
// persistent across every post-go-live screen. T1/T2 (invite, checklist) and
// the login page render outside this group.
export default function AdminShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <OutletProvider>
      <div className="flex min-h-screen flex-1">
        <aside className="flex w-60 shrink-0 flex-col border-r border-border/40 bg-card">
          <div className="px-6 py-6">
            <p className="font-headline text-2xl font-bold tracking-tight text-primary">RESTIQ</p>
            <p className="font-label mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owner Console</p>
          </div>
          <SidebarNav />
          <form action="/admin/auth/logout" method="post" className="mt-auto border-t border-border/40 p-3">
            <button
              type="submit"
              data-testid="admin-sign-out"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <ToastProvider>
            <header className="flex h-14 items-center justify-end gap-3 border-b border-border/40 bg-card px-6">
              <OutletSwitcher />
            </header>
            <main className="flex-1 p-8">{children}</main>
          </ToastProvider>
        </div>
      </div>
    </OutletProvider>
  );
}
