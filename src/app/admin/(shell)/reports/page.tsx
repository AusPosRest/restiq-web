import { BarChart3 } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function AdminReportsPage() {
  return (
    <ComingSoon
      testId="admin-reports-placeholder"
      title="Reports"
      description="Sales, financial, menu engineering, operations and labour reports will show up here."
      icon={BarChart3}
    />
  );
}
