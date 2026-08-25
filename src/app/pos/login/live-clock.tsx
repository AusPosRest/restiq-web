"use client";

// Left-panel clock on P1's brand pane (design screenshot: "02:34" / "Tuesday,
// Oct 24, 2023"). A device-local clock, not backend telemetry - there is
// nothing to fetch here since no session exists yet at the login screen.
import { useEffect, useState } from "react";

export function formatClock(now: Date): { time: string; date: string } {
  return {
    time: now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    date: now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" }),
  };
}

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    // The first tick is deferred (not called synchronously in the effect
    // body - react-hooks/set-state-in-effect) rather than skipped, so the
    // clock still paints within a tick of mount instead of waiting a full
    // second for the interval's first fire.
    const timeout = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  // Rendered only after mount - server-rendered and client-rendered wall-clock
  // time would otherwise mismatch (hydration warning) for no benefit here.
  if (!now) return null;

  const { time, date } = formatClock(now);
  return (
    <div data-testid="pos-login-clock">
      <p className="font-headline text-4xl font-bold tabular-nums text-foreground">{time}</p>
      <p className="mt-1 text-sm text-muted-foreground">{date}</p>
    </div>
  );
}
