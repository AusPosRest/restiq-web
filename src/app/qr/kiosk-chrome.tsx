"use client";

// Kiosk chrome (issue #214): renders nothing unless this tab is an enrolled
// kiosk. On every guest screen except the attract screen it shows a slim
// "Start over" bar and resets the kiosk after IDLE_MS with no touch, key or
// scroll - the next guest never inherits a stranger's cart. A kiosk tab that
// lands on bare /qr (an expired session's redirect) is sent straight back to
// its attract screen instead of the "scan your table" copy.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { endKioskSession, isKioskTab, kioskHomePath } from "./kiosk-session";

// ponytail: fixed 90 s; make it an outlet setting if a tenant asks.
export const IDLE_MS = 90_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

function subscribeNoop(): () => void {
  return () => undefined;
}

export function KioskChrome() {
  const pathname = usePathname();
  const router = useRouter();
  // sessionStorage is client-only: the server snapshot is "not a kiosk" and
  // the client re-renders with the tab's real enrolment after hydration.
  const kiosk = useSyncExternalStore(subscribeNoop, isKioskTab, () => false);

  const onAttract = pathname.startsWith("/qr/kiosk/");
  const active = kiosk && !onAttract;

  useEffect(() => {
    if (!kiosk || pathname !== "/qr") return;
    const home = kioskHomePath();
    if (home) router.replace(home);
  }, [kiosk, pathname, router]);

  useEffect(() => {
    if (!active) return;
    let timer = setTimeout(reset, IDLE_MS);
    function bump() {
      clearTimeout(timer);
      timer = setTimeout(reset, IDLE_MS);
    }
    function reset() {
      void endKioskSession().then((home) => router.replace(home));
    }
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, bump, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, bump);
    };
  }, [active, router]);

  if (!active) return null;
  return (
    <div data-testid="kiosk-chrome" className="flex items-center justify-between border-b border-border bg-card px-4 py-2 text-xs text-muted-foreground">
      <span>Self-service kiosk</span>
      <button
        type="button"
        data-testid="kiosk-start-over"
        onClick={() => void endKioskSession().then((home) => router.replace(home))}
        className="rounded-lg border border-border px-3 py-1.5 font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Start over
      </button>
    </div>
  );
}
