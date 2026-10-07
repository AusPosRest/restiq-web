import { Suspense } from "react";
import { headers } from "next/headers";
import { sanitizePosNextPath } from "@/lib/pos-session";
import { fetchTenantByHost, hostOf } from "@/lib/tenant-by-host";
import { LiveClock } from "./live-clock";
import { PinPad } from "./pin-pad";

// P1 PIN Login - full-screen, outside the post-login (shell) shell. Left pane
// mirrors the design's brand/clock panel; the mocked Online/Printer status
// chips carry a "(demo)" tooltip per EXPERIENCE.md's no-fake-telemetry rule
// (this prototype has no real connectivity or printer signal behind them).
export default async function PosLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizePosNextPath(params.next);
  // D14: at a restaurant's own address the till names the restaurant.
  const tenant = await fetchTenantByHost(hostOf(await headers()));

  return (
    <main className="flex min-h-screen flex-1">
      <section className="hidden flex-1 flex-col justify-between p-12 lg:flex" aria-hidden="true">
        {/* The mocked Online / Printer Ready pills are gone: they showed "ready" with no printer set up. */}
        <span />

        <div>
          <p className="font-headline text-5xl font-bold tracking-tight text-primary">RESTIQ</p>
          {tenant ? (
            <p data-testid="pos-login-tenant" className="font-headline mt-2 text-2xl font-semibold">
              {tenant.displayName}
            </p>
          ) : null}
          <div className="mt-8">
            <LiveClock />
          </div>
        </div>

        <span />
      </section>

      <section className="flex flex-1 flex-col justify-center bg-card px-6 py-12 sm:px-16 lg:max-w-[36rem]">
        <div className="mx-auto w-full max-w-sm">
          {params.expired === "1" ? (
            <p
              role="status"
              data-testid="pos-login-expired-banner"
              className="mb-6 rounded-lg border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-center text-sm text-status-warning"
            >
              Session expired. Enter your PIN again to continue.
            </p>
          ) : null}
          {/* Suspense: PinPad reads useSearchParams (?device=&tenant=), which Next
              requires a boundary around even though this route is already forced
              dynamic by this page's own searchParams await - mirrors kds's page.tsx. */}
          <Suspense>
            <PinPad nextPath={nextPath} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
