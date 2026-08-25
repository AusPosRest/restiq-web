import { LayoutGrid } from "lucide-react";
import { ComingSoon } from "./coming-soon";

// Landing destination after a successful PIN login. EXPERIENCE.md routes a
// successful login to the Table Map (dine-in) or QSR Counter (counter-only
// outlets) by outlet capability - neither exists yet (CAP-2/CAP-6, later
// stories), so this story lands on a placeholder inside the real shell
// (persistent shift bar included) rather than a route that 404s, matching
// the precedent set by tenant admin's CAP-2 checklist for not-yet-built
// destinations.
export default function PosHomePage() {
  return (
    <ComingSoon
      testId="pos-home-coming-soon"
      title="Floor"
      icon={LayoutGrid}
      description="The table map and QSR counter land in a later story. You're signed in and clocked in - this is where order-taking starts."
    />
  );
}
