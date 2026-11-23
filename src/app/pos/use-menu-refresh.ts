"use client";

// restiq-web#374: an open till re-reads the menu so a dish the owner marks
// sold out (or back on) shows on the tiles without a reload - when the tab
// comes back into view, and on a timer while it is visible.
import { useEffect } from "react";

// ponytail: a 30 s poll per open till; move to a push/SSE signal if menus get large or tills get many.
export const MENU_REFRESH_MS = 30_000;

/** `refresh` should be stable (usePosLoad's is). */
export function useMenuRefresh(refresh: () => void) {
  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    const timer = setInterval(refreshIfVisible, MENU_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [refresh]);
}
