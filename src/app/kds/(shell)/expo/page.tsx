import { LayoutGrid } from "lucide-react";
import { KdsHeader } from "../kds-header";
import { ComingSoon } from "../coming-soon";

// K2 Expo View (CAP-3) - a later sibling story. This story (CAP-2) only
// establishes the header/nav slot for it, per issue #66's scope.
export default function KdsExpoPage() {
  return (
    <div className="flex flex-1 flex-col">
      <KdsHeader activeMode="expo" />
      <ComingSoon testId="kds-expo-coming-soon" title="Expo view" icon={LayoutGrid} description="Per-order, per-station readiness and the Waiting-On panel land in a later story." />
    </div>
  );
}
