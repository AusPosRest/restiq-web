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

// Same keys and defaults the owner's Settings > Capabilities shows (copied, not
// imported - AD-4): a missing row is off, except menu_photos, which is opt-out.
const KNOWN_KEYS = ["qr_ordering", "kiosk", "token_queue", "menu_photos"] as const;
const DEFAULT_ON = new Set<string>(["menu_photos"]);

export function withDefaults(rows: ReadonlyArray<{ key: string; enabled: boolean }>): Array<{ key: string; enabled: boolean }> {
  const stored = new Map(rows.map((row) => [row.key, row.enabled]));
  const known = KNOWN_KEYS.map((key) => ({ key, enabled: stored.get(key) ?? DEFAULT_ON.has(key) }));
  return [...known, ...rows.filter((row) => !(KNOWN_KEYS as readonly string[]).includes(row.key))];
}

export function CapabilitiesTab({ outlets }: Readonly<{ outlets: TenantDetail["outlets"] }>) {
  return (
    <div className="grid max-w-2xl gap-4" data-testid="capabilities-list">
      <p className="text-sm text-muted-foreground">The owner switches these per outlet in Settings &gt; Capabilities.</p>
      {outlets.map((outlet) => (
        <section key={outlet.id} className="rounded-lg border border-border/40 bg-card" data-testid={`capabilities-outlet-${outlet.id}`}>
          <h2 className="border-b border-border/40 px-5 py-3 text-sm font-semibold">{outlet.name}</h2>
          <ul className="divide-y divide-border/40">
              {withDefaults(outlet.capabilities).map(({ key, enabled }) => (
                <li key={key} className="flex items-center justify-between gap-4 px-5 py-3" data-testid={`capability-${outlet.id}-${key}`}>
                  <span className="text-sm">{CAPABILITY_LABELS[key] ?? key}</span>
                  <span className={`text-xs font-semibold ${enabled ? "text-status-healthy" : "text-muted-foreground"}`}>{enabled ? "On" : "Off"}</span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
