import { CreditCard } from "lucide-react";
import { ComingSoon } from "../coming-soon";

export default function OpsSubscriptionsPage() {
  return (
    <ComingSoon
      title="Subscriptions"
      description="Plans, invoices, arrears and suspend/reactivate arrive with the subscription-operations story."
      icon={CreditCard}
      testId="ops-subscriptions-placeholder"
    />
  );
}
