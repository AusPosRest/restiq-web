import { LayoutDashboard } from "lucide-react";
import { ComingSoon } from "./coming-soon";

export default function AdminDashboardPage() {
  return (
    <ComingSoon
      testId="admin-dashboard-placeholder"
      title="Dashboard"
      description="Live sales, margin, labour and waste for your outlets will show up here."
      icon={LayoutDashboard}
    />
  );
}
