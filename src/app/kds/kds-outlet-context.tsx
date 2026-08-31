"use client";

// The KDS shell has no dedicated session-read endpoint any more than POS
// does (see src/lib/pos-session.ts's PosStaffDisplay header) - the outlet a
// display belongs to is exactly what the pos_staff cookie already says, set
// by the login/select-outlet route handlers. layout.tsx reads that cookie
// server-side once and hands it down through this context so every client
// component under /kds (the station picker, the header, the queue screen)
// can read the outlet id without re-parsing a cookie or re-fetching it.
import { createContext, useContext } from "react";

export interface KdsOutlet {
  id: string;
  name: string;
}

const KdsOutletContext = createContext<KdsOutlet | null>(null);

export function KdsOutletProvider({ outlet, children }: Readonly<{ outlet: KdsOutlet; children: React.ReactNode }>) {
  return <KdsOutletContext.Provider value={outlet}>{children}</KdsOutletContext.Provider>;
}

/** Throws if rendered outside the provider - every /kds page is under it (see layout.tsx), so a missing value is a real bug, not a state to render around. */
export function useKdsOutlet(): KdsOutlet {
  const outlet = useContext(KdsOutletContext);
  if (!outlet) throw new Error("useKdsOutlet must be used within KdsOutletProvider");
  return outlet;
}
