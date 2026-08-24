import { Settings } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function AdminSettingsPage() {
  return (
    <ComingSoon
      testId="admin-settings-placeholder"
      title="Settings"
      description="Branding and per-outlet capability toggles will show up here."
      icon={Settings}
    />
  );
}
