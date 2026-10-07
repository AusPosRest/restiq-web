// Next inlines NEXT_PUBLIC_* at build time, so a standalone-built app can't be
// re-pointed at a different API without rebuilding (restiq-web#304 - the
// Windows hub till runs this same build against a local POS service).
// RESTIQ_API_URL is a plain server env var, read at call time, so it can be
// set when the built app is started. Falls back to NEXT_PUBLIC_API_URL for
// environments (Vercel, existing deploys) that only set the public variable.
export function apiUrl(): string | undefined {
  return process.env.RESTIQ_API_URL || process.env.NEXT_PUBLIC_API_URL;
}
