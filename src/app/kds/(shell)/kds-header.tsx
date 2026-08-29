"use client";

// The shared "quiet header" every KDS mode renders (EXPERIENCE.md:
// "the choice persists per browser... changeable from a quiet header
// control", "four sibling modes, one header switcher" - no deep hierarchy,
// a KDS is a single-purpose appliance). Not a Next.js layout: a shared
// layout above `station/[stationId]` never receives that dynamic segment's
// params, so each page renders this directly with whatever station name it
// already has in scope - simpler than threading a name through app-router
// layout params. Established here for story 2 (issue #66); stories 3-5
// (Expo/Bumped/All-Day) render the same header with their own `activeMode`.
//
// No copy beyond single words/labels (EXPERIENCE.md Voice and Tone -
// "near-silent... no sentences on screen during service"). Every control is
// >=56px (DESIGN.md's touch-target floor) and this component is the one
// place all four modes' nav lives, so a re-skin or added mode is an edit
// here, not per-page.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export type KdsMode = "station" | "expo" | "bumped" | "all-day";

const NAV: { mode: KdsMode; label: string; href: string }[] = [
  { mode: "station", label: "Station", href: "/kds" },
  { mode: "expo", label: "Expo", href: "/kds/expo" },
  { mode: "bumped", label: "Bumped", href: "/kds/bumped" },
  { mode: "all-day", label: "All-Day", href: "/kds/all-day" },
];

export function KdsHeader({ activeMode, stationName }: Readonly<{ activeMode: KdsMode; stationName?: string }>) {
  const router = useRouter();

  async function signOut(): Promise<void> {
    await fetch("/pos/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/pos/login");
  }

  return (
    <header data-testid="kds-header" className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-card px-4 py-2">
      <div className="flex items-center gap-3">
        <p data-testid="kds-header-title" className="font-headline text-lg font-bold tracking-tight text-foreground uppercase">
          {stationName ?? "Kitchen Display"}
        </p>
        {activeMode === "station" && (
          <Link
            href="/kds?reselect=1"
            data-testid="kds-change-station"
            className="flex min-h-11 items-center rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Change station
          </Link>
        )}
      </div>

      <nav className="flex items-center gap-2">
        {NAV.map((item) => (
          <Link
            key={item.mode}
            href={item.href}
            data-testid={`kds-nav-${item.mode}`}
            aria-current={activeMode === item.mode ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold transition-colors ${
              activeMode === item.mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          data-testid="kds-sign-out"
          onClick={() => void signOut()}
          aria-label="Sign out"
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </nav>
    </header>
  );
}
