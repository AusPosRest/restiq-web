import type { Metadata } from "next";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "New Tenant - RESTIQ Platform Console" };

export default function NewTenantPage() {
  return <OnboardingWizard />;
}
