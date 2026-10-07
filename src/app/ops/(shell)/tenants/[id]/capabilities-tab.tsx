"use client";

// What each outlet has switched on (restiq-backend#191). Read-only: these are
// the owner's switches (Settings > Capabilities) and the ones QR ordering,
// the kiosk and menu photos actually obey. The old tenant-level toggles
// wrote a table nothing read, so they are gone.
import type { TenantDetail } from "../../api";

export const CAPABILITY_LABELS: Record<string, string> = {
  qr_ordering: "QR ordering",
  kiosk: "Kiosk",
  token_queue: "Token queue",
  menu_photos: "Menu photos",
};

export function CapabilitiesTab({ outlets }: Readonly<{ outlets: TenantDetail["outlets"] }>) {
  return (
    <div className="grid max-w-2xl gap-4" data-testid="capabilities-list">
      <p className="text-sm text-muted-foreground">The owner switches these per outlet in Settings &gt; Capabilities.</p>
      {outlets.map((outlet) => (
        <section key={outlet.id} className="rounded-lg border border-border/40 bg-card" data-testid={`capabilities-outlet-${outlet.id}`}>
          <h2 className="border-b border-border/40 px-5 py-3 text-sm font-semibold">{outlet.name}</h2>
          {outlet.capabilities.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Nothing switched on yet.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {outlet.capabilities.map(({ key, enabled }) => (
                <li key={key} className="flex items-center justify-between gap-4 px-5 py-3" data-testid={`capability-${outlet.id}-${key}`}>
                  <span className="text-sm">{CAPABILITY_LABELS[key] ?? key}</span>
                  <span className={`text-xs font-semibold ${enabled ? "text-status-healthy" : "text-muted-foreground"}`}>{enabled ? "On" : "Off"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
