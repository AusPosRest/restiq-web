import { OutletProvider } from "./outlet-context";
import { OutletSwitcher } from "./outlet-switcher";
import { SidebarNav } from "./sidebar-nav";
import { ToastProvider } from "./toast";

// Owner console app shell (EXPERIENCE.md IA): fixed left sidebar + top bar,
// persistent across every post-go-live screen. T1/T2 (invite, checklist) and
// the placeholder login render outside this group.
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
