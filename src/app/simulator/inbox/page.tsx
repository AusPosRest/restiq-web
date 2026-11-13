import { redirect } from "next/navigation";

// Issue #325: the inbox moved under the ops console. Kept so existing links
// and the simulator canvas preset keep working.
export default async function SimulatorInboxRedirect({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const to = (await searchParams).to;
  redirect(`/ops/inbox${to ? `?to=${encodeURIComponent(to)}` : ""}`);
}
