import { Grid3x3 } from "lucide-react";
import { KdsHeader } from "../kds-header";
import { ComingSoon } from "../coming-soon";

// K4 All-Day Production Summary (CAP-5) - a later sibling story. This story
// (CAP-2) only establishes the header/nav slot for it, per issue #66's scope.
export default function KdsAllDayPage() {
  return (
    <div className="flex flex-1 flex-col">
      <KdsHeader activeMode="all-day" />
      <ComingSoon testId="kds-all-day-coming-soon" title="All-day summary" icon={Grid3x3} description="Live per-item production counts across all open tickets land in a later story." />
    </div>
  );
}
