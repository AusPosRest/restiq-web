"use client";

// Counts down, then replaces this page with href (Back shouldn't land here again).
// "Go now" skips the wait.
import { useEffect, useState } from "react";

export function RedirectCountdown({ href, seconds }: Readonly<{ href: string; seconds: number }>) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) {
      window.location.replace(href);
      return;
    }
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, href]);

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite" data-testid="stripe-done-countdown">
        {left > 0 ? `Taking you back in ${left}…` : "Taking you back…"}
      </p>
      <a
        href={href}
        data-testid="stripe-done-go"
        className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Go now
      </a>
    </div>
  );
}
