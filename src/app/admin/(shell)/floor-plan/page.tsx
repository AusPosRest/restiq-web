import { Table2 } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function AdminFloorPlanPage() {
  return (
    <ComingSoon
      testId="admin-floor-plan-placeholder"
      title="Floor Plan"
      description="Lay out your floors, tables and kitchen stations here."
      icon={Table2}
    />
  );
}
