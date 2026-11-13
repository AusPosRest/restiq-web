"use client";

// restiq-web#343 (PE-19): lock the till between customers straight from the
// table map and counter - signs the staff member out to the PIN pad. The
// shift, payments and clock-out live behind "More" (the /pos shell).
import { Lock } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LockTillButton() {
  const router = useRouter();
  const [locking, setLocking] = useState(false);

  async function lock() {
    setLocking(true);
    await fetch("/pos/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/pos/login");
  }

  return (
    <button
      type="button"
      data-testid="pos-lock-till"
      disabled={locking}
      onClick={() => void lock()}
      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      <Lock className="size-3.5" aria-hidden="true" /> {locking ? "Locking…" : "Lock"}
    </button>
  );
}
