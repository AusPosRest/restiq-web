"use client";

// restiq-web#449 service mode: a platform operator inside this owner console. One GET
// admin/v1/tenant per page load, shared here, tells every signed-in page who is in and until when.
// Mounted only by the signed-in layouts (shell, setup checklist) - never the public login, invite
// or reset pages, where the call would just 401.
import { Lock, LogOut, Wrench } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { useAdminLoad } from "./(shell)/use-admin-load";

export interface ServiceInfo {
  operatorEmail: string;
  expiresAt: string;
}

export interface AdminTenantSummary {
  name: string;
  testMode: boolean;
  /** Missing on an older API - treated as null. */
  service?: ServiceInfo | null;
}

const TenantContext = createContext<AdminTenantSummary | null>(null);

export function AdminTenantProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { data } = useAdminLoad<AdminTenantSummary>("tenant");
  return <TenantContext.Provider value={data}>{children}</TenantContext.Provider>;
}

/** null until loaded, and outside a provider. */
export function useAdminTenant(): AdminTenantSummary | null {
  return useContext(TenantContext);
}

export function useServiceMode(): ServiceInfo | null {
  return useContext(TenantContext)?.service ?? null;
}

export function minutesLeft(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60_000));
}

export function ServiceModeBar() {
  const tenant = useAdminTenant();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const service = tenant?.service;
  if (!tenant || !service) return null;
  return (
    <div
      role="status"
      data-testid="service-mode-banner"
      // From md up it is one pinned 40px line (the shell's sticky sidebar starts below it); on a phone it wraps and scrolls.
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-primary px-4 py-2 text-sm text-primary-foreground sm:px-6 md:sticky md:top-0 md:z-30 md:h-10 md:flex-nowrap md:py-0 print:hidden"
    >
      <p className="flex min-w-0 items-start gap-2 md:items-center">
        <Wrench className="mt-0.5 size-4 shrink-0 md:mt-0" aria-hidden="true" />
        <span className="min-w-0 break-words md:truncate">
          <strong>Service mode.</strong> You are inside {tenant.name} as <span className="break-all">{service.operatorEmail}</span>. Changes are recorded under your name.
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <span data-testid="service-mode-remaining" className="whitespace-nowrap tabular-nums">
          Ends in {minutesLeft(service.expiresAt, now)} min
        </span>
        <form action="/admin/auth/logout" method="post">
          <button
            type="submit"
            data-testid="service-mode-exit"
            className="whitespace-nowrap rounded-md bg-primary-foreground px-3 py-1 text-xs font-semibold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            Exit service mode
          </button>
        </form>
      </div>
    </div>
  );
}

/** The sidebar / mobile-drawer sign-out; in service mode it leaves service mode instead. */
export function SignOutButton() {
  const service = useServiceMode();
  return (
    <form action="/admin/auth/logout" method="post" className="mt-auto border-t border-border/40 p-3">
      <button
        type="submit"
        data-testid="admin-sign-out"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut className="size-4" aria-hidden="true" />
        {service ? "Exit service mode" : "Sign out"}
      </button>
    </form>
  );
}

/** Amber note in place of an action only the owner may take (signing, ordering readers). */
export function OwnerOnlyNote({ testId, title, children }: Readonly<{ testId: string; title: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm" data-testid={testId}>
      <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
