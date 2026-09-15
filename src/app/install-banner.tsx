"use client";

// "Install RESTIQ" hint along the bottom of the screen (issue #222): Android /
// Chrome get a real Install button, iOS gets the Share -> Add to Home Screen
// steps. Hidden inside the installed app and once dismissed.
import { Share, SquarePlus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { installMode, isIos } from "./install-state";

// Chrome's install event; not in TypeScript's DOM lib.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

const DISMISS_KEY = "restiq:install-dismissed";
const noSubscribe = () => () => {};

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function readStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function InstallBanner() {
  const path = usePathname();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedNow, setDismissedNow] = useState(false);
  // Server snapshots hide the banner, so SSR and hydration always agree.
  const standalone = useSyncExternalStore(noSubscribe, readStandalone, () => true);
  const ios = useSyncExternalStore(noSubscribe, () => isIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints), () => false);
  const dismissed = useSyncExternalStore(noSubscribe, readDismissed, () => true) || dismissedNow;

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // keep Chrome's mini-infobar away; our button opens it
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const mode = installMode({ standalone, ios, promptReady: prompt !== null, dismissed, path });
  if (!mode) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // private mode: hide it for this page view only
    }
    setDismissedNow(true);
  };

  return (
    <div
      role="region"
      aria-label="Install the app"
      data-testid="install-banner"
      data-mode={mode}
      className="ops-theme fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm text-foreground shadow-lg"
    >
      {mode === "prompt" ? (
        <>
          <p className="flex-1">Install RESTIQ as an app on this device.</p>
          <Button size="sm" data-testid="install-banner-install" onClick={() => void prompt?.prompt().finally(() => setPrompt(null))}>
            Install
          </Button>
        </>
      ) : (
        <p className="flex-1">
          Install on this iPhone or iPad: tap <Share className="inline size-4 align-text-bottom" aria-label="Share" /> Share, then{" "}
          <SquarePlus className="inline size-4 align-text-bottom" aria-hidden="true" /> <strong>Add to Home Screen</strong>.
        </p>
      )}
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss" data-testid="install-banner-dismiss" onClick={dismiss}>
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
