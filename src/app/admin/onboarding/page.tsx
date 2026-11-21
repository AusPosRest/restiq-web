import { GoLiveChecklist } from "../go-live-checklist";
import { OwnerSetupHeader } from "../owner-setup-header";
import { AdminTenantProvider, ServiceModeBar } from "../service-mode";

export default function AdminOnboardingPage() {
  // restiq-web#449: a provisioning restaurant lands here, so service mode shows here too.
  return (
    <AdminTenantProvider>
      <ServiceModeBar />
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12">
        <OwnerSetupHeader />
        <GoLiveChecklist />
      </main>
    </AdminTenantProvider>
  );
}
