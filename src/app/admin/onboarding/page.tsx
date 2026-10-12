import { GoLiveChecklist } from "../go-live-checklist";
import { OwnerSetupHeader } from "../owner-setup-header";

export default function AdminOnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12">
      <OwnerSetupHeader />
      <GoLiveChecklist />
    </main>
  );
}
