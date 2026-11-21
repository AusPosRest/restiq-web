import { MobileNav } from "@/components/mobile-nav";
import { TenantTestBadge } from "@/components/tenant-test-badge";
import { AdminTenantProvider, ServiceModeBar, SignOutButton } from "../service-mode";
import { AgreementBanner } from "./agreement-banner";
import { OutletProvider } from "./outlet-context";
import { OutletSwitcher } from "./outlet-switcher";
import { SidebarNav } from "./sidebar-nav";
import { ToastProvider } from "./toast";

// Owner console app shell (EXPERIENCE.md IA): fixed left sidebar + top bar,
// persistent across every post-go-live screen. T1/T2 (invite, checklist) and
// the login page render outside this group. Below md (issue #228) the sidebar
// hides and the top bar's MobileNav drawer carries the same nav + sign-out.
// restiq-web#449: the service-mode bar spans the top, above sidebar and top bar.
export default function AdminShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const signOut = <SignOutButton />;

  return (
    <OutletProvider>
      <AdminTenantProvider>
        <div className="group flex min-h-screen flex-1 flex-col">
          <ServiceModeBar />
          <div className="flex flex-1">
            {/* With the 40px service-mode bar pinned above, the sidebar sticks and ends below it. */}
            <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-border/40 bg-card group-has-[[data-testid=service-mode-banner]]:top-10 group-has-[[data-testid=service-mode-banner]]:h-[calc(100vh-2.5rem)] md:flex print:hidden">
              <div className="px-6 py-6">
                <p className="font-headline text-2xl font-bold tracking-tight text-primary">RESTIQ</p>
                <p className="font-label mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owner Console</p>
              </div>
              <SidebarNav />
              {signOut}
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <ToastProvider>
                <header className="flex h-14 items-center justify-between gap-3 border-b border-border/40 bg-card px-4 sm:px-6 md:justify-end print:hidden">
                  <MobileNav title="RESTIQ" subtitle="Owner Console" themeClass="admin-theme">
                    <SidebarNav />
                    {signOut}
                  </MobileNav>
                  <div className="flex items-center gap-3">
                    <TenantTestBadge endpoint="/admin/api/tenant" testId="admin-test-badge" />
                    <OutletSwitcher />
                  </div>
                </header>
                <AgreementBanner />
                <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
              </ToastProvider>
            </div>
          </div>
        </div>
      </AdminTenantProvider>
    </OutletProvider>
  );
}
