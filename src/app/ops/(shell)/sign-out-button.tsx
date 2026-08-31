"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await fetch("/ops/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/ops/login");
  }

  return (
    <button
      type="button"
      data-testid="ops-sign-out"
      onClick={() => void signOut()}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <LogOut className="size-4" aria-hidden="true" />
      Sign out
    </button>
  );
}
