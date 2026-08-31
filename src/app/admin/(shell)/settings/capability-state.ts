// Pure per-outlet capability logic (CAP-10). Verified against restiq-backend's
// actual outlets.service.ts (feature/32-branding-capabilities, read
// directly): `key` is a free-text path segment, not a closed enum server-
// side, and GET only ever returns rows that have been explicitly toggled at
// least once - "an absent key means not yet toggled, left for the caller to
// render as its platform default" (the service's own comment). That default
// rendering is this file's job: KNOWN_CAPABILITY_KEYS is this client's own
// candidate set (QR ordering, kiosk, token queue - the SPEC's named
// examples), and mergeCapabilities always renders one row per known key,
// defaulting to disabled when the backend has no row for it yet, while still
// surfacing any extra/unknown key the backend does return (forward-compat
// with a future capability this build doesn't know about).

export interface OutletCapabilityView {
  key: string;
  enabled: boolean;
}

export const KNOWN_CAPABILITY_KEYS = ["qr_ordering", "kiosk", "token_queue"] as const;

export function mergeCapabilities(known: readonly string[], serverRows: readonly OutletCapabilityView[]): OutletCapabilityView[] {
  const enabledByKey = new Map(serverRows.map((row) => [row.key, row.enabled]));
  const knownRows = known.map((key) => ({ key, enabled: enabledByKey.get(key) ?? false }));
  const extraRows = serverRows.filter((row) => !known.includes(row.key));
  return [...knownRows, ...extraRows];
}

const CAPABILITY_LABELS: Record<string, string> = {
  qr_ordering: "QR Ordering",
  kiosk: "Kiosk Mode",
  token_queue: "Token Queue",
};

const CAPABILITY_DESCRIPTIONS: Record<string, string> = {
  qr_ordering: "Guests scan a table QR code to browse the menu and order from their phone.",
  kiosk: "A self-service ordering kiosk at the counter.",
  token_queue: "Token/queue-number display for pickup or counter service.",
};

function titleCase(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function capabilityLabel(key: string): string {
  return CAPABILITY_LABELS[key] ?? titleCase(key);
}

export function capabilityDescription(key: string): string | null {
  return CAPABILITY_DESCRIPTIONS[key] ?? null;
}
