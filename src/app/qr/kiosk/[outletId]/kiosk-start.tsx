"use client";

// Kiosk attract screen (issue #214): one big "Tap to start" that starts a
// device-bound guest session (POST /qr/auth/kiosk -> restiq-backend#138) and
// lands on the existing /qr/menu. Kiosk mode off (403 kiosk_disabled) or a
// device that is not an active kiosk here (404) shows the backend's own
// message and a retry - never the menu.
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

  return (
    <main data-testid="kiosk-attract" className="flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <p className="font-label text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Self-service kiosk</p>
      <h1 className="mt-4 font-headline text-4xl font-semibold text-foreground">Order here</h1>
      <p className="mt-3 max-w-sm text-base text-muted-foreground">Browse the menu, build your order and pay at the counter when your number is called.</p>
      <button
        type="button"
        data-testid="kiosk-start"
        disabled={state.kind === "starting"}
        onClick={() => void start()}
        className="mt-10 w-full max-w-sm rounded-2xl bg-primary px-8 py-6 text-2xl font-semibold text-primary-foreground shadow-lg transition-transform active:scale-[0.98] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {state.kind === "starting" ? "Starting…" : "Tap to start your order"}
      </button>
      {state.kind === "error" && (
        <p role="alert" data-testid="kiosk-start-error" className="mt-6 max-w-sm text-sm text-status-error">
          {state.message}
        </p>
      )}
    </main>
  );
}
