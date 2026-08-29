import { Undo2 } from "lucide-react";
import { KdsHeader } from "../kds-header";
import { ComingSoon } from "../coming-soon";

// K3 Bumped View and recall (CAP-4) - a later sibling story. This story
// (CAP-2) only establishes the header/nav slot for it, per issue #66's scope.
export default function KdsBumpedPage() {
  return (
    <div className="flex flex-1 flex-col">
      <KdsHeader activeMode="bumped" />
      <ComingSoon testId="kds-bumped-coming-soon" title="Bumped view" icon={Undo2} description="Bumped tickets and recall (returning a ticket to its station marked RECALLED) land in a later story." />
    </div>
  );
}
