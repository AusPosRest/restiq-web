import { Wifi } from "lucide-react";
import { sanitizePosNextPath } from "@/lib/pos-session";
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

  return (
    <main className="flex min-h-screen flex-1">
      <section className="hidden flex-1 flex-col justify-between p-12 lg:flex" aria-hidden="true">
        <div className="flex gap-2">
          <span
            data-testid="pos-status-online"
            title="Mocked - no real connectivity signal in this prototype (demo)"
            className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-status-available"
          >
            <Wifi className="size-3.5" aria-hidden="true" /> Online
          </span>
          <span
            data-testid="pos-status-printer"
            title="Mocked - no real printer integration in this prototype (demo)"
            className="rounded-full bg-card px-3 py-1 text-xs font-medium text-status-available"
          >
            Printer Ready
          </span>
        </div>

        <div>
          <p className="font-headline text-5xl font-bold tracking-tight text-primary">RESTIQ</p>
          <div className="mt-8">
            <LiveClock />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">App Version v2.4.1</p>
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
          <PinPad nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}
