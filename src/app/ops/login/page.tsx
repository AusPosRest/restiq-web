import { Store, MonitorSmartphone, Activity } from "lucide-react";
import { sanitizeNextPath } from "@/lib/ops-session";
import { LoginForm } from "./login-form";

const highlights = [
  { icon: Store, label: "Tenant onboarding" },
  { icon: MonitorSmartphone, label: "Device fleet" },
  { icon: Activity, label: "Sync health" },
];

// O1 Console Login - outside the app shell.
export default async function OpsLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen flex-1">
      <section className="hidden flex-1 flex-col justify-between p-12 lg:flex" aria-hidden="true">
        <div>
          <p className="font-headline text-5xl font-bold tracking-tight text-primary">RESTIQ</p>
          <h2 className="font-headline mt-3 text-2xl font-semibold">Platform Console</h2>
          <p className="mt-4 text-muted-foreground">Onboard tenants. Provision outlets. Watch the fleet.</p>
          <ul className="mt-14 space-y-6">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-lg bg-card text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-lg">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-1 flex-col justify-center bg-card px-6 py-12 sm:px-16 lg:max-w-[44rem]">
        <div className="mx-auto w-full max-w-md">
          <h1 className="font-headline text-3xl font-semibold">Sign in to Platform Console</h1>
          <p className="mt-2 text-sm text-muted-foreground">Operator credentials required</p>
          <LoginForm nextPath={sanitizeNextPath(params.next)} sessionExpired={params.expired === "1"} />
        </div>
        <p className="mt-16 text-center text-xs text-muted-foreground">
          Internal RESTIQ staff only &middot; access is audited
        </p>
      </section>
    </main>
  );
}
