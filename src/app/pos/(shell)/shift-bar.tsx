"use client";

// Persistent shift-status/clock indicator (CAP-1) - the lightweight top bar
// this story's scope calls for; later stories add table map/order-taking nav
// alongside it. Staff/outlet display comes from the layout's server-side
// cookie read (see ../(shell)/layout.tsx) rather than a client fetch -
// restiq-backend's real contract has no session read-back endpoint, only
// login, select-outlet, and clock/out (see api.ts's file header).
//
// The real backend only supports clocking *out* - clock-in is automatic on
// login (once per local calendar day), not a client-toggled action - so
// unlike the login-time guess this mirrors, there is no Clock In state to
// render here: reaching this shell at all means the staff member is clocked
// in, and the only action is ending that shift.
//
// CAP-10 (shift & cash management, story 2) folds its "shift gates the main
// loop" affordance in here as a plain nav link to /pos/shift, not a live
// status fetch - this component's first test asserts zero client fetches on
// mount (server-cookie display only), so the actual open/float/closed state
// renders on /pos/shift itself (which already fetches it for its own
// dashboard) rather than duplicating that fetch here.
import { LogOut, Wallet, Wifi } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clockOut } from "../api";
import { LoadErrorPanel } from "./data-states";
import type { PosStaffDisplay } from "@/lib/pos-session";

async function signOut(): Promise<void> {
  await fetch("/pos/auth/logout", { method: "POST" }).catch(() => undefined);
}

export function ShiftBar({ initial }: Readonly<{ initial: PosStaffDisplay | null }>) {
  const router = useRouter();
  const [clockingOut, setClockingOut] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClockOut() {
    setClockingOut(true);
    setFailed(false);
    try {
      await clockOut();
      await signOut();
      router.replace("/pos/login");
    } catch {
      setFailed(true);
      setClockingOut(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/pos/login");
  }

  return (
    <header data-testid="pos-shift-bar" className="flex h-14 items-center justify-between gap-3 border-b border-border/40 bg-card px-6">
      <div className="flex items-center gap-4">
        <p className="font-headline text-sm font-bold tracking-tight text-primary">RESTIQ</p>
        <span
          data-testid="pos-status-online"
          title="Mocked - no real connectivity signal in this prototype (demo)"
          className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-status-available"
        >
          <Wifi className="size-3.5" aria-hidden="true" /> Online
        </span>
      </div>

      {failed ? (
        <LoadErrorPanel testId="pos-shift-bar-error" message="Couldn't clock out." onRetry={() => void handleClockOut()} />
      ) : initial ? (
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p data-testid="pos-shift-bar-staff-name" className="text-sm font-medium text-foreground">
              {initial.staff.name}
            </p>
            <p data-testid="pos-shift-bar-clock-status" className="text-xs text-muted-foreground">
              {initial.outlet.name}
            </p>
          </div>
          <Link
            href="/pos/shift"
            data-testid="pos-shift-bar-shift-link"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Wallet className="size-3.5" aria-hidden="true" /> Shift
          </Link>
          <button
            type="button"
            data-testid="pos-shift-bar-clock-out"
            disabled={clockingOut}
            onClick={() => void handleClockOut()}
            className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Clock Out
          </button>
          <button
            type="button"
            data-testid="pos-shift-bar-sign-out"
            onClick={() => void handleSignOut()}
            aria-label="Sign out"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="size-3.5" aria-hidden="true" /> Sign out
          </button>
        </div>
      ) : (
        // Shouldn't happen - the proxy only lets a request in here with a
        // valid pos_session, and the login/select-outlet routes always set
        // pos_staff alongside it. Falls back to just Sign out rather than
        // a dead end if the display cookie is ever missing anyway.
        <button
          type="button"
          data-testid="pos-shift-bar-sign-out"
          onClick={() => void handleSignOut()}
          aria-label="Sign out"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="size-3.5" aria-hidden="true" /> Sign out
        </button>
      )}
    </header>
  );
}
