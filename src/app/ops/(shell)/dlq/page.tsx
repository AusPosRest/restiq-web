import { Inbox } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function OpsDlqPage() {
  return (
    <ComingSoon
      title="Dead-Letter Queue"
      description="Rejected-operation browsing and idempotent replay arrive with the dead-letter-queue story."
      icon={Inbox}
      testId="ops-dlq-placeholder"
    />
  );
}
