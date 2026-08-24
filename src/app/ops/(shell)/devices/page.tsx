import { MonitorSmartphone } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function OpsDevicesPage() {
  return (
    <ComingSoon
      title="Devices"
      description="Device fleet, enrolment codes and hub designation arrive with the device-fleet story."
      icon={MonitorSmartphone}
      testId="ops-devices-placeholder"
    />
  );
}
