"use client";

// restiq-web#346: the TEST badge for the signed-in tenant, in the owner console, POS and KDS headers. Asks the
// surface's own API pass-through once (GET admin/v1/tenant or pos/v1/tenant). Anything but a clear "testMode:
// true" shows nothing - the badge is a hint, never a reason to break the header.
import { useEffect, useState } from "react";
import { TestModeBadge } from "./test-mode-badge";

export function TenantTestBadge({ endpoint, testId }: Readonly<{ endpoint: "/admin/api/tenant" | "/pos/api/tenant"; testId: string }>) {
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const body = res.ok ? ((await res.json()) as { testMode?: unknown }) : null;
        if (!cancelled && body?.testMode === true) setTestMode(true);
      } catch {
        // No badge - see above.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return testMode ? <TestModeBadge testId={testId} /> : null;
}
