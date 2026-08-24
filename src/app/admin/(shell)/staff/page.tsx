import { Users } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function AdminStaffPage() {
  return (
    <ComingSoon testId="admin-staff-placeholder" title="Staff" description="Invite your team and assign roles here." icon={Users} />
  );
}
