// What /stripe/done says and where it sends the visitor (restiq-backend#284 onboarding UX).
// Operators (ops cookie present) go back to the tenant's tab; owners go to their admin.
// tenant and slug come from the query string, so they are checked before they become URLs.

export type DoneKind = "success" | "expired" | "cancelled";

export interface DoneResult {
  kind: DoneKind;
  title: string;
  line: string;
  /** null: nowhere safe to send them, so no countdown. */
  href: string | null;
  seconds: number;
}

export interface DoneInput {
  flow?: string;
  tenant?: string;
  slug?: string;
  cancelled?: string;
  isOperator: boolean;
  baseDomain?: string;
}

const TENANT = /^[0-9a-f-]{1,64}$/i;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DOMAIN = /^[a-z0-9.-]+(?::\d+)?$/i;

export function doneResult({ flow, tenant, slug, cancelled, isOperator, baseDomain }: DoneInput): DoneResult {
  const billing = flow === "billing";
  const kind: DoneKind = flow === "onboarding" || billing ? (billing && cancelled === "1" ? "cancelled" : "success") : "expired";

  let href: string | null;
  if (isOperator) {
    href = tenant && TENANT.test(tenant) ? `/ops/tenants/${tenant}?tab=${billing ? "subscription" : "payments"}` : "/ops/tenants";
  } else {
    href = slug && SLUG.test(slug) && baseDomain && DOMAIN.test(baseDomain) ? `https://${slug}.${baseDomain}/admin` : null;
  }

  if (kind === "expired") {
    return isOperator
      ? { kind, title: "This link has expired", line: "Making a fresh link… taking you back to the Payments tab.", href, seconds: 2 }
      : { kind, title: "This link has expired", line: "Ask your provider for a fresh link. It only takes a moment.", href, seconds: 5 };
  }
  if (kind === "cancelled") {
    return { kind, title: "Checkout cancelled", line: "No card was saved and nothing was charged.", href, seconds: 5 };
  }
  return billing
    ? { kind, title: "Card saved", line: "Your subscription is charged to this card automatically each period.", href, seconds: 5 }
    : { kind, title: "Details sent to Stripe", line: "Stripe checks them, usually within minutes. Card payments switch on once they're approved.", href, seconds: 5 };
}
