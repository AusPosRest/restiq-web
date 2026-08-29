import { Suspense } from "react";
import { KdsEntry } from "./kds-entry";

// Suspense wrapper: KdsEntry reads useSearchParams (?reselect=1), which Next
// requires a boundary around even though this whole route tree is already
// forced dynamic by layout.tsx's cookies() read.
export default function KdsEntryPage() {
  return (
    <Suspense>
      <KdsEntry />
    </Suspense>
  );
}
