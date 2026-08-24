// Pure formatting helpers for O8 - unit-tested independently of rendering.

/** "5m ago" / "2h 14m ago" / "50h ago" style relative lag (Voice and Tone: plain, factual). */
export function formatLag(lagSeconds: number): string {
  if (lagSeconds < 60) return "just now";
  const hours = Math.floor(lagSeconds / 3600);
  const minutes = Math.floor((lagSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m ago`;
  if (minutes === 0) return `${hours}h ago`;
  return `${hours}h ${minutes}m ago`;
}

export function formatClockSkew(seconds: number): string {
  const sign = seconds > 0 ? "+" : seconds < 0 ? "-" : "";
  return `${sign}${Math.abs(seconds)}s`;
}
