"use client";

// Kiosk attract screen (issue #214): one big "Tap to start" that starts a
// device-bound guest session (POST /qr/auth/kiosk -> restiq-backend#138) and
// lands on the existing /qr/menu. Kiosk mode off (403 kiosk_disabled) or a
// device that is not an active kiosk here (404) shows the backend's own
// message and a retry - never the menu.
import { UtensilsCrossed } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { readStoredDevice } from "../../../device/device-state";

const MENU_ROUTE = "/qr/menu";

type StartState = { kind: "idle" } | { kind: "starting" } | { kind: "error"; message: string };

export function KioskStart({ outletId }: Readonly<{ outletId: string }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<StartState>({ kind: "idle" });

  function deviceId(): string | null {
    return searchParams.get("device") || readStoredDevice()?.id || null;
  }

  async function start() {
    const id = deviceId();
    if (!id) {
      setState({ kind: "error", message: "This tab isn't enrolled as a kiosk. Enrol it from the console first." });
      return;
    }
    setState({ kind: "starting" });
    let response: Response;
    try {
      response = await fetch("/qr/auth/kiosk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outletId, deviceId: id }),
      });
    } catch {
      setState({ kind: "error", message: "Couldn't reach the restaurant - please try again." });
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      setState({ kind: "error", message: body.error?.message ?? "Couldn't start your order - please ask at the counter." });
      return;
    }
    router.push(MENU_ROUTE);
  }

  // The attract loop a real kiosk idles on: a full-bleed poster where the whole
  // screen is the start button (one accessible button, named for its action).
  const starting = state.kind === "starting";
  return (
    <main data-testid="kiosk-attract" className="relative flex min-h-screen flex-1 flex-col">
      <button
        type="button"
        data-testid="kiosk-start"
        aria-label={starting ? "Starting your order" : "Tap to start your order"}
        disabled={starting}
        onClick={() => void start()}
        className="relative flex flex-1 flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 px-8 pb-14 pt-14 text-center text-white disabled:cursor-wait focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white"
      >
        <span aria-hidden="true" className="absolute -right-24 top-20 size-72 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute -left-20 bottom-36 size-56 rounded-full bg-black/10" />
        <span className="relative font-label text-xs font-semibold uppercase tracking-[0.35em] text-white/85">Self-service kiosk</span>
        <span className="relative flex flex-col items-center gap-6">
          <UtensilsCrossed aria-hidden="true" className="size-20 drop-shadow-lg" />
          <span className="font-headline text-6xl font-black leading-[0.95] tracking-tight drop-shadow-md">
            Hungry?
            <br />
            Order here.
          </span>
          <span className="max-w-xs text-base text-white/90">Build your order on screen, then pay at the counter when your number is called.</span>
        </span>
        <span className="relative rounded-full bg-white px-8 py-4 text-xl font-bold text-orange-600 shadow-xl motion-safe:animate-pulse">
          {starting ? "Starting…" : "Tap to start your order"}
        </span>
      </button>
      {state.kind === "error" && (
        <p role="alert" data-testid="kiosk-start-error" className="absolute inset-x-6 bottom-4 rounded-lg bg-black/75 p-3 text-center text-sm text-white">
          {state.message}
        </p>
      )}
    </main>
  );
}
