import { MonitorSmartphone } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function AdminDevicesPage() {
  return (
    <ComingSoon
      testId="admin-devices-placeholder"
      title="Devices"
      description="Enrol POS devices and printers for your outlets here."
      icon={MonitorSmartphone}
    />
  );
}
