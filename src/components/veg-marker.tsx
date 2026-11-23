// The standard veg / non-veg mark: a square outline with a dot inside, green or red.
// Shared by the guest menu and the till; renders nothing when the dish has no marker.
// Colours: the guest and till themes both define --status-available (green) and --destructive (red);
// --status-healthy exists only in the ops theme, where this would render uncoloured.
export type VegMarkerValue = "veg" | "non_veg";

export function VegMarker({ marker, className = "", "data-testid": testId }: Readonly<{ marker: VegMarkerValue | null | undefined; className?: string; "data-testid"?: string }>) {
  if (!marker) return null;
  const veg = marker === "veg";
  return (
    <span
      role="img"
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
      data-testid={testId}
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border-2 border-current ${veg ? "text-status-available" : "text-destructive"} ${className}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
    </span>
  );
}
