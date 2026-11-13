// Where Stripe sends owners after onboarding or card setup (#425). Public: no ops chrome,
// no session. The proxy matcher doesn't cover /stripe, so nothing intercepts it.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "RESTIQ", robots: { index: false } };

const MESSAGES: Record<string, string> = {
  onboarding: "Thanks — your payment details are with Stripe. You can close this page.",
  billing: "Card saved. Your subscription will be charged automatically.",
};
const EXPIRED = "This link has expired. Ask your provider for a new link.";

export default async function StripeDonePage({ searchParams }: Readonly<{ searchParams: Promise<{ flow?: string | string[] }> }>) {
  const { flow } = await searchParams;
  const message = (typeof flow === "string" && MESSAGES[flow]) || EXPIRED;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <p className="max-w-md text-center text-lg" data-testid="stripe-done-message">
        {message}
      </p>
    </main>
  );
}
