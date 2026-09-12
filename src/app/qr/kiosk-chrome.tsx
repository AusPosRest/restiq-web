"use client";

// Kiosk frame + chrome (issue #214).
//
// KioskFrame draws the physical self-service kiosk around every guest screen
// on an enrolled kiosk tab - white bezel with a camera, a portrait screen,
// the receipt printer / card reader / scanner panel under it, then the neck
// and floor plate - so the tab reads as a standing kiosk, not a web page. The
// screen carries a transform, which makes it the containing block for the
// guest screens' `position: fixed` bars (Add to Cart, cart pill, checkout
// sheet), so they pin to the glass instead of the browser window; their
// `min-h-screen` is capped to the glass height. The element tree is the same
// on every tab (non-kiosk tabs get `display: contents`), so hydration and a
// non-kiosk guest never remount the page.
//
// KioskChrome: renders nothing unless this tab is an enrolled
// kiosk. On every guest screen except the attract screen it shows a slim
// "Start over" bar and resets the kiosk after IDLE_MS with no touch, key or
// scroll - the next guest never inherits a stranger's cart. A kiosk tab that
// lands on bare /qr (an expired session's redirect) is sent straight back to
// its attract screen instead of the "scan your table" copy.
import { Nfc, Printer, ScanBarcode } from "lucide-react";
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

const FRAME = {
  floor: "flex min-h-screen flex-1 items-start justify-center bg-gradient-to-b from-zinc-200 via-zinc-300 to-zinc-500 px-4 py-6",
  unit: "flex flex-col items-center",
  body: "flex flex-col items-center rounded-[2.25rem] bg-gradient-to-b from-white via-zinc-50 to-zinc-200 px-3 pb-4 pt-2 shadow-2xl ring-1 ring-black/15",
  glass:
    "relative flex aspect-[9/16] h-[min(82vh,56rem)] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-[1.25rem] bg-background ring-[6px] ring-zinc-900 [transform:translateZ(0)]",
  scroll: "flex min-h-0 flex-1 flex-col overflow-y-auto [&_.min-h-screen]:min-h-full",
} as const;

function pick(kiosk: boolean, classes: string): string {
  return kiosk ? classes : "contents";
}

export function KioskFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  const kiosk = useSyncExternalStore(subscribeNoop, isKioskTab, () => false);
  return (
    <div data-testid={kiosk ? "kiosk-device" : undefined} className={pick(kiosk, FRAME.floor)}>
      <div className={pick(kiosk, FRAME.unit)}>
        <div className={pick(kiosk, FRAME.body)}>
          {kiosk && <span aria-hidden="true" className="mb-2 h-2 w-16 rounded-full bg-zinc-800/80 shadow-inner" />}
          <div data-testid={kiosk ? "kiosk-screen" : undefined} className={pick(kiosk, FRAME.glass)}>
            <KioskChrome />
            <div className={pick(kiosk, FRAME.scroll)}>{children}</div>
          </div>
          {kiosk && <KioskHardware />}
        </div>
        {kiosk && (
          <>
            <span aria-hidden="true" className="h-28 w-40 bg-gradient-to-r from-zinc-300 via-white to-zinc-300 shadow-inner" />
            <span aria-hidden="true" className="h-4 w-80 max-w-[80vw] rounded-t-md rounded-b-[50%] bg-gradient-to-b from-zinc-100 to-zinc-400 shadow-xl" />
          </>
        )}
      </div>
    </div>
  );
}

// The panel under the screen, like a real kiosk: receipt printer slot, card
// reader and barcode scanner. Decorative - payment happens at the counter.
function KioskHardware() {
  return (
    <div data-testid="kiosk-hardware" aria-hidden="true" className="mt-4 flex w-full items-center justify-center gap-4 px-6">
      <span className="flex flex-col items-center gap-1">
        <span className="flex h-9 w-24 items-center justify-center rounded-md bg-zinc-900 shadow-inner">
          <span className="h-1 w-16 rounded-full bg-zinc-600" />
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          <Printer className="size-3" /> Receipt
        </span>
      </span>
      <span className="flex flex-col items-center gap-1">
        <span className="flex size-9 items-center justify-center rounded-md bg-zinc-800 text-zinc-300 shadow-inner">
          <Nfc className="size-5" />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Card</span>
      </span>
      <span className="flex flex-col items-center gap-1">
        <span className="flex size-9 items-center justify-center rounded-md bg-zinc-800 text-zinc-300 shadow-inner">
          <ScanBarcode className="size-5" />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Scan</span>
      </span>
    </div>
  );
}
