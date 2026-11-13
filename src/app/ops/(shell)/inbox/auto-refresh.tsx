"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-reads the inbox every few seconds, so a new email shows up without a reload. */
export function AutoRefresh({ seconds = 5 }: Readonly<{ seconds?: number }>) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
